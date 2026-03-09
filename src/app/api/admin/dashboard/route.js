import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/dashboard — Aggregate stats for admin dashboard
 */
export async function GET(request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
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

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

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
    ])

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

    return NextResponse.json({
      stats: {
        totalMembers: membersRes.count || 0,
        activeCredits: totalActiveCredits,
        activeCreditsRecords: activeCreditsRes.count || 0,
        todayBookings: todayBookingsRes.count || 0,
        totalBookings: totalBookingsRes.count || 0,
        revenueThisMonth: revenue,
      },
      todayClasses,
      recentSignups: recentSignupsRes.data || [],
      lowCreditMembers: lowCreditRes.data || [],
    })
  } catch (error) {
    console.error('[admin/dashboard] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
