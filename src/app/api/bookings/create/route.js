import { auth } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendBookingConfirmation, sendCreditsLowWarning } from '@/lib/email'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const bookingSchema = z.object({
  classScheduleId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID'),
})

/**
 * POST /api/bookings/create — Book a class
 * Uses Postgres transaction logic: spot-check + insert + credit deduct
 */
export async function POST(request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit: 10 booking attempts per minute per user
    const { limited } = rateLimit(`booking:${session.user.id}`, 10, 60 * 1000)
    if (limited) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
    }

    const body = await request.json()
    const parsed = bookingSchema.safeParse(body)
    if (!parsed.success) {
      console.error('[bookings/create] Invalid input:', JSON.stringify(body), parsed.error.issues)
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { classScheduleId } = parsed.data
    const userId = session.user.id

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // 1. Get the class
    const { data: cls, error: clsError } = await supabaseAdmin
      .from('class_schedule')
      .select('*, class_types(name), instructors(name)')
      .eq('id', classScheduleId)
      .eq('status', 'active')
      .single()

    if (clsError || !cls) {
      return NextResponse.json({ error: 'Class not found or not active' }, { status: 404 })
    }

    // Check class hasn't already started
    if (new Date(cls.starts_at) <= new Date()) {
      return NextResponse.json({ error: 'This class has already started' }, { status: 400 })
    }

    // 2. Check not already booked or invited
    const { data: existingBooking } = await supabaseAdmin
      .from('bookings')
      .select('id, status')
      .eq('user_id', userId)
      .eq('class_schedule_id', classScheduleId)
      .in('status', ['confirmed', 'invited'])
      .limit(1)

    if (existingBooking && existingBooking.length > 0) {
      if (existingBooking[0].status === 'invited') {
        return NextResponse.json({ error: 'You have a pending invitation for this class. Accept it from your bookings.' }, { status: 400 })
      }
      return NextResponse.json({ error: 'You are already booked for this class' }, { status: 400 })
    }

    // 3. Check spots available
    const { data: confirmedBookings } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('class_schedule_id', classScheduleId)
      .eq('status', 'confirmed')

    const bookedCount = confirmedBookings?.length || 0
    if (bookedCount >= cls.capacity) {
      return NextResponse.json({ error: 'Class is full. Join the waitlist instead.' }, { status: 400 })
    }

    // 4. Find user's best credit (closest to expiry first, active + not expired)
    const now = new Date().toISOString()
    const { data: allCredits } = await supabaseAdmin
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gt('expires_at', now)
      .order('expires_at', { ascending: true })

    const availableCredits = (allCredits || []).filter(
      (c) => c.credits_remaining > 0 || c.credits_remaining === null
    )

    if (!availableCredits.length) {
      return NextResponse.json({ error: 'No available credits. Purchase a class pack first.' }, { status: 400 })
    }

    const credit = availableCredits[0]

    // 5. Deduct credit atomically (skip for unlimited)
    if (credit.credits_remaining !== null) {
      // Use server-side decrement to prevent race conditions
      const { data: updated, error: deductError } = await supabaseAdmin
        .rpc('deduct_credit', { credit_id: credit.id })

      if (deductError || !updated) {
        console.error('[bookings/create] Credit deduct error:', deductError)
        return NextResponse.json({ error: 'No credits available. Please try again.' }, { status: 400 })
      }
    }

    // 6. Create booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        user_id: userId,
        class_schedule_id: classScheduleId,
        credit_id: credit.id,
        status: 'confirmed',
      })
      .select()
      .single()

    if (bookingError) {
      console.error('[bookings/create] Booking error:', bookingError)
      // Restore credit atomically (increment by 1, not set to original)
      if (credit.credits_remaining !== null) {
        await supabaseAdmin
          .rpc('restore_credit', { credit_id: credit.id })
      }
      return NextResponse.json({ error: 'Failed to create booking. Please try again.' }, { status: 500 })
    }

    // Send confirmation email (non-blocking)
    const { data: emailUser } = await supabaseAdmin
      .from('users')
      .select('email, name')
      .eq('id', userId)
      .single()

    if (emailUser?.email) {
      const startDate = new Date(cls.starts_at)
      sendBookingConfirmation({
        to: emailUser.email,
        name: emailUser.name,
        className: cls.class_types?.name || 'BOXX Class',
        instructor: cls.instructors?.name,
        date: startDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          timeZone: 'Asia/Bangkok',
        }),
        time: startDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'Asia/Bangkok',
        }),
      }).catch((err) => console.error('[bookings/create] Email failed:', err))

      // Check if credits are now low (1 remaining) and warn
      if (credit.credits_remaining !== null && credit.credits_remaining - 1 === 1) {
        const { data: packInfo } = await supabaseAdmin
          .from('class_packs')
          .select('name')
          .eq('id', credit.class_pack_id)
          .single()

        sendCreditsLowWarning({
          to: emailUser.email,
          name: emailUser.name,
          creditsRemaining: 1,
          packName: packInfo?.name,
        }).catch((err) => console.error('[bookings/create] Low credit email failed:', err))
      }
    }

    return NextResponse.json({
      booking,
      message: `Booked for ${cls.class_types?.name || 'class'}!`,
    })
  } catch (error) {
    console.error('[bookings/create] Error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
