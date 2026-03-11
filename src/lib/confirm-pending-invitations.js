/**
 * Auto-confirm pending class invitations when a member gets credits.
 * Used by direct purchase and Stripe webhook after credit allocation.
 */
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendBookingConfirmation } from '@/lib/email'

export async function confirmPendingInvitations(userId) {
  let confirmed = 0

  try {
    // 1. Find invited bookings for future active classes (oldest first)
    const { data: invitations } = await supabaseAdmin
      .from('bookings')
      .select('id, class_schedule_id, class_schedule(starts_at, status, class_types(name), instructors(name))')
      .eq('user_id', userId)
      .eq('status', 'invited')
      .gt('class_schedule.starts_at', new Date().toISOString())
      .order('created_at', { ascending: true })

    const valid = (invitations || []).filter(
      (b) => b.class_schedule && b.class_schedule.status === 'active' && new Date(b.class_schedule.starts_at) > new Date()
    )

    if (!valid.length) return 0

    // 2. Find available credits
    const { data: allCredits } = await supabaseAdmin
      .from('user_credits')
      .select('id, credits_remaining')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true })

    const credits = (allCredits || []).filter(
      (c) => c.credits_remaining > 0 || c.credits_remaining === null
    )

    if (!credits?.length) return 0

    // 3. Confirm invitations using available credits
    let creditIdx = 0
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email, name')
      .eq('id', userId)
      .single()

    for (const inv of valid) {
      if (creditIdx >= credits.length) break
      const credit = credits[creditIdx]

      // Deduct credit atomically
      if (credit.credits_remaining !== null) {
        const { data: ok } = await supabaseAdmin.rpc('deduct_credit', { credit_id: credit.id })
        if (!ok) {
          creditIdx++
          continue
        }
        // Check if this credit is now exhausted
        const { data: updated } = await supabaseAdmin
          .from('user_credits')
          .select('credits_remaining')
          .eq('id', credit.id)
          .single()
        if (updated && updated.credits_remaining <= 0) creditIdx++
      }

      // Confirm the booking
      await supabaseAdmin
        .from('bookings')
        .update({ status: 'confirmed', credit_id: credit.id })
        .eq('id', inv.id)

      confirmed++

      // Send confirmation email (non-blocking)
      if (user?.email) {
        const startDate = new Date(inv.class_schedule.starts_at)
        sendBookingConfirmation({
          to: user.email,
          name: user.name,
          className: inv.class_schedule.class_types?.name || 'BOXX Class',
          instructor: inv.class_schedule.instructors?.name,
          date: startDate.toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok',
          }),
          time: startDate.toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok',
          }),
        }).catch(() => {})
      }
    }
  } catch (err) {
    console.error('[confirm-pending-invitations] Error:', err)
  }

  return confirmed
}
