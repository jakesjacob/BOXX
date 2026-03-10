import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/dashboard — Get all data for the member dashboard
 * Returns: user profile, active credits, class packs, upcoming schedule, user bookings
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const userId = session.user.id
    const now = new Date().toISOString()

    // Fetch all data in parallel
    const [
      userRes,
      creditsRes,
      packsRes,
      scheduleRes,
      bookingsRes,
    ] = await Promise.all([
      // User profile
      supabaseAdmin
        .from('users')
        .select('id, email, name, phone, avatar_url, bio, show_in_roster, google_id, created_at')
        .eq('id', userId)
        .single(),

      // Active credits
      supabaseAdmin
        .from('user_credits')
        .select('*, class_packs(name, is_membership)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('expires_at', now)
        .order('expires_at', { ascending: true }),

      // Available class packs
      supabaseAdmin
        .from('class_packs')
        .select('*')
        .eq('active', true)
        .order('display_order', { ascending: true }),

      // Upcoming classes (next 7 days)
      supabaseAdmin
        .from('class_schedule')
        .select(`
          *,
          class_types(id, name, description, duration_mins, color, icon),
          instructors(id, name, photo_url, bio)
        `)
        .eq('status', 'active')
        .gte('starts_at', now)
        .lte('starts_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('starts_at', { ascending: true }),

      // User's bookings (upcoming confirmed + recent past)
      supabaseAdmin
        .from('bookings')
        .select(`
          *,
          class_schedule(
            *,
            class_types(name, icon, color),
            instructors(name, photo_url)
          )
        `)
        .eq('user_id', userId)
        .in('status', ['confirmed', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(30),
    ])

    // Get booking counts for each scheduled class
    const scheduleIds = (scheduleRes.data || []).map((s) => s.id)
    let bookingCounts = {}
    let userBookedClasses = new Set()
    let userWaitlistClasses = {}

    if (scheduleIds.length > 0) {
      // Count confirmed bookings per class
      const { data: counts } = await supabaseAdmin
        .from('bookings')
        .select('class_schedule_id')
        .in('class_schedule_id', scheduleIds)
        .eq('status', 'confirmed')

      if (counts) {
        counts.forEach((b) => {
          bookingCounts[b.class_schedule_id] = (bookingCounts[b.class_schedule_id] || 0) + 1
        })
      }

      // Check which classes the user is booked into
      const { data: userBookings } = await supabaseAdmin
        .from('bookings')
        .select('class_schedule_id')
        .eq('user_id', userId)
        .in('class_schedule_id', scheduleIds)
        .eq('status', 'confirmed')

      if (userBookings) {
        userBookings.forEach((b) => userBookedClasses.add(b.class_schedule_id))
      }

      // Check waitlist positions
      const { data: waitlistEntries } = await supabaseAdmin
        .from('waitlist')
        .select('class_schedule_id, position')
        .eq('user_id', userId)
        .in('class_schedule_id', scheduleIds)

      if (waitlistEntries) {
        waitlistEntries.forEach((w) => {
          userWaitlistClasses[w.class_schedule_id] = w.position
        })
      }

      // Get roster data (attendees with avatars) for each class
      const { data: rosterData } = await supabaseAdmin
        .from('bookings')
        .select('class_schedule_id, users(id, name, avatar_url, bio, show_in_roster)')
        .in('class_schedule_id', scheduleIds)
        .eq('status', 'confirmed')

      // Attach roster to schedule
      const rosterByClass = {}
      if (rosterData) {
        rosterData.forEach((b) => {
          if (!rosterByClass[b.class_schedule_id]) {
            rosterByClass[b.class_schedule_id] = []
          }
          if (b.users?.show_in_roster !== false) {
            rosterByClass[b.class_schedule_id].push({
              id: b.users?.id,
              name: b.users?.name,
              avatar_url: b.users?.avatar_url,
              bio: b.users?.bio,
            })
          }
        })
      }

      // Attach counts, roster, and user status to schedule items
      if (scheduleRes.data) {
        scheduleRes.data = scheduleRes.data.map((cls) => ({
          ...cls,
          booked_count: bookingCounts[cls.id] || 0,
          spots_left: cls.capacity - (bookingCounts[cls.id] || 0),
          is_booked: userBookedClasses.has(cls.id),
          waitlist_position: userWaitlistClasses[cls.id] || null,
          roster: rosterByClass[cls.id] || [],
        }))
      }
    }

    // Get user's active waitlist entries with class details
    const { data: userWaitlist } = await supabaseAdmin
      .from('waitlist')
      .select(`
        id, position, created_at,
        class_schedule(
          id, starts_at, ends_at, status,
          class_types(name, icon, color),
          instructors(name)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    const activeWaitlist = (userWaitlist || []).filter(
      (w) => w.class_schedule?.status === 'active' && new Date(w.class_schedule.starts_at) > new Date()
    )

    // Separate bookings: active = class date in future, past = class date has passed
    const allBookings = bookingsRes.data || []
    const currentTime = new Date()
    const upcomingBookings = allBookings.filter(
      (b) => new Date(b.class_schedule?.starts_at) > currentTime
    )
    const pastBookings = allBookings.filter(
      (b) => new Date(b.class_schedule?.starts_at) <= currentTime
    )

    return NextResponse.json({
      user: userRes.data,
      credits: creditsRes.data || [],
      packs: packsRes.data || [],
      schedule: scheduleRes.data || [],
      upcomingBookings,
      pastBookings,
      waitlist: activeWaitlist,
    })
  } catch (error) {
    console.error('[dashboard] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
