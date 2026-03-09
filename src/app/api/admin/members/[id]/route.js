import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * GET /api/admin/members/:id — Full member detail
 */
export async function GET(request, { params }) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { id } = await params

    const [userRes, bookingsRes, creditsRes, waitlistRes] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('id, email, name, phone, avatar_url, bio, role, google_id, created_at')
        .eq('id', id)
        .single(),
      supabaseAdmin
        .from('bookings')
        .select('id, status, late_cancel, credit_returned, created_at, cancelled_at, class_schedule(id, starts_at, class_types(name, color), instructors(name))')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('user_credits')
        .select('id, credits_total, credits_remaining, expires_at, status, purchased_at, class_packs(name), stripe_payment_id')
        .eq('user_id', id)
        .order('purchased_at', { ascending: false }),
      supabaseAdmin
        .from('waitlist')
        .select('id, position, created_at, class_schedule(id, starts_at, class_types(name))')
        .eq('user_id', id)
        .order('created_at', { ascending: false }),
    ])

    if (!userRes.data) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Compute stats
    const bookings = bookingsRes.data || []
    const totalBookings = bookings.filter((b) => b.status === 'confirmed').length
    const cancelledBookings = bookings.filter((b) => b.status === 'cancelled').length
    const lastBooking = bookings.find((b) => b.status === 'confirmed')

    const credits = creditsRes.data || []
    const activeCredits = credits
      .filter((c) => c.status === 'active' && new Date(c.expires_at) > new Date())
      .reduce((sum, c) => sum + (c.credits_remaining ?? 0), 0)

    return NextResponse.json({
      member: userRes.data,
      bookings,
      credits,
      waitlist: waitlistRes.data || [],
      stats: {
        totalBookings,
        cancelledBookings,
        activeCredits,
        lastVisit: lastBooking?.class_schedule?.starts_at || null,
      },
    })
  } catch (error) {
    console.error('[admin/members/id] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

const editMemberSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).nullable().optional(),
  role: z.enum(['member', 'admin']).optional(),
})

/**
 * PUT /api/admin/members/:id — Edit member profile
 */
export async function PUT(request, { params }) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = editMemberSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const updates = {}
    if (parsed.data.name !== undefined) updates.name = parsed.data.name
    if (parsed.data.email !== undefined) updates.email = parsed.data.email.toLowerCase()
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone
    if (parsed.data.role !== undefined) updates.role = parsed.data.role

    const { error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', id)

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
      }
      console.error('[admin/members/id] Update error:', error)
      return NextResponse.json({ error: 'Failed to update member' }, { status: 500 })
    }

    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: session.user.id,
      action: 'edit_member',
      target_type: 'user',
      target_id: id,
      details: updates,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[admin/members/id] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/members/:id — Deactivate member (anonymize)
 */
export async function DELETE(request, { params }) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { id } = await params

    // Don't let admin delete themselves
    if (id === session.user.id) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 })
    }

    // Cancel future bookings
    await supabaseAdmin
      .from('bookings')
      .update({ status: 'cancelled', credit_returned: true })
      .eq('user_id', id)
      .eq('status', 'confirmed')

    // Remove from waitlists
    await supabaseAdmin.from('waitlist').delete().eq('user_id', id)

    // Void credits
    await supabaseAdmin
      .from('user_credits')
      .update({ credits_remaining: 0 })
      .eq('user_id', id)

    // Anonymize
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        email: `deactivated-${id}@removed.local`,
        name: 'Deactivated User',
        phone: null,
        bio: null,
        avatar_url: null,
        google_id: null,
        password_hash: null,
      })
      .eq('id', id)

    if (error) {
      console.error('[admin/members/id] Delete error:', error)
      return NextResponse.json({ error: 'Failed to deactivate member' }, { status: 500 })
    }

    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: session.user.id,
      action: 'deactivate_member',
      target_type: 'user',
      target_id: id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[admin/members/id] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
