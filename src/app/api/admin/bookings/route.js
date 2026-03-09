import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/bookings — Get bookings with filters
 * Query params: status, date, classTypeId, page, limit
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
    const status = searchParams.get('status') // confirmed, cancelled, all
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    let query = supabaseAdmin
      .from('bookings')
      .select(`
        id, status, late_cancel, credit_returned, cancelled_at, created_at,
        users(id, name, email, avatar_url),
        class_schedule(id, starts_at, ends_at, class_types(name, color), instructors(name)),
        user_credits(id, class_packs(name))
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Filter by class date range via the joined class_schedule
    // We need to filter bookings where the class starts within the date range
    // Supabase doesn't support filtering on joined tables easily, so we'll do a two-step approach
    if (dateFrom || dateTo) {
      // Get class IDs in the date range
      let classQuery = supabaseAdmin.from('class_schedule').select('id')
      if (dateFrom) classQuery = classQuery.gte('starts_at', new Date(dateFrom).toISOString())
      if (dateTo) {
        const endDate = new Date(dateTo)
        endDate.setHours(23, 59, 59, 999)
        classQuery = classQuery.lte('starts_at', endDate.toISOString())
      }
      const { data: classIds } = await classQuery
      if (classIds && classIds.length > 0) {
        query = query.in('class_schedule_id', classIds.map((c) => c.id))
      } else {
        return NextResponse.json({ bookings: [], total: 0, page, limit })
      }
    }

    const { data: bookings, error, count } = await query

    if (error) {
      console.error('[admin/bookings] Error:', error)
      return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 })
    }

    return NextResponse.json({
      bookings: bookings || [],
      total: count || 0,
      page,
      limit,
    })
  } catch (error) {
    console.error('[admin/bookings] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
