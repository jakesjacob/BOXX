import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/schedule?start=ISO&end=ISO — Get classes for a date range with booking/roster data
 */
export async function GET(request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
        class_types(id, name, description, duration_mins, color, icon),
        instructors(id, name, photo_url, bio)
      `)
      .eq('status', 'active')
      .gte('starts_at', startDate.toISOString())
      .lte('starts_at', endDate.toISOString())
      .order('starts_at', { ascending: true })

    if (scheduleError) {
      console.error('[schedule] Error:', scheduleError)
      return NextResponse.json({ error: 'Failed to load schedule' }, { status: 500 })
    }

    const schedule = scheduleData || []
    const scheduleIds = schedule.map((s) => s.id)

    if (scheduleIds.length === 0) {
      return NextResponse.json({ schedule: [] })
    }

    // Fetch booking counts, user bookings, waitlist, and roster in parallel
    const [countsRes, userBookingsRes, waitlistRes, rosterRes] = await Promise.all([
      supabaseAdmin
        .from('bookings')
        .select('class_schedule_id')
        .in('class_schedule_id', scheduleIds)
        .eq('status', 'confirmed'),
      supabaseAdmin
        .from('bookings')
        .select('class_schedule_id')
        .eq('user_id', userId)
        .in('class_schedule_id', scheduleIds)
        .eq('status', 'confirmed'),
      supabaseAdmin
        .from('waitlist')
        .select('class_schedule_id, position')
        .eq('user_id', userId)
        .in('class_schedule_id', scheduleIds),
      supabaseAdmin
        .from('bookings')
        .select('class_schedule_id, users(id, name, avatar_url, bio, show_in_roster)')
        .in('class_schedule_id', scheduleIds)
        .eq('status', 'confirmed'),
    ])

    const bookingCounts = {}
    ;(countsRes.data || []).forEach((b) => {
      bookingCounts[b.class_schedule_id] = (bookingCounts[b.class_schedule_id] || 0) + 1
    })

    const userBookedSet = new Set()
    ;(userBookingsRes.data || []).forEach((b) => userBookedSet.add(b.class_schedule_id))

    const userWaitlist = {}
    ;(waitlistRes.data || []).forEach((w) => {
      userWaitlist[w.class_schedule_id] = w.position
    })

    const rosterByClass = {}
    ;(rosterRes.data || []).forEach((b) => {
      if (!rosterByClass[b.class_schedule_id]) rosterByClass[b.class_schedule_id] = []
      if (b.users?.show_in_roster !== false) {
        rosterByClass[b.class_schedule_id].push({
          id: b.users?.id,
          name: b.users?.name,
          avatar_url: b.users?.avatar_url,
          bio: b.users?.bio,
        })
      }
    })

    const enriched = schedule.map((cls) => ({
      ...cls,
      booked_count: bookingCounts[cls.id] || 0,
      spots_left: cls.capacity - (bookingCounts[cls.id] || 0),
      is_booked: userBookedSet.has(cls.id),
      waitlist_position: userWaitlist[cls.id] || null,
      roster: rosterByClass[cls.id] || [],
    }))

    return NextResponse.json({ schedule: enriched })
  } catch (error) {
    console.error('[schedule] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
