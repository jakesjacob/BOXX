import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const cancelSchema = z.object({
  classId: z.string().min(1),
})

/**
 * POST /api/admin/schedule/cancel — Cancel a class
 *
 * Cascading effects:
 * 1. Set class_schedule.status = 'cancelled'
 * 2. Cancel all confirmed bookings for this class
 * 3. Return credits to each user's user_credits record
 * 4. Log in admin_audit_log
 */
export async function POST(request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const body = await request.json()
    const parsed = cancelSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { classId } = parsed.data

    // Verify the class exists and is active
    const { data: cls, error: clsError } = await supabaseAdmin
      .from('class_schedule')
      .select('id, status, starts_at, class_types(name)')
      .eq('id', classId)
      .single()

    if (clsError || !cls) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    if (cls.status === 'cancelled') {
      return NextResponse.json({ error: 'Class is already cancelled' }, { status: 400 })
    }

    // 1. Cancel the class
    const { error: cancelError } = await supabaseAdmin
      .from('class_schedule')
      .update({ status: 'cancelled' })
      .eq('id', classId)

    if (cancelError) {
      console.error('[admin/schedule/cancel] Cancel error:', cancelError)
      return NextResponse.json({ error: 'Failed to cancel class' }, { status: 500 })
    }

    // 2. Get all confirmed bookings for this class
    const { data: bookings } = await supabaseAdmin
      .from('bookings')
      .select('id, user_id, credit_id')
      .eq('class_schedule_id', classId)
      .eq('status', 'confirmed')

    let refundedCount = 0

    if (bookings && bookings.length > 0) {
      // 3. Cancel all bookings and return credits
      for (const booking of bookings) {
        // Cancel the booking
        await supabaseAdmin
          .from('bookings')
          .update({
            status: 'cancelled',
            credit_returned: true,
            cancelled_at: new Date().toISOString(),
          })
          .eq('id', booking.id)

        // Return credit if a credit was used
        if (booking.credit_id) {
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

          refundedCount++
        }
      }

      // Also remove any waitlist entries
      await supabaseAdmin
        .from('waitlist')
        .delete()
        .eq('class_schedule_id', classId)
    }

    // 4. Audit log
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: session.user.id,
      action: 'cancel_class',
      target_type: 'class_schedule',
      target_id: classId,
      details: {
        className: cls.class_types?.name,
        startsAt: cls.starts_at,
        bookingsCancelled: bookings?.length || 0,
        creditsRefunded: refundedCount,
      },
    })

    return NextResponse.json({
      success: true,
      bookingsCancelled: bookings?.length || 0,
      creditsRefunded: refundedCount,
    })
  } catch (error) {
    console.error('[admin/schedule/cancel] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
