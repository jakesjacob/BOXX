import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const joinSchema = z.object({
  classScheduleId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID'),
})

/**
 * POST /api/waitlist/join — Join the waitlist for a full class
 */
export async function POST(request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = joinSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { classScheduleId } = parsed.data
    const userId = session.user.id

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // 1. Verify class exists and is active
    const { data: cls } = await supabaseAdmin
      .from('class_schedule')
      .select('id, capacity, starts_at, status')
      .eq('id', classScheduleId)
      .eq('status', 'active')
      .single()

    if (!cls) {
      return NextResponse.json({ error: 'Class not found or not active' }, { status: 404 })
    }

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

    // 3. Check not already on waitlist
    const { data: existingWaitlist } = await supabaseAdmin
      .from('waitlist')
      .select('id, position')
      .eq('user_id', userId)
      .eq('class_schedule_id', classScheduleId)
      .limit(1)

    if (existingWaitlist && existingWaitlist.length > 0) {
      return NextResponse.json({ error: 'You are already on the waitlist', position: existingWaitlist[0].position }, { status: 400 })
    }

    // 4. Get current max position
    const { data: maxPos } = await supabaseAdmin
      .from('waitlist')
      .select('position')
      .eq('class_schedule_id', classScheduleId)
      .order('position', { ascending: false })
      .limit(1)

    const nextPosition = (maxPos && maxPos.length > 0) ? maxPos[0].position + 1 : 1

    // 5. Add to waitlist
    const { data: entry, error } = await supabaseAdmin
      .from('waitlist')
      .insert({
        user_id: userId,
        class_schedule_id: classScheduleId,
        position: nextPosition,
      })
      .select()
      .single()

    if (error) {
      // Unique constraint violation — already on waitlist
      if (error.code === '23505') {
        return NextResponse.json({ error: 'You are already on the waitlist' }, { status: 400 })
      }
      console.error('[waitlist/join] Error:', error)
      return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 })
    }

    return NextResponse.json({
      position: nextPosition,
      message: `You're #${nextPosition} on the waitlist`,
    })
  } catch (error) {
    console.error('[waitlist/join] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
