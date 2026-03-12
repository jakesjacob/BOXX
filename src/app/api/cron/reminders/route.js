import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendClassReminder } from '@/lib/email'
import { NextResponse } from 'next/server'

/**
 * GET /api/cron/reminders — Send reminders for classes starting in ~1 hour
 * Run every 15 minutes via Vercel Cron
 */
export async function GET(request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
  }

  try {
    const now = new Date()
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)
    const windowStart = new Date(oneHourFromNow.getTime() - 10 * 60 * 1000) // 50 min
    const windowEnd = new Date(oneHourFromNow.getTime() + 10 * 60 * 1000) // 70 min

    // Find classes starting in 50-70 minutes
    const { data: classes } = await supabaseAdmin
      .from('class_schedule')
      .select('id, starts_at, class_types(name), instructors(name)')
      .eq('status', 'active')
      .gte('starts_at', windowStart.toISOString())
      .lte('starts_at', windowEnd.toISOString())

    if (!classes || classes.length === 0) {
      return NextResponse.json({ sent: 0 })
    }

    const classIds = classes.map(c => c.id)
    const classMap = Object.fromEntries(classes.map(c => [c.id, c]))

    // Batch fetch ALL bookings needing reminders across all classes
    const { data: allBookings } = await supabaseAdmin
      .from('bookings')
      .select('id, class_schedule_id, user_id, users(email, name)')
      .in('class_schedule_id', classIds)
      .eq('status', 'confirmed')
      .eq('reminder_2h_sent', false)

    if (!allBookings || allBookings.length === 0) {
      return NextResponse.json({ sent: 0 })
    }

    // Send emails (fire all concurrently, don't block each other)
    const results = await Promise.allSettled(
      allBookings
        .filter(b => b.users?.email)
        .map(b => {
          const cls = classMap[b.class_schedule_id]
          const time = new Date(cls.starts_at).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'Asia/Bangkok',
          })
          return sendClassReminder({
            to: b.users.email,
            name: b.users.name,
            className: cls.class_types?.name || 'Class',
            instructor: cls.instructors?.name,
            time,
          }).then(() => b.id)
        })
    )

    // Collect IDs of successfully sent reminders
    const sentIds = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)

    // Batch update all sent reminders in one query
    if (sentIds.length > 0) {
      await supabaseAdmin
        .from('bookings')
        .update({ reminder_2h_sent: true })
        .in('id', sentIds)
    }

    return NextResponse.json({ sent: sentIds.length })
  } catch (error) {
    console.error('[cron/reminders] Error:', error)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
