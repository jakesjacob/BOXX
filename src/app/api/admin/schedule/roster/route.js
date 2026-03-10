import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { promoteFromWaitlist } from '@/lib/waitlist'
import { sendRemovedFromClass, sendPrivateClassInvitation } from '@/lib/email'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const addMemberSchema = z.object({
  classId: z.string().min(1),
  userId: z.string().min(1),
})

const removeMemberSchema = z.object({
  classId: z.string().min(1),
  userId: z.string().min(1),
  refundCredit: z.boolean().optional(),
  fromWaitlist: z.boolean().optional(),
})

/**
 * POST /api/admin/schedule/roster — Add a member to a class (bypass capacity/credits)
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
    const parsed = addMemberSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { classId, userId } = parsed.data

    // Check if already booked
    const { data: existing } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('class_schedule_id', classId)
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Member already booked into this class' }, { status: 400 })
    }

    // Create booking without requiring credits (admin override)
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .insert({
        user_id: userId,
        class_schedule_id: classId,
        credit_id: null, // admin override — no credit deducted
        status: 'confirmed',
      })
      .select('id')
      .single()

    if (error) {
      console.error('[admin/roster] Add error:', error)
      return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
    }

    // Remove from waitlist if they were on it
    await supabaseAdmin
      .from('waitlist')
      .delete()
      .eq('class_schedule_id', classId)
      .eq('user_id', userId)

    // Send private class invitation email if class is private (non-blocking)
    const { data: rosterClass } = await supabaseAdmin
      .from('class_schedule')
      .select('starts_at, is_private, class_types(name), instructors(name)')
      .eq('id', classId)
      .single()

    if (rosterClass?.is_private) {
      const { data: addedUser } = await supabaseAdmin
        .from('users')
        .select('email, name')
        .eq('id', userId)
        .single()

      if (addedUser?.email) {
        const startDate = new Date(rosterClass.starts_at)
        sendPrivateClassInvitation({
          to: addedUser.email,
          name: addedUser.name,
          className: rosterClass.class_types?.name || 'Private Session',
          instructor: rosterClass.instructors?.name,
          date: startDate.toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok',
          }),
          time: startDate.toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok',
          }),
        }).catch((err) => console.error('[admin/roster] Invitation email failed:', err))
      }
    }

    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: session.user.id,
      action: 'admin_add_to_class',
      target_type: 'booking',
      target_id: booking.id,
      details: { classId, userId },
    })

    return NextResponse.json({ success: true, bookingId: booking.id })
  } catch (error) {
    console.error('[admin/roster] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/schedule/roster — Remove a member from a class
 */
export async function DELETE(request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin' && session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const body = await request.json()
    const parsed = removeMemberSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { classId, userId, refundCredit, fromWaitlist } = parsed.data

    // Handle waitlist removal
    if (fromWaitlist) {
      const { error: wlError } = await supabaseAdmin
        .from('waitlist')
        .delete()
        .eq('class_schedule_id', classId)
        .eq('user_id', userId)

      if (wlError) {
        console.error('[admin/roster] Waitlist remove error:', wlError)
        return NextResponse.json({ error: 'Failed to remove from waitlist' }, { status: 500 })
      }

      await supabaseAdmin.from('admin_audit_log').insert({
        admin_id: session.user.id,
        action: 'admin_remove_from_waitlist',
        target_type: 'waitlist',
        target_id: classId,
        details: { classId, userId },
      })

      return NextResponse.json({ success: true })
    }

    // Find the booking
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('id, credit_id')
      .eq('class_schedule_id', classId)
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .maybeSingle()

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Cancel the booking
    await supabaseAdmin
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        credit_returned: refundCredit !== false,
      })
      .eq('id', booking.id)

    // Refund credit if applicable
    if (refundCredit !== false && booking.credit_id) {
      const { data: credit } = await supabaseAdmin
        .from('user_credits')
        .select('id, credits_remaining')
        .eq('id', booking.credit_id)
        .single()

      if (credit && credit.credits_remaining !== null) {
        await supabaseAdmin
          .from('user_credits')
          .update({ credits_remaining: credit.credits_remaining + 1 })
          .eq('id', credit.id)
      }
    }

    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: session.user.id,
      action: 'admin_remove_from_class',
      target_type: 'booking',
      target_id: booking.id,
      details: { classId, userId, refundCredit },
    })

    // Send removal notification email (non-blocking)
    const { data: removeClass } = await supabaseAdmin
      .from('class_schedule')
      .select('starts_at, class_types(name)')
      .eq('id', classId)
      .single()

    const { data: removedUser } = await supabaseAdmin
      .from('users')
      .select('email, name')
      .eq('id', userId)
      .single()

    if (removedUser?.email && removeClass) {
      const startDate = new Date(removeClass.starts_at)
      sendRemovedFromClass({
        to: removedUser.email,
        name: removedUser.name,
        className: removeClass.class_types?.name || 'BOXX Class',
        date: startDate.toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok',
        }),
        time: startDate.toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok',
        }),
        creditRefunded: refundCredit !== false,
      }).catch((err) => console.error('[admin/roster] Removal email failed:', err))
    }

    // Promote first eligible waitlisted user into the freed spot
    promoteFromWaitlist(classId).catch((err) =>
      console.error('[admin/roster] Waitlist promotion error:', err)
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[admin/roster] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
