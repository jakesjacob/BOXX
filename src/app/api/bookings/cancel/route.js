import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const cancelSchema = z.object({
  bookingId: z.string().min(1),
})

/**
 * POST /api/bookings/cancel — Cancel a booking
 * Enforces 24h cancellation policy
 */
export async function POST(request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
        .eq('id', booking.credit_id)
        .single()

      if (credit && credit.credits_remaining !== null) {
        await supabaseAdmin
          .from('user_credits')
          .update({ credits_remaining: credit.credits_remaining + 1 })
          .eq('id', booking.credit_id)
      }
    }

    // Check waitlist — promote first person
    const { data: waitlistEntry } = await supabaseAdmin
      .from('waitlist')
      .select('*')
      .eq('class_schedule_id', booking.class_schedule_id)
      .eq('notified', false)
      .order('position', { ascending: true })
      .limit(1)
      .single()

    if (waitlistEntry) {
      await supabaseAdmin
        .from('waitlist')
        .update({ notified: true, notified_at: new Date().toISOString() })
        .eq('id', waitlistEntry.id)

      // TODO: Phase 6 — Send waitlist spot available email
      console.log(`[bookings/cancel] Waitlist notified: user=${waitlistEntry.user_id}`)
    }

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
