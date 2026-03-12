import { requireAuth } from '@/lib/api-helpers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/schedule?start=ISO&end=ISO — Get classes for a date range with booking/roster data
 */
export async function GET(request) {
  try {
    const authResult = await requireAuth()
    if (authResult.response) return authResult.response
    const { session, tenantId } = authResult

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!start || !end) {
      return NextResponse.json({ error: 'start and end params required' }, { status: 400 })
    }

    // Cap range to 31 days max
    const startDate = new Date(start)
    const endDate = new Date(end)
    if (endDate - startDate > 32 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Range too large (max 31 days)' }, { status: 400 })
    }

    const userId = session.user.id

    const { data: scheduleData, error: scheduleError } = await supabaseAdmin
      .from('class_schedule')
      .select(`
        *,
        class_types(id, name, description, duration_mins, color, icon, is_private),
        instructors(id, name, photo_url, bio)
      `)
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'cancelled'])
      .gte('starts_at', startDate.toISOString())
      .lte('starts_at', endDate.toISOString())
      .order('starts_at', { ascending: true })

    if (scheduleError) {
      console.error('[schedule] Error:', scheduleError)
      return NextResponse.json({ error: 'Failed to load schedule' }, { status: 500 })
    }

    // Filter out classes whose class_type is private, and hide classes that have already started
    const now = new Date()
    const schedule = (scheduleData || []).filter((cls) => !cls.class_types?.is_private && new Date(cls.starts_at) > now)
    const scheduleIds = schedule.map((s) => s.id)

    if (scheduleIds.length === 0) {
      return NextResponse.json({ schedule: [] })
    }

    // Fetch bookings + waitlist in parallel (previously 5 queries → now 2)
    const [allBookingsRes, allWaitlistRes] = await Promise.all([
      supabaseAdmin
        .from('bookings')
        .select('id, class_schedule_id, user_id, users(id, name, avatar_url, bio, show_in_roster)')
        .eq('tenant_id', tenantId)
        .in('class_schedule_id', scheduleIds)
        .eq('status', 'confirmed'),
      supabaseAdmin
        .from('waitlist')
        .select('class_schedule_id, position, user_id, users(id, name, avatar_url, show_in_roster)')
        .eq('tenant_id', tenantId)
        .in('class_schedule_id', scheduleIds)
        .order('position', { ascending: true }),
    ])

    // Derive counts, user bookings, and roster from single bookings result
    const bookingCounts = {}
    const userBookedMap = {}
    const rosterByClass = {}
    ;(allBookingsRes.data || []).forEach((b) => {
      bookingCounts[b.class_schedule_id] = (bookingCounts[b.class_schedule_id] || 0) + 1
      if (b.user_id === userId) {
        userBookedMap[b.class_schedule_id] = b.id
      }
      if (b.users?.show_in_roster !== false) {
        if (!rosterByClass[b.class_schedule_id]) rosterByClass[b.class_schedule_id] = []
        rosterByClass[b.class_schedule_id].push({
          id: b.users?.id,
          name: b.users?.name,
          avatar_url: b.users?.avatar_url,
          bio: b.users?.bio,
        })
      }
    })

    const userWaitlist = {}
    const waitlistByClass = {}
    ;(allWaitlistRes.data || []).forEach((w) => {
      if (w.user_id === userId) {
        userWaitlist[w.class_schedule_id] = w.position
      }
      if (w.users?.show_in_roster !== false) {
        if (!waitlistByClass[w.class_schedule_id]) waitlistByClass[w.class_schedule_id] = []
        waitlistByClass[w.class_schedule_id].push({
          id: w.users?.id,
          name: w.users?.name,
          avatar_url: w.users?.avatar_url,
          position: w.position,
        })
      }
    })

    const enriched = schedule.map((cls) => ({
      ...cls,
      booked_count: bookingCounts[cls.id] || 0,
      spots_left: cls.capacity - (bookingCounts[cls.id] || 0),
      is_booked: !!userBookedMap[cls.id],
      booking_id: userBookedMap[cls.id] || null,
      waitlist_position: userWaitlist[cls.id] || null,
      roster: rosterByClass[cls.id] || [],
      waitlist_roster: waitlistByClass[cls.id] || [],
    }))

    return NextResponse.json({ schedule: enriched })
  } catch (error) {
    console.error('[schedule] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
