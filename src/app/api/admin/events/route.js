import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/events — Unified activity log for all user actions
 * Aggregates: bookings (created/cancelled), account signups, admin actions
 * Query params: type, dateFrom, dateTo, search, sort, page, limit
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
    const type = searchParams.get('type') || 'all' // booking, cancellation, signup, admin, all
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const search = searchParams.get('search') || ''
    const sort = searchParams.get('sort') || 'newest'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100)

    // If searching, find matching user IDs first
    let searchUserIds = null
    if (search) {
      const { data: matchedUsers } = await supabaseAdmin
        .from('users')
        .select('id')
        .or(`name.ilike.%${search}%,email.ilike.%${search}%`)
      searchUserIds = (matchedUsers || []).map((u) => u.id)
      if (searchUserIds.length === 0) {
        return NextResponse.json({ events: [], total: 0, page, limit })
      }
    }

    const events = []

    // 1. Booking events (created)
    if (type === 'all' || type === 'booking') {
      let q = supabaseAdmin
        .from('bookings')
        .select(`
          id, status, created_at,
          users(id, name, email, avatar_url),
          class_schedule(id, starts_at, class_types(name, color))
        `)
        .eq('status', 'confirmed')

      if (searchUserIds) q = q.in('user_id', searchUserIds)
      if (dateFrom) q = q.gte('created_at', new Date(dateFrom).toISOString())
      if (dateTo) {
        const end = new Date(dateTo)
        end.setHours(23, 59, 59, 999)
        q = q.lte('created_at', end.toISOString())
      }

      const { data } = await q
      ;(data || []).forEach((b) => {
        events.push({
          id: `booking-${b.id}`,
          type: 'booking',
          label: 'Booked a class',
          detail: b.class_schedule?.class_types?.name || 'Unknown class',
          color: b.class_schedule?.class_types?.color || '#c8a750',
          user: b.users,
          timestamp: b.created_at,
          meta: {
            classTime: b.class_schedule?.starts_at,
          },
        })
      })
    }

    // 2. Cancellation events
    if (type === 'all' || type === 'cancellation') {
      let q = supabaseAdmin
        .from('bookings')
        .select(`
          id, status, cancelled_at, late_cancel, created_at,
          users(id, name, email, avatar_url),
          class_schedule(id, starts_at, class_types(name, color))
        `)
        .eq('status', 'cancelled')

      if (searchUserIds) q = q.in('user_id', searchUserIds)
      if (dateFrom) q = q.gte('cancelled_at', new Date(dateFrom).toISOString())
      if (dateTo) {
        const end = new Date(dateTo)
        end.setHours(23, 59, 59, 999)
        q = q.lte('cancelled_at', end.toISOString())
      }

      const { data } = await q
      ;(data || []).forEach((b) => {
        events.push({
          id: `cancel-${b.id}`,
          type: 'cancellation',
          label: b.late_cancel ? 'Late cancelled' : 'Cancelled booking',
          detail: b.class_schedule?.class_types?.name || 'Unknown class',
          color: b.class_schedule?.class_types?.color || '#c8a750',
          user: b.users,
          timestamp: b.cancelled_at || b.created_at,
          meta: {
            classTime: b.class_schedule?.starts_at,
            lateCancel: b.late_cancel,
          },
        })
      })
    }

    // 3. Signup events (new accounts)
    if (type === 'all' || type === 'signup') {
      let q = supabaseAdmin
        .from('users')
        .select('id, name, email, avatar_url, created_at')
        .eq('role', 'member')

      if (searchUserIds) q = q.in('id', searchUserIds)
      if (dateFrom) q = q.gte('created_at', new Date(dateFrom).toISOString())
      if (dateTo) {
        const end = new Date(dateTo)
        end.setHours(23, 59, 59, 999)
        q = q.lte('created_at', end.toISOString())
      }

      const { data } = await q
      ;(data || []).forEach((u) => {
        events.push({
          id: `signup-${u.id}`,
          type: 'signup',
          label: 'Created account',
          detail: u.email,
          user: { id: u.id, name: u.name, email: u.email, avatar_url: u.avatar_url },
          timestamp: u.created_at,
        })
      })
    }

    // 4. Admin actions (from audit log)
    if (type === 'all' || type === 'admin') {
      let q = supabaseAdmin
        .from('admin_audit_log')
        .select('id, action, target_type, target_id, details, created_at')

      if (dateFrom) q = q.gte('created_at', new Date(dateFrom).toISOString())
      if (dateTo) {
        const end = new Date(dateTo)
        end.setHours(23, 59, 59, 999)
        q = q.lte('created_at', end.toISOString())
      }

      const { data } = await q
      ;(data || []).forEach((log) => {
        const actionLabels = {
          'booking_cancel': 'Admin cancelled booking',
          'create_class': 'Admin created class',
          'update_class': 'Admin updated class',
          'delete_class': 'Admin deleted class',
          'create_recurring_classes': 'Admin created recurring classes',
          'update_member': 'Admin updated member',
          'roster_remove': 'Admin removed from roster',
          'waitlist_promote': 'Admin promoted from waitlist',
          'waitlist_remove': 'Admin removed from waitlist',
        }

        events.push({
          id: `admin-${log.id}`,
          type: 'admin',
          label: actionLabels[log.action] || log.action.replace(/_/g, ' '),
          detail: `${log.target_type || ''}${log.target_id ? ` #${log.target_id.slice(0, 8)}` : ''}`,
          timestamp: log.created_at,
          meta: log.details,
        })
      })
    }

    // Sort all events by timestamp
    events.sort((a, b) => {
      const tA = new Date(a.timestamp).getTime()
      const tB = new Date(b.timestamp).getTime()
      return sort === 'oldest' ? tA - tB : tB - tA
    })

    const total = events.length
    const offset = (page - 1) * limit
    const paged = events.slice(offset, offset + limit)

    return NextResponse.json({ events: paged, total, page, limit })
  } catch (error) {
    console.error('[admin/events] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
