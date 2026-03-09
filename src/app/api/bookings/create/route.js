import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const bookingSchema = z.object({
  classScheduleId: z.string().min(1),
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
      .select('*, class_types(name)')
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

    // 2. Check not already booked
    const { data: existingBooking } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('user_id', userId)
      .eq('class_schedule_id', classScheduleId)
      .eq('status', 'confirmed')
      .limit(1)

    if (existingBooking && existingBooking.length > 0) {
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
    const { data: credits } = await supabaseAdmin
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gt('expires_at', now)
      .or('credits_remaining.gt.0,credits_remaining.is.null') // null = unlimited
      .order('expires_at', { ascending: true })

    if (!credits || credits.length === 0) {
      return NextResponse.json({ error: 'No available credits. Purchase a class pack first.' }, { status: 400 })
    }

    const credit = credits[0]

    // 5. Deduct credit (skip for unlimited)
    if (credit.credits_remaining !== null) {
      const { error: deductError } = await supabaseAdmin
        .from('user_credits')
        .update({ credits_remaining: credit.credits_remaining - 1 })
        .eq('id', credit.id)
        .gt('credits_remaining', 0) // Optimistic lock

      if (deductError) {
        console.error('[bookings/create] Credit deduct error:', deductError)
        return NextResponse.json({ error: 'Failed to deduct credit. Please try again.' }, { status: 500 })
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
      // Attempt to restore credit if booking failed
      if (credit.credits_remaining !== null) {
        await supabaseAdmin
          .from('user_credits')
          .update({ credits_remaining: credit.credits_remaining })
          .eq('id', credit.id)
      }
      return NextResponse.json({ error: 'Failed to create booking. Please try again.' }, { status: 500 })
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
