import { requireAuth } from '@/lib/api-helpers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { promoteFromWaitlist } from '@/lib/waitlist'
import { sendCancellationConfirmation } from '@/lib/email'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const cancelSchema = z.object({
  bookingId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID'),
})

/**
 * POST /api/bookings/cancel — Cancel a booking
 * Enforces 24h cancellation policy
 */
export async function POST(request) {
  try {
    const authResult = await requireAuth()
    if (authResult.response) return authResult.response
    const { session, tenantId } = authResult

    const body = await request.json()
    const parsed = cancelSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { bookingId } = parsed.data
    const userId = session.user.id

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // Get booking — verify ownership
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('*, class_schedule(starts_at, class_types(name))')
      .eq('tenant_id', tenantId)
      .eq('id', bookingId)
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Check class hasn't already started
    const classStart = new Date(booking.class_schedule.starts_at)
    if (classStart <= new Date()) {
      return NextResponse.json({ error: 'Cannot cancel a class that has already started' }, { status: 400 })
    }

    // Determine if late cancellation (≤ 24 hours)
    const hoursUntilClass = (classStart.getTime() - Date.now()) / (1000 * 60 * 60)
    const isLateCancellation = hoursUntilClass <= 24

    // Update booking status
    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'cancelled',
        late_cancel: isLateCancellation,
        credit_returned: !isLateCancellation,
        cancelled_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', bookingId)

    if (updateError) {
      console.error('[bookings/cancel] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 })
    }

    // Return credit if free cancellation (> 24h)
    if (!isLateCancellation && booking.credit_id) {
      const { data: credit } = await supabaseAdmin
        .from('user_credits')
        .select('credits_remaining')
        .eq('tenant_id', tenantId)
        .eq('id', booking.credit_id)
        .single()

      if (credit && credit.credits_remaining !== null) {
        await supabaseAdmin
          .from('user_credits')
          .update({ credits_remaining: credit.credits_remaining + 1 })
          .eq('tenant_id', tenantId)
          .eq('id', booking.credit_id)
      }
    }

    // Send cancellation confirmation email (non-blocking)
    const { data: cancelUser } = await supabaseAdmin
      .from('users')
      .select('email, name')
      .eq('tenant_id', tenantId)
      .eq('id', userId)
      .single()

    if (cancelUser?.email) {
      const startDate = new Date(booking.class_schedule.starts_at)
      sendCancellationConfirmation({
        to: cancelUser.email,
        name: cancelUser.name,
        className: booking.class_schedule.class_types?.name || 'Class',
        date: startDate.toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok',
        }),
        time: startDate.toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok',
        }),
        creditRefunded: !isLateCancellation,
      }).catch((err) => console.error('[bookings/cancel] Email failed:', err))
    }

    // Promote first eligible waitlisted user into the spot
    promoteFromWaitlist(booking.class_schedule_id).catch((err) =>
      console.error('[bookings/cancel] Waitlist promotion error:', err)
    )

    return NextResponse.json({
      success: true,
      late_cancel: isLateCancellation,
      credit_returned: !isLateCancellation,
      message: isLateCancellation
        ? 'Booking cancelled. Credit was not returned (late cancellation).'
        : 'Booking cancelled. Your credit has been returned.',
    })
  } catch (error) {
    console.error('[bookings/cancel] Error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
