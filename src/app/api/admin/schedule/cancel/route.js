import { requireStaff } from '@/lib/api-helpers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendClassCancelledByAdmin } from '@/lib/email'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const cancelSchema = z.object({
  classId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID'),
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
    const result = await requireStaff(request)
    if (result.response) return result.response
    const { session, tenantId } = result

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
      .eq('tenant_id', tenantId)
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
        .eq('tenant_id', tenantId)
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
        .eq('tenant_id', tenantId)
        .eq('id', cId)

      if (cancelError) {
        console.error('[admin/schedule/cancel] Cancel error:', cancelError)
        continue
      }

      // 2. Get all confirmed bookings for this class
      // Get class details for email
      const { data: classDetail } = await supabaseAdmin
        .from('class_schedule')
        .select('starts_at, class_types(name)')
        .eq('tenant_id', tenantId)
        .eq('id', cId)
        .single()

      const { data: bookings } = await supabaseAdmin
        .from('bookings')
        .select('id, user_id, credit_id')
        .eq('tenant_id', tenantId)
        .eq('class_schedule_id', cId)
        .eq('status', 'confirmed')

      if (bookings && bookings.length > 0) {
        totalBookingsCancelled += bookings.length

        // 3. Batch cancel all bookings
        const bookingIds = bookings.map((b) => b.id)
        await supabaseAdmin
          .from('bookings')
          .update({
            status: 'cancelled',
            credit_returned: true,
            cancelled_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId)
          .in('id', bookingIds)

        // 4. Batch fetch credits and return them in parallel
        const creditIds = [...new Set(bookings.filter((b) => b.credit_id).map((b) => b.credit_id))]
        if (creditIds.length > 0) {
          const { data: credits } = await supabaseAdmin
            .from('user_credits')
            .select('id, credits_remaining')
            .eq('tenant_id', tenantId)
            .in('id', creditIds)

          if (credits) {
            await Promise.all(
              credits
                .filter((c) => c.credits_remaining !== null)
                .map((c) =>
                  supabaseAdmin
                    .from('user_credits')
                    .update({ credits_remaining: c.credits_remaining + 1 })
                    .eq('tenant_id', tenantId)
                    .eq('id', c.id)
                )
            )
            totalCreditsRefunded += creditIds.length
          }
        }

        // 5. Batch fetch users and send notification emails
        const userIds = [...new Set(bookings.map((b) => b.user_id))]
        const { data: memberUsers } = await supabaseAdmin
          .from('users')
          .select('id, email, name')
          .eq('tenant_id', tenantId)
          .in('id', userIds)

        if (memberUsers && classDetail) {
          const startDate = new Date(classDetail.starts_at)
          const dateStr = startDate.toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok',
          })
          const timeStr = startDate.toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok',
          })
          const className = classDetail.class_types?.name || 'Class'

          await Promise.allSettled(
            memberUsers
              .filter((u) => u.email)
              .map((u) =>
                sendClassCancelledByAdmin({
                  to: u.email,
                  name: u.name,
                  className,
                  date: dateStr,
                  time: timeStr,
                })
              )
          )
        }

        // Also remove any waitlist entries
        await supabaseAdmin
          .from('waitlist')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('class_schedule_id', cId)
      }
    }

    // 4. Audit log
    await supabaseAdmin.from('admin_audit_log').insert({
      tenant_id: tenantId,
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
