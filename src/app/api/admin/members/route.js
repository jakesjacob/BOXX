import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * GET /api/admin/members — Get all members with search/filter
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
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || ''
    const hasCredits = searchParams.get('hasCredits') || ''
    const sort = searchParams.get('sort') || 'newest'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100)
    const offset = (page - 1) * limit

    const sortMap = {
      newest: { column: 'created_at', ascending: false },
      oldest: { column: 'created_at', ascending: true },
      name_asc: { column: 'name', ascending: true },
      name_desc: { column: 'name', ascending: false },
    }
    const sortConfig = sortMap[sort] || sortMap.newest

    let query = supabaseAdmin
      .from('users')
      .select('id, name, email, avatar_url, role, created_at, phone', { count: 'exact' })
      .order(sortConfig.column, { ascending: sortConfig.ascending })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
    }
    if (role) {
      query = query.eq('role', role)
    }

    const { data: members, error, count } = await query

    if (error) {
      console.error('[admin/members] Error:', error)
      return NextResponse.json({ error: 'Failed to load members' }, { status: 500 })
    }

    // Get active credits and booking counts for each member
    const memberIds = (members || []).map((m) => m.id)
    let creditsMap = {}
    let bookingCountMap = {}

    if (memberIds.length > 0) {
      const [creditsRes, bookingsRes] = await Promise.all([
        supabaseAdmin
          .from('user_credits')
          .select('user_id, credits_remaining')
          .in('user_id', memberIds)
          .eq('status', 'active')
          .gt('expires_at', new Date().toISOString()),
        supabaseAdmin
          .from('bookings')
          .select('user_id')
          .in('user_id', memberIds)
          .eq('status', 'confirmed'),
      ])

      ;(creditsRes.data || []).forEach((c) => {
        if (!creditsMap[c.user_id]) creditsMap[c.user_id] = 0
        if (c.credits_remaining !== null) creditsMap[c.user_id] += c.credits_remaining
      })

      ;(bookingsRes.data || []).forEach((b) => {
        bookingCountMap[b.user_id] = (bookingCountMap[b.user_id] || 0) + 1
      })
    }

    let enriched = (members || []).map((m) => ({
      ...m,
      activeCredits: creditsMap[m.id] || 0,
      totalBookings: bookingCountMap[m.id] || 0,
    }))

    // Client-side filters that depend on enriched data
    if (hasCredits === 'yes') {
      enriched = enriched.filter((m) => m.activeCredits > 0)
    } else if (hasCredits === 'no') {
      enriched = enriched.filter((m) => m.activeCredits === 0)
    }

    // Sort by enriched fields
    if (sort === 'most_credits') {
      enriched.sort((a, b) => b.activeCredits - a.activeCredits)
    } else if (sort === 'most_bookings') {
      enriched.sort((a, b) => b.totalBookings - a.totalBookings)
    }

    return NextResponse.json({
      members: enriched,
      total: hasCredits ? enriched.length : (count || 0),
      page,
      limit,
    })
  } catch (error) {
    console.error('[admin/members] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

const grantCreditsSchema = z.object({
  userId: z.string().min(1),
  packId: z.string().min(1),
  notes: z.string().optional(),
})

/**
 * POST /api/admin/members — Grant credits to a member (comp session)
 */
export async function POST(request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin' && session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const body = await request.json()
    const parsed = grantCreditsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { userId, packId, notes } = parsed.data

    // Get the pack details
    const { data: pack } = await supabaseAdmin
      .from('class_packs')
      .select('*')
      .eq('id', packId)
      .single()

    if (!pack) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 })
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + pack.validity_days)

    const { data: credit, error } = await supabaseAdmin
      .from('user_credits')
      .insert({
        user_id: userId,
        class_pack_id: packId,
        credits_total: pack.credits,
        credits_remaining: pack.credits,
        expires_at: expiresAt.toISOString(),
        stripe_payment_id: `admin_grant_${Date.now()}`,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      console.error('[admin/members] Grant error:', error)
      return NextResponse.json({ error: 'Failed to grant credits' }, { status: 500 })
    }

    // Audit log
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: session.user.id,
      action: 'grant_credits',
      target_type: 'user_credits',
      target_id: credit.id,
      details: { userId, packId, packName: pack.name, notes },
    })

    return NextResponse.json({ success: true, credit })
  } catch (error) {
    console.error('[admin/members] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
