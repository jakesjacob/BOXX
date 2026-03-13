import { requireAuth } from '@/lib/api-helpers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/bookings/ical?id=<bookingId> — Download .ics file for a booked class
 */
export async function GET(request) {
  try {
    const authResult = await requireAuth()
    if (authResult.response) return authResult.response
    const { session, tenantId } = authResult

    const { searchParams } = new URL(request.url)
    const bookingId = searchParams.get('id')

    if (!bookingId) {
      return NextResponse.json({ error: 'Missing booking ID' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('id, status, class_schedule(id, starts_at, duration_minutes, class_types(name), instructors(name))')
      .eq('tenant_id', tenantId)
      .eq('id', bookingId)
      .eq('user_id', session.user.id)
      .single()

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const escapeIcal = (s) => s.replace(/[\\;,\n]/g, (c) => '\\' + c)

    const cls = booking.class_schedule
    const className = escapeIcal(cls.class_types?.name || 'Class')
    const instructor = escapeIcal(cls.instructors?.name || '')
    const start = new Date(cls.starts_at)
    const end = new Date(start.getTime() + (cls.duration_minutes || 55) * 60000)

    const formatDate = (d) =>
      d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

    const domain = (process.env.NEXT_PUBLIC_APP_URL || 'https://zatrovo.com').replace(/^https?:\/\//, '')
    const uid = `booking-${booking.id}@${domain}`
    const now = formatDate(new Date())

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Studio Platform//Booking//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${formatDate(start)}`,
      `DTEND:${formatDate(end)}`,
      `SUMMARY:${className}${instructor ? ` with ${instructor}` : ''}`,
      'DESCRIPTION:Class booking',
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT60M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Your class starts in 1 hour',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    return new NextResponse(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="class-${className.toLowerCase().replace(/\s+/g, '-')}.ics"`,
      },
    })
  } catch (error) {
    console.error('[bookings/ical] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
