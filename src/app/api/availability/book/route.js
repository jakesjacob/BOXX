import { requireAuth } from '@/lib/api-helpers'
import { rateLimit } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendBookingConfirmation, sendCreditsLowWarning } from '@/lib/email'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const bookSchema = z.object({
  availabilityId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
})

/**
 * POST /api/availability/book — Book an appointment slot
 *
 * Supports:
 * - Standard instructor-specific bookings
 * - "Anyone available" bookings (auto-assigns an available instructor)
 * - Buffer time enforcement between appointments
 */
export async function POST(request) {
  try {
    const authResult = await requireAuth()
    if (authResult.response) return authResult.response
    const { session, tenantId } = authResult

    const { limited } = rateLimit(`appointment:${session.user.id}`, 10, 60 * 1000)
    if (limited) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
    }

    const body = await request.json()
    const parsed = bookSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { availabilityId, date, time } = parsed.data
    const userId = session.user.id

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // 1. Fetch the availability window
    const { data: window, error: windowError } = await supabaseAdmin
      .from('instructor_availability')
      .select('*, instructors(id, name)')
      .eq('tenant_id', tenantId)
      .eq('id', availabilityId)
      .eq('is_active', true)
      .single()

    if (windowError || !window) {
      return NextResponse.json({ error: 'Availability window not found or inactive' }, { status: 404 })
    }

    // 2. Validate the slot time
    const slotDateTime = new Date(`${date}T${time}:00Z`)
    const slotEnd = new Date(slotDateTime.getTime() + window.session_duration * 60000)
    const bufferMs = (window.buffer_mins || 0) * 60000

    if (slotDateTime <= new Date()) {
      return NextResponse.json({ error: 'This time slot has already passed' }, { status: 400 })
    }

    const dayOfWeek = slotDateTime.getUTCDay()
    if (dayOfWeek !== window.day_of_week) {
      return NextResponse.json({ error: 'This slot is not available on this day' }, { status: 400 })
    }

    if (time < window.start_time.slice(0, 5) || time >= window.end_time.slice(0, 5)) {
      return NextResponse.json({ error: 'This time is outside the availability window' }, { status: 400 })
    }

    // 3. Resolve instructor — auto-assign for "anyone available"
    let assignedInstructorId = window.instructor_id
    let assignedInstructorName = window.instructors?.name

    if (!assignedInstructorId) {
      // "Anyone available" — find an available instructor
      const resolved = await resolveAvailableInstructor(tenantId, window, date, slotDateTime, slotEnd, bufferMs)
      if (!resolved) {
        return NextResponse.json({ error: 'No instructors available for this time slot' }, { status: 400 })
      }
      assignedInstructorId = resolved.id
      assignedInstructorName = resolved.name
    } else {
      // Check instructor unavailability
      const { data: unavail } = await supabaseAdmin
        .from('instructor_unavailability')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('instructor_id', assignedInstructorId)
        .lte('start_date', date)
        .gte('end_date', date)
        .limit(1)

      if (unavail && unavail.length > 0) {
        return NextResponse.json({ error: 'Instructor is unavailable on this date' }, { status: 400 })
      }

      // Check cross-window buffer conflicts
      const hasConflict = await checkBufferConflict(tenantId, assignedInstructorId, slotDateTime, slotEnd, bufferMs)
      if (hasConflict) {
        return NextResponse.json({ error: 'This slot conflicts with another appointment (buffer time)' }, { status: 400 })
      }
    }

    // 4. Check if a class_schedule already exists for this slot (concurrent slots)
    let classScheduleId = null

    const { data: existing } = await supabaseAdmin
      .from('class_schedule')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('availability_id', availabilityId)
      .eq('starts_at', slotDateTime.toISOString())
      .eq('status', 'active')
      .limit(1)

    if (existing && existing.length > 0) {
      classScheduleId = existing[0].id

      // Check if user already booked this slot
      const { data: existingBooking } = await supabaseAdmin
        .from('bookings')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .eq('class_schedule_id', classScheduleId)
        .eq('status', 'confirmed')
        .limit(1)

      if (existingBooking && existingBooking.length > 0) {
        return NextResponse.json({ error: 'You already have a booking for this slot' }, { status: 400 })
      }

      // Check concurrent capacity
      const { count: bookedCount } = await supabaseAdmin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('class_schedule_id', classScheduleId)
        .eq('status', 'confirmed')

      if ((bookedCount || 0) >= window.concurrent_slots) {
        return NextResponse.json({ error: 'This slot is fully booked' }, { status: 400 })
      }
    } else {
      // Create the class_schedule entry
      const { data: newClass, error: classError } = await supabaseAdmin
        .from('class_schedule')
        .insert({
          tenant_id: tenantId,
          instructor_id: assignedInstructorId,
          location_id: window.location_id,
          zone_id: window.zone_id,
          starts_at: slotDateTime.toISOString(),
          ends_at: slotEnd.toISOString(),
          capacity: window.concurrent_slots,
          credits_cost: window.credits_cost,
          status: 'active',
          is_appointment: true,
          availability_id: availabilityId,
        })
        .select('id')
        .single()

      if (classError) {
        console.error('[availability/book] Class create error:', classError)
        return NextResponse.json({ error: 'Failed to create appointment' }, { status: 500 })
      }

      classScheduleId = newClass.id
    }

    // 5. Handle credits
    let creditId = null

    if (window.credits_cost > 0) {
      const now = new Date().toISOString()
      const { data: allCredits } = await supabaseAdmin
        .from('user_credits')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('expires_at', now)
        .order('expires_at', { ascending: true })

      const availableCredits = (allCredits || []).filter(
        (c) => c.credits_remaining > 0 || c.credits_remaining === null
      )

      if (!availableCredits.length) {
        return NextResponse.json({ error: 'No available credits. Purchase a class pack first.' }, { status: 400 })
      }

      const credit = availableCredits[0]
      creditId = credit.id

      if (credit.credits_remaining !== null) {
        const { data: updated, error: deductError } = await supabaseAdmin
          .rpc('deduct_credit', { credit_id: credit.id })

        if (deductError || !updated) {
          return NextResponse.json({ error: 'No credits available. Please try again.' }, { status: 400 })
        }
      }
    }

    // 6. Create booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        class_schedule_id: classScheduleId,
        credit_id: creditId,
        status: 'confirmed',
      })
      .select()
      .single()

    if (bookingError) {
      console.error('[availability/book] Booking error:', bookingError)
      if (creditId) {
        await supabaseAdmin.rpc('restore_credit', { credit_id: creditId })
      }
      return NextResponse.json({ error: 'Failed to create booking. Please try again.' }, { status: 500 })
    }

    // 7. Resolve timezone for email
    let displayTz = 'UTC'
    if (window.location_id) {
      const { data: loc } = await supabaseAdmin
        .from('locations')
        .select('timezone')
        .eq('id', window.location_id)
        .single()
      if (loc?.timezone) displayTz = loc.timezone
    }
    if (displayTz === 'UTC') {
      const { data: settings } = await supabaseAdmin
        .from('studio_settings')
        .select('value')
        .eq('tenant_id', tenantId)
        .eq('key', 'timezone')
        .single()
      if (settings?.value) displayTz = settings.value
    }

    // 8. Send confirmation email (non-blocking)
    const { data: emailUser } = await supabaseAdmin
      .from('users')
      .select('email, name')
      .eq('tenant_id', tenantId)
      .eq('id', userId)
      .single()

    if (emailUser?.email) {
      sendBookingConfirmation({
        to: emailUser.email,
        name: emailUser.name,
        className: `Appointment with ${assignedInstructorName || 'Instructor'}`,
        instructor: assignedInstructorName,
        date: slotDateTime.toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', timeZone: displayTz,
        }),
        time: slotDateTime.toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', timeZone: displayTz,
        }),
      }).catch((err) => console.error('[availability/book] Email failed:', err))

      // Low credit warning
      if (creditId && window.credits_cost > 0) {
        const { data: creditAfter } = await supabaseAdmin
          .from('user_credits')
          .select('credits_remaining, class_pack_id')
          .eq('id', creditId)
          .single()

        if (creditAfter?.credits_remaining === 1) {
          const { data: packInfo } = await supabaseAdmin
            .from('class_packs')
            .select('name')
            .eq('tenant_id', tenantId)
            .eq('id', creditAfter.class_pack_id)
            .single()

          sendCreditsLowWarning({
            to: emailUser.email,
            name: emailUser.name,
            creditsRemaining: 1,
            packName: packInfo?.name,
          }).catch((err) => console.error('[availability/book] Low credit email failed:', err))
        }
      }
    }

    return NextResponse.json({
      booking,
      message: `Appointment booked with ${assignedInstructorName || 'instructor'}!`,
    })
  } catch (error) {
    console.error('[availability/book] Error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}

/**
 * Find an available instructor for an "anyone available" window.
 * Checks unavailability, existing bookings, and buffer conflicts.
 */
async function resolveAvailableInstructor(tenantId, window, dateStr, slotStart, slotEnd, bufferMs) {
  // Get eligible instructors — by location or all active
  let instructors = []
  if (window.location_id) {
    const { data } = await supabaseAdmin
      .from('instructor_locations')
      .select('instructor_id, instructors(id, name)')
      .eq('tenant_id', tenantId)
      .in('location_id', [window.location_id])
    instructors = (data || []).map(li => li.instructors).filter(Boolean)
  } else {
    const { data } = await supabaseAdmin
      .from('instructors')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('active', true)
    instructors = data || []
  }

  if (!instructors.length) return null

  // Check unavailability
  const { data: unavail } = await supabaseAdmin
    .from('instructor_unavailability')
    .select('instructor_id')
    .eq('tenant_id', tenantId)
    .in('instructor_id', instructors.map(i => i.id))
    .lte('start_date', dateStr)
    .gte('end_date', dateStr)

  const unavailIds = new Set((unavail || []).map(u => u.instructor_id))
  const available = instructors.filter(i => !unavailIds.has(i.id))

  if (!available.length) return null

  // Check booking conflicts for each available instructor
  const startMs = slotStart.getTime()
  const endMs = slotEnd.getTime()

  // Fetch appointments for all candidates in a ±2 hour window for efficiency
  const rangeStart = new Date(startMs - 2 * 60 * 60000).toISOString()
  const rangeEnd = new Date(endMs + 2 * 60 * 60000).toISOString()

  const { data: appointments } = await supabaseAdmin
    .from('class_schedule')
    .select('instructor_id, starts_at, ends_at, bookings(id, status)')
    .eq('tenant_id', tenantId)
    .eq('is_appointment', true)
    .eq('status', 'active')
    .in('instructor_id', available.map(i => i.id))
    .gte('starts_at', rangeStart)
    .lte('starts_at', rangeEnd)

  const bookedInstructors = new Set()
  ;(appointments || []).forEach(appt => {
    const confirmed = (appt.bookings || []).filter(b => b.status === 'confirmed').length
    if (confirmed > 0) {
      const apptEnd = new Date(appt.ends_at).getTime()
      const apptStart = new Date(appt.starts_at).getTime()
      // Check with buffer
      if (startMs < apptEnd + bufferMs && endMs > apptStart - bufferMs) {
        bookedInstructors.add(appt.instructor_id)
      }
    }
  })

  const freeInstructors = available.filter(i => !bookedInstructors.has(i.id))
  return freeInstructors[0] || null
}

/**
 * Check if an instructor has a buffer conflict at the given time.
 */
async function checkBufferConflict(tenantId, instructorId, slotStart, slotEnd, bufferMs) {
  if (bufferMs <= 0) return false

  const startMs = slotStart.getTime()
  const endMs = slotEnd.getTime()
  const rangeStart = new Date(startMs - bufferMs - 60000).toISOString()
  const rangeEnd = new Date(endMs + bufferMs + 60000).toISOString()

  const { data: nearby } = await supabaseAdmin
    .from('class_schedule')
    .select('starts_at, ends_at, bookings(id, status)')
    .eq('tenant_id', tenantId)
    .eq('instructor_id', instructorId)
    .eq('is_appointment', true)
    .eq('status', 'active')
    .gte('starts_at', rangeStart)
    .lte('starts_at', rangeEnd)

  return (nearby || []).some(appt => {
    const confirmed = (appt.bookings || []).filter(b => b.status === 'confirmed').length
    if (confirmed === 0) return false
    const apptStart = new Date(appt.starts_at).getTime()
    const apptEnd = new Date(appt.ends_at).getTime()
    return startMs < apptEnd + bufferMs && endMs > apptStart - bufferMs
  })
}
