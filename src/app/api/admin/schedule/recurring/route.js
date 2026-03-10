import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const recurringSchema = z.object({
  classTypeId: z.string().min(1),
  instructorId: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  capacity: z.number().int().min(1).max(50).optional(),
  days: z.array(z.number().int().min(0).max(6)).min(1), // 0=Sun, 1=Mon, ..., 6=Sat
  weeks: z.number().int().min(1).max(52), // how many weeks to generate (52 = every week for 1 year)
  startDate: z.string().min(1), // YYYY-MM-DD, first date to start from
  notes: z.string().optional(),
})

/**
 * POST /api/admin/schedule/recurring — Generate recurring classes
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
    const parsed = recurringSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { classTypeId, instructorId, startTime, endTime, capacity, days, weeks, startDate, notes } = parsed.data

    // Generate a recurring_id to group these classes
    const recurringId = crypto.randomUUID()

    const classesToInsert = []
    const start = new Date(startDate + 'T00:00:00+07:00')

    for (let week = 0; week < weeks; week++) {
      for (const dayOfWeek of days) {
        // For week 0, start from the exact startDate
        // The startDate's day-of-week should match the requested day
        const date = new Date(start)
        date.setDate(start.getDate() + week * 7)

        // Adjust to the correct day of week
        const currentDay = date.getDay()
        let diff = dayOfWeek - currentDay
        if (diff < 0) diff += 7
        date.setDate(date.getDate() + diff)

        // Skip if date is before start date
        if (date < start) continue

        const dateStr = date.toLocaleDateString('en-CA') // YYYY-MM-DD
        const startsAt = new Date(`${dateStr}T${startTime}:00+07:00`).toISOString()
        const endsAt = new Date(`${dateStr}T${endTime}:00+07:00`).toISOString()

        classesToInsert.push({
          class_type_id: classTypeId,
          instructor_id: instructorId,
          starts_at: startsAt,
          ends_at: endsAt,
          capacity: capacity || 6,
          status: 'active',
          notes: notes || null,
          recurring_id: recurringId,
        })
      }
    }

    if (classesToInsert.length === 0) {
      return NextResponse.json({ error: 'No classes to create for the selected days/dates' }, { status: 400 })
    }

    // Business rule: filter out classes that clash with the same instructor's existing schedule
    const firstStart = classesToInsert[0].starts_at
    const lastEnd = classesToInsert[classesToInsert.length - 1].ends_at

    const { data: existingClasses } = await supabaseAdmin
      .from('class_schedule')
      .select('starts_at, ends_at')
      .eq('instructor_id', instructorId)
      .eq('status', 'active')
      .gte('starts_at', new Date(new Date(firstStart).getTime() - 86400000).toISOString())
      .lte('starts_at', new Date(new Date(lastEnd).getTime() + 86400000).toISOString())

    let skipped = 0
    const filtered = classesToInsert.filter((cls) => {
      const s = new Date(cls.starts_at).getTime()
      const e = new Date(cls.ends_at).getTime()
      const hasClash = (existingClasses || []).some((ex) => {
        const es = new Date(ex.starts_at).getTime()
        const ee = new Date(ex.ends_at).getTime()
        return s < ee && e > es
      })
      if (hasClash) skipped++
      return !hasClash
    })

    if (filtered.length === 0) {
      return NextResponse.json({ error: 'All classes clash with existing instructor schedule' }, { status: 409 })
    }

    const { data: created, error } = await supabaseAdmin
      .from('class_schedule')
      .insert(filtered)
      .select('id')

    if (error) {
      console.error('[admin/schedule/recurring] Error:', error)
      return NextResponse.json({ error: 'Failed to create recurring classes' }, { status: 500 })
    }

    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: session.user.id,
      action: 'create_recurring_classes',
      target_type: 'class_schedule',
      details: {
        recurringId,
        classTypeId,
        instructorId,
        days,
        weeks,
        startTime,
        count: created.length,
      },
    })

    return NextResponse.json({
      created: created.length,
      skipped,
      recurringId,
      message: skipped > 0
        ? `Created ${created.length} classes (${skipped} skipped due to time clashes)`
        : `Created ${created.length} classes`,
    })
  } catch (error) {
    console.error('[admin/schedule/recurring] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
