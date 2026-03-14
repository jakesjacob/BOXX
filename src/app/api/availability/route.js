import { requireAuth, getTenantPlan } from '@/lib/api-helpers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/availability?date=YYYY-MM-DD&days=7&instructorId=UUID&locationId=UUID
 *
 * Returns available appointment slots for a date range.
 * Computes slots from instructor_availability windows minus existing bookings.
 *
 * Features:
 * - Concurrent slots (e.g., 10 masseuses = 10 concurrent bookings per slot)
 * - Buffer time between appointments (travel/cleanup)
 * - Cross-window conflict detection (instructor booked via any window)
 * - "Anyone available" windows (instructor_id IS NULL)
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
    const { isFeatureEnabled } = await import('@/lib/feature-flags')
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

    // Collect all instructor IDs (for conflict checking)
    const allInstructorIds = [...new Set(windows.map((w) => w.instructor_id).filter(Boolean))]

    // For "anyone available" windows, also fetch all active instructors at those locations
    const anyoneWindows = windows.filter(w => !w.instructor_id)
    let anyoneInstructors = []
    if (anyoneWindows.length > 0) {
      const anyoneLocationIds = [...new Set(anyoneWindows.map(w => w.location_id).filter(Boolean))]
      if (anyoneLocationIds.length > 0) {
        const { data: locInstructors } = await supabaseAdmin
          .from('instructor_locations')
          .select('instructor_id, instructors(id, name, photo_url, bio)')
          .eq('tenant_id', tenantId)
          .in('location_id', anyoneLocationIds)
        anyoneInstructors = (locInstructors || []).map(li => li.instructors).filter(Boolean)
        const anyIds = anyoneInstructors.map(i => i.id)
        anyIds.forEach(id => { if (!allInstructorIds.includes(id)) allInstructorIds.push(id) })
      } else {
        // No location = any active instructor
        const { data: allInstr } = await supabaseAdmin
          .from('instructors')
          .select('id, name, photo_url, bio')
          .eq('tenant_id', tenantId)
          .eq('active', true)
        anyoneInstructors = allInstr || []
        anyoneInstructors.forEach(i => { if (!allInstructorIds.includes(i.id)) allInstructorIds.push(i.id) })
      }
    }

    const endDateObj = new Date(startDate)
    endDateObj.setDate(endDateObj.getDate() + days)
    const endDateStr = endDateObj.toISOString().split('T')[0]

    // Fetch unavailability + existing appointments in parallel
    const queries = [
      supabaseAdmin
        .from('instructor_unavailability')
        .select('instructor_id, start_date, end_date')
        .eq('tenant_id', tenantId)
        .in('instructor_id', allInstructorIds.length ? allInstructorIds : ['00000000-0000-0000-0000-000000000000'])
        .lte('start_date', endDateStr)
        .gte('end_date', startDate),
      // Fetch ALL appointments for these instructors (cross-window conflict detection)
      supabaseAdmin
        .from('class_schedule')
        .select('id, instructor_id, starts_at, ends_at, availability_id, bookings(id, status)')
        .eq('tenant_id', tenantId)
        .eq('is_appointment', true)
        .eq('status', 'active')
        .gte('starts_at', new Date(startDate + 'T00:00:00Z').toISOString())
        .lte('starts_at', endDateObj.toISOString()),
    ]

    const [unavailRes, existingRes] = await Promise.all(queries)

    const unavailability = unavailRes.data || []
    const existingAppointments = existingRes.data || []

    // Build instructor booking map: instructor_id → [{ start, end }]
    // Used for cross-window conflict detection
    const instructorBookings = {}
    existingAppointments.forEach((appt) => {
      const confirmedCount = (appt.bookings || []).filter((b) => b.status === 'confirmed').length
      if (confirmedCount > 0 && appt.instructor_id) {
        if (!instructorBookings[appt.instructor_id]) instructorBookings[appt.instructor_id] = []
        instructorBookings[appt.instructor_id].push({
          start: new Date(appt.starts_at).getTime(),
          end: new Date(appt.ends_at).getTime(),
          count: confirmedCount,
        })
      }
    })

    // Also build per-window booking counts (for concurrent slots)
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

    // Generate slots
    const slots = []
    const now = new Date()

    for (let d = 0; d < days; d++) {
      const dateObj = new Date(startDate + 'T00:00:00Z')
      dateObj.setDate(dateObj.getDate() + d)
      const dayOfWeek = dateObj.getDay()
      const dateStr = dateObj.toISOString().split('T')[0]

      const dayWindows = windows.filter((w) => w.day_of_week === dayOfWeek)

      for (const window of dayWindows) {
        const bufferMs = (window.buffer_mins || 0) * 60000

        // For "anyone available" windows, check each eligible instructor
        if (!window.instructor_id) {
          const eligibleInstructors = anyoneInstructors.length > 0 ? anyoneInstructors : []

          // Generate time slots
          const [startH, startM] = window.start_time.split(':').map(Number)
          const [endH, endM] = window.end_time.split(':').map(Number)
          const windowStartMins = startH * 60 + startM
          const windowEndMins = endH * 60 + endM
          const duration = window.session_duration
          const step = duration + (window.buffer_mins || 0)

          for (let mins = windowStartMins; mins + duration <= windowEndMins; mins += step) {
            const slotH = Math.floor(mins / 60)
            const slotM = mins % 60
            const timeStr = `${String(slotH).padStart(2, '0')}:${String(slotM).padStart(2, '0')}`

            const slotDateTime = new Date(`${dateStr}T${timeStr}:00Z`)
            if (slotDateTime <= now) continue

            const slotStart = slotDateTime.getTime()
            const slotEnd = slotStart + duration * 60000

            // Count available instructors for this slot
            let availableCount = 0
            for (const instr of eligibleInstructors) {
              // Check unavailability
              const isUnavail = unavailability.some(
                (u) => u.instructor_id === instr.id && dateStr >= u.start_date && dateStr <= u.end_date
              )
              if (isUnavail) continue

              // Check cross-window conflicts (including buffer)
              const bookings = instructorBookings[instr.id] || []
              const hasConflict = bookings.some(b => {
                const bEndWithBuffer = b.end + bufferMs
                const slotStartWithBuffer = slotStart - bufferMs
                return slotStart < bEndWithBuffer && slotEnd > b.start
              })
              if (!hasConflict) availableCount++
            }

            if (availableCount <= 0) continue

            slots.push({
              availabilityId: window.id,
              instructorId: null,
              instructor: null,
              anyInstructor: true,
              availableInstructorCount: availableCount,
              location: window.locations,
              zone: window.zones,
              date: dateStr,
              time: timeStr,
              duration: window.session_duration,
              creditsCost: window.credits_cost,
              concurrentSlots: availableCount,
              slotsRemaining: availableCount,
              booked: 0,
              bufferMins: window.buffer_mins || 0,
            })
          }
          continue
        }

        // Standard instructor-specific window
        const isUnavailable = unavailability.some(
          (u) => u.instructor_id === window.instructor_id && dateStr >= u.start_date && dateStr <= u.end_date
        )
        if (isUnavailable) continue

        const [startH, startM] = window.start_time.split(':').map(Number)
        const [endH, endM] = window.end_time.split(':').map(Number)
        const windowStartMins = startH * 60 + startM
        const windowEndMins = endH * 60 + endM
        const duration = window.session_duration
        const step = duration + (window.buffer_mins || 0)

        for (let mins = windowStartMins; mins + duration <= windowEndMins; mins += step) {
          const slotH = Math.floor(mins / 60)
          const slotM = mins % 60
          const timeStr = `${String(slotH).padStart(2, '0')}:${String(slotM).padStart(2, '0')}`

          const slotDateTime = new Date(`${dateStr}T${timeStr}:00Z`)
          if (slotDateTime <= now) continue

          // Cross-window conflict check (including buffer)
          const slotStart = slotDateTime.getTime()
          const slotEnd = slotStart + duration * 60000
          const instrBookings = instructorBookings[window.instructor_id] || []
          const hasConflict = instrBookings.some(b => {
            const bEndWithBuffer = b.end + bufferMs
            return slotStart < bEndWithBuffer && slotEnd > b.start
          })
          if (hasConflict) continue

          // Per-window concurrent capacity
          const key = `${window.id}:${dateStr}:${timeStr}`
          const booked = bookingCounts[key] || 0
          const slotsRemaining = window.concurrent_slots - booked

          if (slotsRemaining <= 0) continue

          slots.push({
            availabilityId: window.id,
            instructorId: window.instructor_id,
            instructor: window.instructors,
            anyInstructor: false,
            location: window.locations,
            zone: window.zones,
            date: dateStr,
            time: timeStr,
            duration: window.session_duration,
            creditsCost: window.credits_cost,
            concurrentSlots: window.concurrent_slots,
            slotsRemaining,
            booked,
            bufferMins: window.buffer_mins || 0,
          })
        }
      }
    }

    // Unique instructors for filtering
    const uniqueInstructors = Object.values(
      windows.reduce((acc, w) => {
        if (w.instructors && !acc[w.instructor_id]) acc[w.instructor_id] = w.instructors
        return acc
      }, {})
    ).filter(Boolean)

    // Add anyone-available instructors
    anyoneInstructors.forEach(i => {
      if (!uniqueInstructors.find(u => u.id === i.id)) uniqueInstructors.push(i)
    })

    return NextResponse.json({ slots, instructors: uniqueInstructors })
  } catch (error) {
    console.error('[availability] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
