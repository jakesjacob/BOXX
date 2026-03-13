import { requireAuth } from '@/lib/api-helpers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendBookingConfirmation } from '@/lib/email'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  bookingId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
})

/**
 * POST /api/bookings/accept-invitation — Accept a pending class invitation
 */
export async function POST(request) {
  try {
    const authResult = await requireAuth()
    if (authResult.response) return authResult.response
    const { session, tenantId } = authResult

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { bookingId } = parsed.data
    const userId = session.user.id

    // Find the invited booking
    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from('bookings')
      .select('id, class_schedule_id, class_schedule(starts_at, status, class_types(name), instructors(name))')
      .eq('tenant_id', tenantId)
      .eq('id', bookingId)
      .eq('user_id', userId)
      .eq('status', 'invited')
      .single()

    if (!booking) {
      console.error('[accept-invitation] Booking not found:', { bookingId, userId, bookingErr })
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    // Check class is still active and in the future
    if (booking.class_schedule?.status !== 'active') {
      return NextResponse.json({ error: 'This class has been cancelled' }, { status: 400 })
    }
    if (new Date(booking.class_schedule.starts_at) <= new Date()) {
      return NextResponse.json({ error: 'This class has already started' }, { status: 400 })
    }

    // Find ALL credits for this user (no filtering on remaining — do it in JS)
    const now = new Date().toISOString()
    const { data: allCredits, error: creditsErr } = await supabaseAdmin
      .from('user_credits')
      .select('id, credits_remaining, credits_total, status, expires_at')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .order('expires_at', { ascending: true })

    // Filter to usable credits
    const usable = (allCredits || []).filter(
      (c) => c.status === 'active'
        && new Date(c.expires_at) > new Date()
        && (c.credits_remaining > 0 || c.credits_remaining === null)
    )

    if (!usable.length) {
      return NextResponse.json({
        error: 'No available credits. Purchase a class pack first.',
      }, { status: 400 })
    }

    const credit = usable[0]

    // Deduct credit atomically
    if (credit.credits_remaining !== null) {
      const { data: ok, error: rpcErr } = await supabaseAdmin.rpc('deduct_credit', { credit_id: credit.id })
      if (!ok) {
        return NextResponse.json({
          error: 'Credit deduction failed. Please try again.',
        }, { status: 400 })
      }
    }

    // Confirm the booking
    const { error } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'confirmed', credit_id: credit.id })
      .eq('tenant_id', tenantId)
      .eq('id', bookingId)

    if (error) {
      // Restore credit on failure
      if (credit.credits_remaining !== null) {
        await supabaseAdmin.rpc('restore_credit', { credit_id: credit.id }).catch(() => {})
      }
      return NextResponse.json({ error: 'Failed to confirm booking' }, { status: 500 })
    }

    // Send confirmation email
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email, name')
      .eq('tenant_id', tenantId)
      .eq('id', userId)
      .single()

    if (user?.email) {
      const startDate = new Date(booking.class_schedule.starts_at)
      sendBookingConfirmation({
        to: user.email,
        name: user.name,
        className: booking.class_schedule.class_types?.name || 'Class',
        instructor: booking.class_schedule.instructors?.name,
        date: startDate.toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok',
        }),
        time: startDate.toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok',
        }),
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, message: 'Invitation accepted! Your spot is confirmed.' })
  } catch (error) {
    console.error('[bookings/accept-invitation] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
