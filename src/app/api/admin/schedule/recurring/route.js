import { requireStaff } from '@/lib/api-helpers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const recurringSchema = z.object({
  classTypeId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID'),
  instructorId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  capacity: z.number().int().min(1).max(500).nullable().optional(),
  days: z.array(z.number().int().min(0).max(6)).min(1), // 0=Sun, 1=Mon, ..., 6=Sat
  weeks: z.number().int().min(1).max(52), // how many weeks to generate (52 = every week for 1 year)
  startDate: z.string().min(1), // YYYY-MM-DD, first date to start from
  notes: z.string().optional(),
  locationId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID').nullable().optional(),
  zoneId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID').nullable().optional(),
  creditsCost: z.number().min(0).optional(),
})

/**
 * POST /api/admin/schedule/recurring — Generate recurring classes
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
    const parsed = recurringSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { classTypeId, instructorId, startTime, endTime, capacity, days, weeks, startDate, notes, locationId, zoneId, creditsCost } = parsed.data

    // Check platform class limit
    const { checkClassLimit } = await import('@/lib/platform-limits')
    const { allowed: classAllowed, reason: classReason } = await checkClassLimit()
    if (!classAllowed) {
      return NextResponse.json({ error: classReason }, { status: 403 })
    }

    // Generate a recurring_id to group these classes
    const recurringId = crypto.randomUUID()

    // Resolve timezone from location or studio_settings
    let tz = '+00:00'
    if (locationId) {
      const { data: loc } = await supabaseAdmin
        .from('locations')
        .select('timezone')
        .eq('id', locationId)
        .eq('tenant_id', tenantId)
        .single()
      if (loc?.timezone) {
        // Convert IANA timezone to offset for this date
        try {
          const testDate = new Date(`${startDate}T12:00:00Z`)
          const parts = new Intl.DateTimeFormat('en-US', { timeZone: loc.timezone, timeZoneName: 'shortOffset' }).formatToParts(testDate)
          const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || ''
          const match = tzPart.match(/GMT([+-]\d{1,2}(?::\d{2})?)/)
          if (match) tz = match[1].includes(':') ? match[1] : match[1] + ':00'
        } catch { /* use default */ }
      }
    }
    if (tz === '+00:00') {
      const { data: settings } = await supabaseAdmin
        .from('studio_settings')
        .select('timezone')
        .eq('tenant_id', tenantId)
        .single()
      if (settings?.timezone) {
        try {
          const testDate = new Date(`${startDate}T12:00:00Z`)
          const parts = new Intl.DateTimeFormat('en-US', { timeZone: settings.timezone, timeZoneName: 'shortOffset' }).formatToParts(testDate)
          const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || ''
          const match = tzPart.match(/GMT([+-]\d{1,2}(?::\d{2})?)/)
          if (match) tz = match[1].includes(':') ? match[1] : match[1] + ':00'
        } catch { /* use default */ }
      }
    }

    const classesToInsert = []
    const start = new Date(startDate + `T00:00:00${tz}`)

    for (let week = 0; week < weeks; week++) {
      for (const dayOfWeek of days) {
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
        const startsAt = new Date(`${dateStr}T${startTime}:00${tz}`).toISOString()
        const endsAt = new Date(`${dateStr}T${endTime}:00${tz}`).toISOString()

        classesToInsert.push({
          tenant_id: tenantId,
          class_type_id: classTypeId,
          instructor_id: instructorId,
          starts_at: startsAt,
          ends_at: endsAt,
          capacity: capacity === null ? null : (capacity || 6),
          status: 'active',
          notes: notes || null,
          recurring_id: recurringId,
          location_id: locationId || null,
          zone_id: zoneId || null,
          credits_cost: creditsCost ?? 1,
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
      .eq('tenant_id', tenantId)
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

    // Look up class type name for audit details
    const { data: recurClassType } = await supabaseAdmin
      .from('class_types')
      .select('name')
      .eq('tenant_id', tenantId)
      .eq('id', classTypeId)
      .single()

    await supabaseAdmin.from('admin_audit_log').insert({
      tenant_id: tenantId,
      admin_id: session.user.id,
      action: 'create_recurring_classes',
      target_type: 'class_schedule',
      details: {
        recurringId,
        className: recurClassType?.name,
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
