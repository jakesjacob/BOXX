import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/analytics — Aggregated analytics for admin dashboard
 * Query: ?range=7d|30d|90d (default 30d)
 */
export async function GET(request) {
  try {
    const session = await auth()
    if (!session || (session.user.role !== 'owner' && session.user.role !== 'admin' && session.user.role !== 'employee')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '30d'

    // Parse range into days
    const rangeDays = range === '7d' ? 7 : range === '90d' ? 90 : 30

    // Calculate date boundaries in Bangkok timezone
    const todayBangkok = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    const currentEnd = todayBangkok + 'T23:59:59+07:00'

    const currentStartDate = new Date(todayBangkok + 'T00:00:00+07:00')
    currentStartDate.setDate(currentStartDate.getDate() - rangeDays)
    const currentStart = currentStartDate.toISOString()

    const prevStartDate = new Date(currentStartDate)
    prevStartDate.setDate(prevStartDate.getDate() - rangeDays)
    const prevStart = prevStartDate.toISOString()
    const prevEnd = currentStartDate.toISOString()

    // Run all queries in parallel
    const [
      webAnalytics,
      businessAnalytics,
    ] = await Promise.all([
      getWebAnalytics(currentStart, currentEnd, prevStart, prevEnd, rangeDays, todayBangkok),
      getBusinessAnalytics(currentStart, currentEnd, prevStart, prevEnd, rangeDays, todayBangkok),
    ])

    return NextResponse.json({
      range,
      rangeDays,
      currentStart,
      currentEnd: todayBangkok + 'T23:59:59+07:00',
      web: webAnalytics,
      business: businessAnalytics,
    })
  } catch (error) {
    console.error('[analytics] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}

// ─────────────────────────────────────
// WEB ANALYTICS (from page_views table)
// ─────────────────────────────────────
async function getWebAnalytics(currentStart, currentEnd, prevStart, prevEnd, rangeDays, todayBangkok) {
  // Check if page_views table exists by attempting a query
  const { data: pvTest, error: pvError } = await supabaseAdmin
    .from('page_views')
    .select('id', { count: 'exact', head: true })
    .limit(0)

  if (pvError) {
    // Table likely doesn't exist yet — return empty analytics
    return {
      pageViews: { current: 0, previous: 0, change: 0 },
      viewsByDay: [],
      topPages: [],
      topReferrers: [],
      deviceBreakdown: { mobile: 0, desktop: 0, tablet: 0 },
      utmSources: [],
    }
  }

  // Run all web analytics queries in parallel
  const [
    currentViewsRes,
    prevViewsRes,
    allViewsInRange,
  ] = await Promise.all([
    // Total page views in current range
    supabaseAdmin
      .from('page_views')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', currentStart)
      .lte('created_at', currentEnd),

    // Total page views in previous range
    supabaseAdmin
      .from('page_views')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', prevStart)
      .lt('created_at', currentStart),

    // All views in range for aggregation
    supabaseAdmin
      .from('page_views')
      .select('path, referrer, device_type, utm_source, created_at')
      .gte('created_at', currentStart)
      .lte('created_at', currentEnd)
      .order('created_at', { ascending: true }),
  ])

  const currentViews = currentViewsRes.count || 0
  const prevViews = prevViewsRes.count || 0
  const change = prevViews > 0 ? Math.round(((currentViews - prevViews) / prevViews) * 100) : (currentViews > 0 ? 100 : 0)

  const views = allViewsInRange.data || []

  // Views by day
  const viewsByDayMap = {}
  // Initialize all days in range
  for (let i = rangeDays; i >= 0; i--) {
    const d = new Date(todayBangkok + 'T00:00:00+07:00')
    d.setDate(d.getDate() - i)
    const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    viewsByDayMap[key] = 0
  }
  for (const v of views) {
    const day = new Date(v.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    if (viewsByDayMap[day] !== undefined) {
      viewsByDayMap[day]++
    }
  }
  const viewsByDay = Object.entries(viewsByDayMap).map(([date, count]) => ({ date, views: count }))

  // Top pages
  const pageCounts = {}
  for (const v of views) {
    const p = v.path || '/'
    pageCounts[p] = (pageCounts[p] || 0) + 1
  }
  const topPages = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, views]) => ({ path, views }))

  // Top referrers (parse hostname, exclude empty and self)
  const refCounts = {}
  for (const v of views) {
    if (!v.referrer) continue
    try {
      const hostname = new URL(v.referrer).hostname
      if (!hostname || hostname.includes('boxxthailand') || hostname.includes('localhost')) continue
      refCounts[hostname] = (refCounts[hostname] || 0) + 1
    } catch {
      // Skip malformed URLs
    }
  }
  const topReferrers = Object.entries(refCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, views]) => ({ domain, views }))

  // Device breakdown
  const deviceBreakdown = { mobile: 0, desktop: 0, tablet: 0 }
  for (const v of views) {
    const dt = (v.device_type || 'desktop').toLowerCase()
    if (dt === 'mobile') deviceBreakdown.mobile++
    else if (dt === 'tablet') deviceBreakdown.tablet++
    else deviceBreakdown.desktop++
  }

  // UTM sources
  const utmCounts = {}
  for (const v of views) {
    if (!v.utm_source) continue
    utmCounts[v.utm_source] = (utmCounts[v.utm_source] || 0) + 1
  }
  const utmSources = Object.entries(utmCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([source, views]) => ({ source, views }))

  return {
    pageViews: { current: currentViews, previous: prevViews, change },
    viewsByDay,
    topPages,
    topReferrers,
    deviceBreakdown,
    utmSources,
  }
}

// ─────────────────────────────────────
// BUSINESS ANALYTICS
// ─────────────────────────────────────
async function getBusinessAnalytics(currentStart, currentEnd, prevStart, prevEnd, rangeDays, todayBangkok) {
  const [
    totalMembersRes,
    newMembersCurrentRes,
    newMembersPrevRes,
    activeMembersRes,
    bookingsCurrentRes,
    bookingsPrevRes,
    revenueCurrentRes,
    revenuePrevRes,
    classPerformanceRes,
    packSalesRes,
    instructorStatsRes,
    allBookingsInRange,
  ] = await Promise.all([
    // Total members
    supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'member'),

    // New members in current range
    supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'member')
      .gte('created_at', currentStart)
      .lte('created_at', currentEnd),

    // New members in previous range
    supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'member')
      .gte('created_at', prevStart)
      .lt('created_at', currentStart),

    // Active members (distinct users with confirmed bookings in range)
    supabaseAdmin
      .from('bookings')
      .select('user_id')
      .eq('status', 'confirmed')
      .gte('created_at', currentStart)
      .lte('created_at', currentEnd),

    // Bookings in current range
    supabaseAdmin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', currentStart)
      .lte('created_at', currentEnd),

    // Bookings in previous range
    supabaseAdmin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', prevStart)
      .lt('created_at', currentStart),

    // Revenue: user_credits purchased in current range, join class_packs for price
    supabaseAdmin
      .from('user_credits')
      .select('class_pack_id, class_packs(price_thb)')
      .gte('purchased_at', currentStart)
      .lte('purchased_at', currentEnd),

    // Revenue: previous range
    supabaseAdmin
      .from('user_credits')
      .select('class_pack_id, class_packs(price_thb)')
      .gte('purchased_at', prevStart)
      .lt('purchased_at', currentStart),

    // Class performance: bookings in range joined with schedule and class_types
    supabaseAdmin
      .from('bookings')
      .select('class_schedule_id, class_schedule(class_type_id, capacity, class_types(name))')
      .eq('status', 'confirmed')
      .gte('created_at', currentStart)
      .lte('created_at', currentEnd),

    // Pack sales in range
    supabaseAdmin
      .from('user_credits')
      .select('class_pack_id, class_packs(name, price_thb)')
      .gte('purchased_at', currentStart)
      .lte('purchased_at', currentEnd),

    // Instructor stats: classes in range with bookings
    supabaseAdmin
      .from('class_schedule')
      .select('id, instructor_id, instructors(name), starts_at')
      .gte('starts_at', currentStart)
      .lte('starts_at', currentEnd)
      .eq('status', 'active'),

    // All bookings in range for daily chart
    supabaseAdmin
      .from('bookings')
      .select('created_at')
      .gte('created_at', currentStart)
      .lte('created_at', currentEnd)
      .order('created_at', { ascending: true }),
  ])

  // Total members
  const totalMembers = totalMembersRes.count || 0

  // New members with % change
  const newMembersCurrent = newMembersCurrentRes.count || 0
  const newMembersPrev = newMembersPrevRes.count || 0
  const newMembersChange = newMembersPrev > 0
    ? Math.round(((newMembersCurrent - newMembersPrev) / newMembersPrev) * 100)
    : (newMembersCurrent > 0 ? 100 : 0)

  // Active members (distinct user_ids)
  const activeUserIds = new Set((activeMembersRes.data || []).map(b => b.user_id))
  const activeMembers = activeUserIds.size

  // Bookings with % change
  const bookingsCurrent = bookingsCurrentRes.count || 0
  const bookingsPrev = bookingsPrevRes.count || 0
  const bookingsChange = bookingsPrev > 0
    ? Math.round(((bookingsCurrent - bookingsPrev) / bookingsPrev) * 100)
    : (bookingsCurrent > 0 ? 100 : 0)

  // Revenue with % change
  const revenueCurrent = (revenueCurrentRes.data || []).reduce((sum, uc) => {
    return sum + (uc.class_packs?.price_thb || 0)
  }, 0)
  const revenuePrev = (revenuePrevRes.data || []).reduce((sum, uc) => {
    return sum + (uc.class_packs?.price_thb || 0)
  }, 0)
  const revenueChange = revenuePrev > 0
    ? Math.round(((revenueCurrent - revenuePrev) / revenuePrev) * 100)
    : (revenueCurrent > 0 ? 100 : 0)

  // Class performance — top 10 by booking count with fill rate
  const classMap = {}
  for (const b of (classPerformanceRes.data || [])) {
    const schedule = b.class_schedule
    if (!schedule || !schedule.class_types) continue
    const name = schedule.class_types.name
    if (!classMap[name]) {
      classMap[name] = { name, bookings: 0, scheduleIds: new Set(), totalCapacity: 0 }
    }
    classMap[name].bookings++
    if (!classMap[name].scheduleIds.has(b.class_schedule_id)) {
      classMap[name].scheduleIds.add(b.class_schedule_id)
      classMap[name].totalCapacity += (schedule.capacity || 6)
    }
  }
  const classPerformance = Object.values(classMap)
    .map(c => ({
      name: c.name,
      bookings: c.bookings,
      avgFillRate: c.totalCapacity > 0 ? Math.round((c.bookings / c.totalCapacity) * 100) : 0,
    }))
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 10)

  // Pack sales
  const packMap = {}
  for (const uc of (packSalesRes.data || [])) {
    const packName = uc.class_packs?.name || 'Unknown'
    const price = uc.class_packs?.price_thb || 0
    if (!packMap[packName]) {
      packMap[packName] = { name: packName, count: 0, revenue: 0 }
    }
    packMap[packName].count++
    packMap[packName].revenue += price
  }
  const packSales = Object.values(packMap).sort((a, b) => b.revenue - a.revenue)

  // Instructor stats
  const scheduleIds = (instructorStatsRes.data || []).map(s => s.id)
  let instructorBookingCounts = {}

  if (scheduleIds.length > 0) {
    // Get booking counts per schedule in this range
    const { data: instrBookings } = await supabaseAdmin
      .from('bookings')
      .select('class_schedule_id')
      .eq('status', 'confirmed')
      .in('class_schedule_id', scheduleIds)

    for (const b of (instrBookings || [])) {
      instructorBookingCounts[b.class_schedule_id] = (instructorBookingCounts[b.class_schedule_id] || 0) + 1
    }
  }

  const instrMap = {}
  for (const s of (instructorStatsRes.data || [])) {
    if (!s.instructors) continue
    const name = s.instructors.name
    if (!instrMap[name]) {
      instrMap[name] = { name, classesTaught: 0, totalBookings: 0 }
    }
    instrMap[name].classesTaught++
    instrMap[name].totalBookings += (instructorBookingCounts[s.id] || 0)
  }
  const instructorStats = Object.values(instrMap).sort((a, b) => b.totalBookings - a.totalBookings)

  // Bookings by day
  const bookingsByDayMap = {}
  for (let i = rangeDays; i >= 0; i--) {
    const d = new Date(todayBangkok + 'T00:00:00+07:00')
    d.setDate(d.getDate() - i)
    const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    bookingsByDayMap[key] = 0
  }
  for (const b of (allBookingsInRange.data || [])) {
    const day = new Date(b.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    if (bookingsByDayMap[day] !== undefined) {
      bookingsByDayMap[day]++
    }
  }
  const bookingsByDay = Object.entries(bookingsByDayMap).map(([date, count]) => ({ date, count }))

  return {
    totalMembers,
    newMembers: { current: newMembersCurrent, previous: newMembersPrev, change: newMembersChange },
    activeMembers,
    totalBookings: { current: bookingsCurrent, previous: bookingsPrev, change: bookingsChange },
    revenue: { current: revenueCurrent, previous: revenuePrev, change: revenueChange },
    classPerformance,
    packSales,
    instructorStats,
    bookingsByDay,
  }
}
