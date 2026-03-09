import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const cancelSchema = z.object({
  classId: z.string().min(1),
  cancelAll: z.boolean().optional(), // Cancel all classes with same recurring_id
})

/**
 * POST /api/admin/schedule/cancel — Cancel a class (or all recurring)
 *
 * Cascading effects per class:
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

    const { classId, cancelAll } = parsed.data

    // Verify the class exists
    const { data: cls, error: clsError } = await supabaseAdmin
      .from('class_schedule')
      .select('id, status, starts_at, recurring_id, class_types(name)')
      .eq('id', classId)
      .single()

    if (clsError || !cls) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    // Determine which class IDs to cancel
    let classIds = [classId]

    if (cancelAll && cls.recurring_id) {
      // Get all active classes with the same recurring_id
      const { data: recurringClasses } = await supabaseAdmin
        .from('class_schedule')
        .select('id')
        .eq('recurring_id', cls.recurring_id)
        .eq('status', 'active')

      classIds = (recurringClasses || []).map((c) => c.id)
    }

    let totalBookingsCancelled = 0
    let totalCreditsRefunded = 0

    for (const cId of classIds) {
      // 1. Cancel the class
      const { error: cancelError } = await supabaseAdmin
        .from('class_schedule')
        .update({ status: 'cancelled' })
        .eq('id', cId)

      if (cancelError) {
        console.error('[admin/schedule/cancel] Cancel error:', cancelError)
        continue
      }

      // 2. Get all confirmed bookings for this class
      const { data: bookings } = await supabaseAdmin
        .from('bookings')
        .select('id, user_id, credit_id')
        .eq('class_schedule_id', cId)
        .eq('status', 'confirmed')

      if (bookings && bookings.length > 0) {
        // 3. Cancel all bookings and return credits
        for (const booking of bookings) {
          await supabaseAdmin
            .from('bookings')
            .update({
              status: 'cancelled',
              credit_returned: true,
              cancelled_at: new Date().toISOString(),
            })
            .eq('id', booking.id)

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

            totalCreditsRefunded++
          }
          totalBookingsCancelled++
        }

        // Also remove any waitlist entries
        await supabaseAdmin
          .from('waitlist')
          .delete()
          .eq('class_schedule_id', cId)
      }
    }

    // 4. Audit log
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: session.user.id,
      action: cancelAll ? 'cancel_recurring_classes' : 'cancel_class',
      target_type: 'class_schedule',
      target_id: classId,
      details: {
        className: cls.class_types?.name,
        startsAt: cls.starts_at,
        recurringId: cls.recurring_id || null,
        classesCancelled: classIds.length,
        bookingsCancelled: totalBookingsCancelled,
        creditsRefunded: totalCreditsRefunded,
      },
    })

    return NextResponse.json({
      success: true,
      classesCancelled: classIds.length,
      bookingsCancelled: totalBookingsCancelled,
      creditsRefunded: totalCreditsRefunded,
    })
  } catch (error) {
    console.error('[admin/schedule/cancel] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
