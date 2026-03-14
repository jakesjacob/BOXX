import { requireAuth } from '@/lib/api-helpers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/availability?date=YYYY-MM-DD&days=7&instructorId=UUID
 *
 * Returns available appointment slots for a date range.
 * Computes slots from instructor_availability windows minus existing bookings.
 * Supports concurrent slots (e.g., 10 masseuses = 10 concurrent bookings per slot).
 */
export async function GET(request) {
  try {
    const authResult = await requireAuth()
    if (authResult.response) return authResult.response
    const { tenantId } = authResult

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // Check feature flag
    const { isFeatureEnabled, getTenantPlan } = await import('@/lib/feature-flags')
    const plan = await getTenantPlan(tenantId)
    if (!await isFeatureEnabled(tenantId, 'appointment_booking', plan)) {
      return NextResponse.json({ error: 'Appointment booking is not available' }, { status: 402 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const days = Math.min(parseInt(searchParams.get('days')) || 7, 14)
    const instructorId = searchParams.get('instructorId')
    const locationId = searchParams.get('locationId')

    // Fetch active availability windows
    let query = supabaseAdmin
      .from('instructor_availability')
      .select('*, instructors(id, name, photo_url, bio), locations(id, name), zones(id, name)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)

    if (instructorId) query = query.eq('instructor_id', instructorId)
    if (locationId) query = query.eq('location_id', locationId)

    const { data: windows, error: windowsError } = await query

    if (windowsError) {
      console.error('[availability] Windows error:', windowsError)
      return NextResponse.json({ error: 'Failed to load availability' }, { status: 500 })
    }

    if (!windows || windows.length === 0) {
      return NextResponse.json({ slots: [], instructors: [] })
    }

    // Fetch unavailability periods
    const instructorIds = [...new Set(windows.map((w) => w.instructor_id))]
    const endDateObj = new Date(startDate)
    endDateObj.setDate(endDateObj.getDate() + days)
    const endDateStr = endDateObj.toISOString().split('T')[0]

    const [unavailRes, existingRes] = await Promise.all([
      supabaseAdmin
        .from('instructor_unavailability')
        .select('instructor_id, start_date, end_date')
        .eq('tenant_id', tenantId)
        .in('instructor_id', instructorIds)
        .lte('start_date', endDateStr)
        .gte('end_date', startDate),
      // Fetch existing appointment bookings in the date range
      supabaseAdmin
        .from('class_schedule')
        .select('id, instructor_id, starts_at, ends_at, availability_id, bookings(id, status)')
        .eq('tenant_id', tenantId)
        .eq('is_appointment', true)
        .eq('status', 'active')
        .in('instructor_id', instructorIds)
        .gte('starts_at', new Date(startDate + 'T00:00:00Z').toISOString())
        .lte('starts_at', endDateObj.toISOString()),
    ])

    const unavailability = unavailRes.data || []
    const existingAppointments = existingRes.data || []

    // Build a map of existing bookings per availability window per time slot
    // Key: `${availabilityId}:${dateStr}:${timeStr}` → count of confirmed bookings
    const bookingCounts = {}
    existingAppointments.forEach((appt) => {
      const confirmedCount = (appt.bookings || []).filter((b) => b.status === 'confirmed').length
      if (confirmedCount > 0 && appt.availability_id) {
        const apptDate = new Date(appt.starts_at)
        const dateStr = apptDate.toISOString().split('T')[0]
        const timeStr = `${String(apptDate.getUTCHours()).padStart(2, '0')}:${String(apptDate.getUTCMinutes()).padStart(2, '0')}`
        const key = `${appt.availability_id}:${dateStr}:${timeStr}`
        bookingCounts[key] = (bookingCounts[key] || 0) + confirmedCount
      }
    })

    // Generate slots for each day in the range
    const slots = []
    const now = new Date()

    for (let d = 0; d < days; d++) {
      const dateObj = new Date(startDate + 'T00:00:00Z')
      dateObj.setDate(dateObj.getDate() + d)
      const dayOfWeek = dateObj.getDay()
      const dateStr = dateObj.toISOString().split('T')[0]

      // Find windows for this day of week
      const dayWindows = windows.filter((w) => w.day_of_week === dayOfWeek)

      for (const window of dayWindows) {
        // Check unavailability
        const isUnavailable = unavailability.some(
          (u) => u.instructor_id === window.instructor_id && dateStr >= u.start_date && dateStr <= u.end_date
        )
        if (isUnavailable) continue

        // Generate time slots within the window
        const [startH, startM] = window.start_time.split(':').map(Number)
        const [endH, endM] = window.end_time.split(':').map(Number)
        const windowStartMins = startH * 60 + startM
        const windowEndMins = endH * 60 + endM
        const duration = window.session_duration

        for (let mins = windowStartMins; mins + duration <= windowEndMins; mins += duration) {
          const slotH = Math.floor(mins / 60)
          const slotM = mins % 60
          const timeStr = `${String(slotH).padStart(2, '0')}:${String(slotM).padStart(2, '0')}`

          // Skip past slots
          const slotDateTime = new Date(`${dateStr}T${timeStr}:00Z`)
          if (slotDateTime <= now) continue

          // Check concurrent capacity
          const key = `${window.id}:${dateStr}:${timeStr}`
          const booked = bookingCounts[key] || 0
          const slotsRemaining = window.concurrent_slots - booked

          if (slotsRemaining <= 0) continue

          slots.push({
            availabilityId: window.id,
            instructorId: window.instructor_id,
            instructor: window.instructors,
            location: window.locations,
            zone: window.zones,
            date: dateStr,
            time: timeStr,
            duration: window.session_duration,
            creditsCost: window.credits_cost,
            concurrentSlots: window.concurrent_slots,
            slotsRemaining,
            booked,
          })
        }
      }
    }

    // Also return unique instructors for filtering
    const uniqueInstructors = Object.values(
      windows.reduce((acc, w) => {
        if (!acc[w.instructor_id]) acc[w.instructor_id] = w.instructors
        return acc
      }, {})
    ).filter(Boolean)

    return NextResponse.json({ slots, instructors: uniqueInstructors })
  } catch (error) {
    console.error('[availability] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
