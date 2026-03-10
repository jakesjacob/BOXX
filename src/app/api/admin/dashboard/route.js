import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/dashboard — Aggregate stats for admin dashboard
 */
export async function GET(request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin' && session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date') // optional: YYYY-MM-DD for class list day

    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    // If a specific date is requested for classes, use that instead of today
    const classesStart = dateParam ? new Date(dateParam + 'T00:00:00') : todayStart
    const classesEnd = dateParam ? new Date(dateParam + 'T23:59:59.999') : todayEnd

    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const fourteenDaysAgo = new Date(now)
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // Last week boundaries for week-over-week
    const lastWeekStart = new Date(now)
    lastWeekStart.setDate(lastWeekStart.getDate() - 14)
    const lastWeekEnd = new Date(now)
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 7)

    // Upcoming 7 days for "needs attention" classes
    const nextWeek = new Date(now)
    nextWeek.setDate(nextWeek.getDate() + 7)

    // Run all queries in parallel
    const [
      membersRes,
      activeCreditsRes,
      todayBookingsRes,
      todayClassesRes,
      revenueRes,
      recentSignupsRes,
      lowCreditRes,
      totalBookingsRes,
      recentCancelsRes,
      thisWeekBookingsRes,
      lastWeekBookingsRes,
      thisWeekSignupsRes,
      lastWeekSignupsRes,
      upcomingClassesRes,
    ] = await Promise.all([
      // Total members
      supabaseAdmin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'member'),

      // Active credit records
      supabaseAdmin
        .from('user_credits')
        .select('id, credits_remaining', { count: 'exact' })
        .eq('status', 'active')
        .gt('expires_at', now.toISOString()),

      // Today's bookings count
      supabaseAdmin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'confirmed')
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString()),

      // Classes for the requested day
      supabaseAdmin
        .from('class_schedule')
        .select('id, starts_at, ends_at, capacity, status, notes, class_types(name, color, duration_mins), instructors(name)')
        .gte('starts_at', classesStart.toISOString())
        .lte('starts_at', classesEnd.toISOString())
        .order('starts_at', { ascending: true }),

      // Revenue this month (sum of pack prices from user_credits purchased this month)
      supabaseAdmin
        .from('user_credits')
        .select('id, class_packs(price_thb)')
        .gte('purchased_at', monthStart.toISOString()),

      // Recent signups (last 7 days)
      supabaseAdmin
        .from('users')
        .select('id, name, email, avatar_url, created_at')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10),

      // Members with low credits (≤2 remaining, active packs only)
      supabaseAdmin
        .from('user_credits')
        .select('id, credits_remaining, expires_at, user_id, users(name, email), class_packs(name)')
        .eq('status', 'active')
        .gt('expires_at', now.toISOString())
        .lte('credits_remaining', 2)
        .not('credits_remaining', 'is', null)
        .order('credits_remaining', { ascending: true })
        .limit(10),

      // Total bookings all time
      supabaseAdmin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'confirmed'),

      // Recent cancellations (last 7 days)
      supabaseAdmin
        .from('bookings')
        .select(`
          id, status, cancelled_at, late_cancel,
          users(name, email),
          class_schedule(starts_at, class_types(name))
        `)
        .eq('status', 'cancelled')
        .gte('cancelled_at', sevenDaysAgo.toISOString())
        .order('cancelled_at', { ascending: false })
        .limit(10),

      // This week bookings (for week-over-week)
      supabaseAdmin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'confirmed')
        .gte('created_at', sevenDaysAgo.toISOString()),

      // Last week bookings (for week-over-week)
      supabaseAdmin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'confirmed')
        .gte('created_at', fourteenDaysAgo.toISOString())
        .lt('created_at', sevenDaysAgo.toISOString()),

      // This week signups
      supabaseAdmin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'member')
        .gte('created_at', sevenDaysAgo.toISOString()),

      // Last week signups
      supabaseAdmin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'member')
        .gte('created_at', fourteenDaysAgo.toISOString())
        .lt('created_at', sevenDaysAgo.toISOString()),

      // Upcoming classes (next 7 days) for "needs attention"
      supabaseAdmin
        .from('class_schedule')
        .select('id, starts_at, ends_at, capacity, status, class_types(name, color), instructors(name)')
        .eq('status', 'active')
        .gte('starts_at', now.toISOString())
        .lte('starts_at', nextWeek.toISOString())
        .order('starts_at', { ascending: true }),
    ])

    // ── Member Engagement ──────────────────────────────────────
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [topMembersBookingsRes, allMembersRes, allRecentBookingsRes] = await Promise.all([
      // Confirmed bookings in last 30 days (for top members)
      supabaseAdmin
        .from('bookings')
        .select('user_id')
        .eq('status', 'confirmed')
        .gte('created_at', thirtyDaysAgo.toISOString()),

      // All members with active credits
      supabaseAdmin
        .from('users')
        .select('id, name, email, avatar_url, created_at')
        .eq('role', 'member'),

      // Most recent confirmed booking per user (for inactivity check)
      supabaseAdmin
        .from('bookings')
        .select('user_id, created_at')
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false }),
    ])

    // Top members: count bookings per user in last 30 days
    const bookingCountByUser = {}
    ;(topMembersBookingsRes.data || []).forEach((b) => {
      bookingCountByUser[b.user_id] = (bookingCountByUser[b.user_id] || 0) + 1
    })

    const allMembers = allMembersRes.data || []
    const memberMap = Object.fromEntries(allMembers.map((m) => [m.id, m]))

    const topMembers = Object.entries(bookingCountByUser)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([userId, count]) => ({
        ...memberMap[userId],
        bookings_30d: count,
      }))
      .filter((m) => m.id) // exclude if user was deleted

    // Last booking date per user
    const lastBookingByUser = {}
    ;(allRecentBookingsRes.data || []).forEach((b) => {
      if (!lastBookingByUser[b.user_id]) {
        lastBookingByUser[b.user_id] = b.created_at // first match = most recent (ordered desc)
      }
    })

    // Get active credit packs for all members
    const { data: allActiveCredits } = await supabaseAdmin
      .from('user_credits')
      .select('user_id, credits_remaining, expires_at, class_packs(name)')
      .eq('status', 'active')
      .gt('expires_at', now.toISOString())

    // Build credits summary per user
    const creditsByUser = {}
    ;(allActiveCredits || []).forEach((uc) => {
      if (!creditsByUser[uc.user_id]) creditsByUser[uc.user_id] = { total: 0, packs: [] }
      if (uc.credits_remaining !== null) {
        creditsByUser[uc.user_id].total += uc.credits_remaining
      }
      creditsByUser[uc.user_id].packs.push({
        name: uc.class_packs?.name,
        credits: uc.credits_remaining,
        expires_at: uc.expires_at,
      })
    })

    // At-risk members: have active credits but no booking in 14+ days
    const fourteenDaysAgoMs = now.getTime() - 14 * 24 * 60 * 60 * 1000
    const atRiskMembers = allMembers
      .filter((m) => {
        const hasCredits = creditsByUser[m.id]?.total > 0
        if (!hasCredits) return false
        const lastBooking = lastBookingByUser[m.id]
        if (!lastBooking) return true // never booked but has credits
        return new Date(lastBooking).getTime() < fourteenDaysAgoMs
      })
      .map((m) => {
        const lastBooking = lastBookingByUser[m.id]
        const daysSince = lastBooking
          ? Math.floor((now.getTime() - new Date(lastBooking).getTime()) / (1000 * 60 * 60 * 24))
          : null
        return {
          id: m.id,
          name: m.name,
          email: m.email,
          avatar_url: m.avatar_url,
          days_inactive: daysSince,
          never_booked: !lastBooking,
          credits_remaining: creditsByUser[m.id]?.total || 0,
          last_booking: lastBooking || null,
        }
      })
      .sort((a, b) => {
        // Never booked first, then by longest inactivity
        if (a.never_booked && !b.never_booked) return -1
        if (!a.never_booked && b.never_booked) return 1
        return (b.days_inactive || 999) - (a.days_inactive || 999)
      })
      .slice(0, 10)

    // Get booking counts + roster + waitlist for today's classes
    let todayClasses = todayClassesRes.data || []
    if (todayClasses.length > 0) {
      const classIds = todayClasses.map((c) => c.id)
      const [bookingsRes, waitlistRes] = await Promise.all([
        supabaseAdmin
          .from('bookings')
          .select('id, class_schedule_id, status, users(id, name, avatar_url, email)')
          .in('class_schedule_id', classIds)
          .eq('status', 'confirmed'),
        supabaseAdmin
          .from('waitlist')
          .select('class_schedule_id, position, users(id, name, avatar_url, email)')
          .in('class_schedule_id', classIds)
          .order('position', { ascending: true }),
      ])

      const countMap = {}
      const rosterMap = {}
      ;(bookingsRes.data || []).forEach((b) => {
          countMap[b.class_schedule_id] = (countMap[b.class_schedule_id] || 0) + 1
        if (!rosterMap[b.class_schedule_id]) rosterMap[b.class_schedule_id] = []
        rosterMap[b.class_schedule_id].push({
          id: b.users?.id,
          name: b.users?.name,
          avatar_url: b.users?.avatar_url,
          email: b.users?.email,
          status: b.status,
          booking_id: b.id,
        })
      })

      const waitlistMap = {}
      ;(waitlistRes.data || []).forEach((w) => {
        if (!waitlistMap[w.class_schedule_id]) waitlistMap[w.class_schedule_id] = []
        waitlistMap[w.class_schedule_id].push({
          id: w.users?.id,
          name: w.users?.name,
          avatar_url: w.users?.avatar_url,
          email: w.users?.email,
          position: w.position,
        })
      })

      todayClasses = todayClasses.map((c) => ({
        ...c,
        booked: countMap[c.id] || 0,
        roster: rosterMap[c.id] || [],
        waitlist: waitlistMap[c.id] || [],
      }))
    }

    // Calculate revenue
    const revenue = (revenueRes.data || []).reduce((sum, uc) => {
      return sum + (uc.class_packs?.price_thb || 0)
    }, 0)

    // Calculate total active credits
    const totalActiveCredits = (activeCreditsRes.data || []).reduce((sum, uc) => {
      if (uc.credits_remaining === null) return sum // skip unlimited
      return sum + (uc.credits_remaining || 0)
    }, 0)

    // Week-over-week trends
    const thisWeekBookings = thisWeekBookingsRes.count || 0
    const lastWeekBookings = lastWeekBookingsRes.count || 0
    const thisWeekSignups = thisWeekSignupsRes.count || 0
    const lastWeekSignups = lastWeekSignupsRes.count || 0

    // Upcoming classes needing attention (get booking counts)
    let attentionClasses = []
    const upcomingClasses = upcomingClassesRes.data || []
    if (upcomingClasses.length > 0) {
      const upcomingIds = upcomingClasses.map((c) => c.id)
      const { data: upcomingBookings } = await supabaseAdmin
        .from('bookings')
        .select('class_schedule_id')
        .in('class_schedule_id', upcomingIds)
        .eq('status', 'confirmed')

      const upcomingCounts = {}
      ;(upcomingBookings || []).forEach((b) => {
        upcomingCounts[b.class_schedule_id] = (upcomingCounts[b.class_schedule_id] || 0) + 1
      })

      attentionClasses = upcomingClasses
        .map((c) => ({
          id: c.id,
          starts_at: c.starts_at,
          class_name: c.class_types?.name || 'Class',
          color: c.class_types?.color,
          instructor: c.instructors?.name || 'TBA',
          capacity: c.capacity,
          booked: upcomingCounts[c.id] || 0,
          fill_pct: c.capacity > 0 ? Math.round(((upcomingCounts[c.id] || 0) / c.capacity) * 100) : 0,
        }))
        .filter((c) => c.fill_pct >= 90 || c.fill_pct <= 25)
        .sort((a, b) => b.fill_pct - a.fill_pct)
        .slice(0, 8)
    }

    return NextResponse.json({
      stats: {
        totalMembers: membersRes.count || 0,
        activeCredits: totalActiveCredits,
        activeCreditsRecords: activeCreditsRes.count || 0,
        todayBookings: todayBookingsRes.count || 0,
        totalBookings: totalBookingsRes.count || 0,
        revenueThisMonth: revenue,
      },
      trends: {
        bookings: { thisWeek: thisWeekBookings, lastWeek: lastWeekBookings },
        signups: { thisWeek: thisWeekSignups, lastWeek: lastWeekSignups },
      },
      todayClasses,
      recentSignups: recentSignupsRes.data || [],
      recentCancellations: recentCancelsRes.data || [],
      attentionClasses,
      lowCreditMembers: lowCreditRes.data || [],
      engagement: {
        topMembers,
        atRiskMembers,
      },
    })
  } catch (error) {
    console.error('[admin/dashboard] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
