import { requireStaff } from '@/lib/api-helpers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * GET /api/admin/schedule?start=ISO&end=ISO — Get all classes for admin view
 */
export async function GET(request) {
  try {
    const result = await requireStaff(request)
    if (result.response) return result.response
    const { session, tenantId } = result

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!start || !end) {
      return NextResponse.json({ error: 'start and end params required' }, { status: 400 })
    }

    const { data: classes, error } = await supabaseAdmin
      .from('class_schedule')
      .select(`
        *,
        class_types(id, name, description, duration_mins, color, icon, is_private),
        instructors(id, name, photo_url),
        locations(id, name),
        zones(id, name)
      `)
      .eq('tenant_id', tenantId)
      .gte('starts_at', new Date(start).toISOString())
      .lte('starts_at', new Date(end).toISOString())
      .order('starts_at', { ascending: true })

    if (error) {
      console.error('[admin/schedule] Error:', error)
      return NextResponse.json({ error: 'Failed to load schedule' }, { status: 500 })
    }

    // Get booking counts for each class
    const classIds = (classes || []).map((c) => c.id)
    let bookingCounts = {}
    let rosterByClass = {}
    let waitlistByClass = {}

    if (classIds.length > 0) {
      const [bookingsRes, waitlistRes] = await Promise.all([
        supabaseAdmin
          .from('bookings')
          .select('class_schedule_id, status, users(id, name, avatar_url, email)')
          .eq('tenant_id', tenantId)
          .in('class_schedule_id', classIds)
          .eq('status', 'confirmed'),
        supabaseAdmin
          .from('waitlist')
          .select('class_schedule_id, position, users(id, name, avatar_url, email)')
          .eq('tenant_id', tenantId)
          .in('class_schedule_id', classIds)
          .order('position', { ascending: true }),
      ])

      const bookings = bookingsRes.data || []

      bookings.forEach((b) => {
        bookingCounts[b.class_schedule_id] = (bookingCounts[b.class_schedule_id] || 0) + 1
      })

      // Build roster per class
      bookings.forEach((b) => {
        if (!rosterByClass[b.class_schedule_id]) rosterByClass[b.class_schedule_id] = []
        rosterByClass[b.class_schedule_id].push({
          id: b.users?.id,
          name: b.users?.name,
          avatar_url: b.users?.avatar_url,
          email: b.users?.email,
          status: b.status,
        })
      })

      // Build waitlist per class
      ;(waitlistRes.data || []).forEach((w) => {
        if (!waitlistByClass[w.class_schedule_id]) waitlistByClass[w.class_schedule_id] = []
        waitlistByClass[w.class_schedule_id].push({
          id: w.users?.id,
          name: w.users?.name,
          avatar_url: w.users?.avatar_url,
          email: w.users?.email,
          position: w.position,
        })
      })
    }

    const enriched = (classes || []).map((cls) => ({
      ...cls,
      booked_count: bookingCounts[cls.id] || 0,
      roster: rosterByClass[cls.id] || [],
      waitlist: waitlistByClass[cls.id] || [],
    }))

    return NextResponse.json({ classes: enriched })
  } catch (error) {
    console.error('[admin/schedule] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

const createClassSchema = z.object({
  classTypeId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID'),
  instructorId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID'),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  capacity: z.number().int().min(1).max(500).nullable().optional(),
  notes: z.string().nullable().optional(),
  locationId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID').nullable().optional(),
  zoneId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID').nullable().optional(),
  creditsCost: z.number().min(0).optional(),
})

/**
 * POST /api/admin/schedule — Create a new class
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
    const parsed = createClassSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { classTypeId, instructorId, startsAt, endsAt, capacity, notes, locationId, zoneId, creditsCost } = parsed.data

    // Check platform class limit
    const { checkClassLimit, checkTenantPlanLimit } = await import('@/lib/platform-limits')
    const { allowed: classAllowed, reason: classReason } = await checkClassLimit()
    if (!classAllowed) {
      return NextResponse.json({ error: classReason }, { status: 403 })
    }

    // Check plan-level class limit
    const classLimit = await checkTenantPlanLimit(tenantId, 'max_classes_month')
    if (!classLimit.allowed) {
      return NextResponse.json({ error: `Monthly class limit reached (${classLimit.current}/${classLimit.limit} on ${classLimit.plan} plan)` }, { status: 403 })
    }

    // Business rule: check for time clashes with same instructor
    const newStart = new Date(startsAt)
    const newEnd = new Date(endsAt)

    const { data: overlaps } = await supabaseAdmin
      .from('class_schedule')
      .select('id, starts_at, ends_at, class_types(name)')
      .eq('tenant_id', tenantId)
      .eq('instructor_id', instructorId)
      .eq('status', 'active')
      .lt('starts_at', newEnd.toISOString())
      .gt('ends_at', newStart.toISOString())

    if (overlaps && overlaps.length > 0) {
      const clash = overlaps[0]
      const clashTime = new Date(clash.starts_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      return NextResponse.json({
        error: `Time clash: instructor already has "${clash.class_types?.name}" at ${clashTime}`,
      }, { status: 409 })
    }

    const { data: cls, error } = await supabaseAdmin
      .from('class_schedule')
      .insert({
        tenant_id: tenantId,
        class_type_id: classTypeId,
        instructor_id: instructorId,
        starts_at: startsAt,
        ends_at: endsAt,
        capacity: capacity === null ? null : (capacity || 6),
        notes: notes || null,
        status: 'active',
        location_id: locationId || null,
        zone_id: zoneId || null,
        credits_cost: creditsCost ?? 1,
      })
      .select('*, class_types(id, name, color), instructors(id, name)')
      .single()

    if (error) {
      console.error('[admin/schedule] Create error:', error)
      return NextResponse.json({ error: 'Failed to create class' }, { status: 500 })
    }

    // Audit log
    await supabaseAdmin.from('admin_audit_log').insert({
      tenant_id: tenantId,
      admin_id: session.user.id,
      action: 'create_class',
      target_type: 'class_schedule',
      target_id: cls.id,
      details: { className: cls.class_types?.name, instructorName: cls.instructors?.name, startsAt },
    })

    return NextResponse.json({ class: cls })
  } catch (error) {
    console.error('[admin/schedule] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

const updateClassSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID'),
  classTypeId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID').optional(),
  instructorId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID').optional(),
  startsAt: z.string().min(1).optional(),
  endsAt: z.string().min(1).optional(),
  capacity: z.number().int().min(1).max(500).nullable().optional(),
  notes: z.string().nullable().optional(),
  locationId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID').nullable().optional(),
  zoneId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID').nullable().optional(),
  creditsCost: z.number().min(0).nullable().optional(),
  updateAll: z.boolean().optional(),       // Apply shared fields to all recurring siblings
  unlinkFromRecurring: z.boolean().optional(), // Remove this class from its recurring set
})

/**
 * PUT /api/admin/schedule — Update an existing class
 *
 * Recurring modes:
 * - unlinkFromRecurring: true → save changes to this class only, set recurring_id = null
 * - updateAll: true → apply classTypeId, instructorId, capacity, notes, and time-of-day to all
 *   active siblings (each keeps its own date). The specific class also gets date changes.
 * - neither → just update this single class (keeps recurring_id)
 */
export async function PUT(request) {
  try {
    const result = await requireStaff(request)
    if (result.response) return result.response
    const { session, tenantId } = result

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const body = await request.json()
    const parsed = updateClassSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { id, classTypeId, instructorId, startsAt, endsAt, capacity, notes, locationId, zoneId, creditsCost, updateAll, unlinkFromRecurring } = parsed.data

    // Fetch existing class for validation
    const { data: existing } = await supabaseAdmin
      .from('class_schedule')
      .select('id, class_type_id, capacity, starts_at, ends_at, instructor_id, recurring_id')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    // Business rule: class type cannot change after creation
    if (classTypeId && classTypeId !== existing.class_type_id) {
      return NextResponse.json({ error: 'Class type cannot be changed after creation' }, { status: 400 })
    }

    // Business rule: capacity cannot go below current bookings (skip if unlimited)
    if (capacity !== undefined && capacity !== null) {
      const { count: bookedCount } = await supabaseAdmin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('class_schedule_id', id)
        .eq('status', 'confirmed')

      if (capacity < (bookedCount || 0)) {
        return NextResponse.json({ error: `Cannot reduce capacity below ${bookedCount} (current bookings)` }, { status: 400 })
      }
    }

    // Business rule: check for time clashes with other classes by the same instructor
    if (startsAt && endsAt) {
      const newStart = new Date(startsAt)
      const newEnd = new Date(endsAt)
      const checkInstructor = instructorId || existing.instructor_id

      const { data: overlaps } = await supabaseAdmin
        .from('class_schedule')
        .select('id, starts_at, ends_at, class_types(name)')
        .eq('tenant_id', tenantId)
        .eq('instructor_id', checkInstructor)
        .eq('status', 'active')
        .neq('id', id)
        .lt('starts_at', newEnd.toISOString())
        .gt('ends_at', newStart.toISOString())

      if (overlaps && overlaps.length > 0) {
        const clash = overlaps[0]
        const clashTime = new Date(clash.starts_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        return NextResponse.json({
          error: `Time clash: instructor already has "${clash.class_types?.name}" at ${clashTime}`,
        }, { status: 409 })
      }
    }

    // Build updates for the individual class
    const updates = {}
    // classTypeId is intentionally NOT applied (locked after creation)
    if (instructorId) updates.instructor_id = instructorId
    if (startsAt) updates.starts_at = startsAt
    if (endsAt) updates.ends_at = endsAt
    if (capacity !== undefined) updates.capacity = capacity
    if (notes !== undefined) updates.notes = notes
    if (locationId !== undefined) updates.location_id = locationId || null
    if (zoneId !== undefined) updates.zone_id = zoneId || null
    if (creditsCost !== undefined) updates.credits_cost = creditsCost

    // If unlinking, clear recurring_id on this class
    if (unlinkFromRecurring) {
      updates.recurring_id = null
    }

    // Update the individual class
    const { data: cls, error } = await supabaseAdmin
      .from('class_schedule')
      .update(updates)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select('*, class_types(id, name, color), instructors(id, name)')
      .single()

    if (error) {
      console.error('[admin/schedule] Update error:', error)
      return NextResponse.json({ error: 'Failed to update class' }, { status: 500 })
    }

    let siblingsUpdated = 0

    // If updateAll, apply shared fields to all active recurring siblings
    if (updateAll && cls.recurring_id) {
      const sharedUpdates = {}
      // classTypeId intentionally excluded — locked after creation
      if (instructorId) sharedUpdates.instructor_id = instructorId
      if (capacity !== undefined) sharedUpdates.capacity = capacity
      if (notes !== undefined) sharedUpdates.notes = notes
      if (locationId !== undefined) sharedUpdates.location_id = locationId || null
      if (zoneId !== undefined) sharedUpdates.zone_id = zoneId || null
      if (creditsCost !== undefined) sharedUpdates.credits_cost = creditsCost

      // Apply time-of-day change to all siblings (keep each class's date, change the time)
      if (startsAt && endsAt) {
        const newStart = new Date(startsAt)
        const newEnd = new Date(endsAt)
        const startH = newStart.getUTCHours(), startM = newStart.getUTCMinutes()
        const endH = newEnd.getUTCHours(), endM = newEnd.getUTCMinutes()

        // Get all active siblings (excluding the one we just updated)
        const { data: siblings } = await supabaseAdmin
          .from('class_schedule')
          .select('id, starts_at, ends_at')
          .eq('tenant_id', tenantId)
          .eq('recurring_id', cls.recurring_id)
          .eq('status', 'active')
          .neq('id', id)

        for (const sib of (siblings || [])) {
          const sibStart = new Date(sib.starts_at)
          const sibEnd = new Date(sib.ends_at)
          sibStart.setUTCHours(startH, startM, 0, 0)
          sibEnd.setUTCHours(endH, endM, 0, 0)

          await supabaseAdmin
            .from('class_schedule')
            .update({
              ...sharedUpdates,
              starts_at: sibStart.toISOString(),
              ends_at: sibEnd.toISOString(),
            })
            .eq('tenant_id', tenantId)
            .eq('id', sib.id)

          siblingsUpdated++
        }
      } else if (Object.keys(sharedUpdates).length > 0) {
        // No time change — just apply shared fields
        const { count } = await supabaseAdmin
          .from('class_schedule')
          .update(sharedUpdates)
          .eq('tenant_id', tenantId)
          .eq('recurring_id', cls.recurring_id)
          .eq('status', 'active')
          .neq('id', id)

        siblingsUpdated = count || 0
      }
    }

    await supabaseAdmin.from('admin_audit_log').insert({
      tenant_id: tenantId,
      admin_id: session.user.id,
      action: updateAll ? 'update_recurring_classes' : 'update_class',
      target_type: 'class_schedule',
      target_id: id,
      details: { className: cls.class_types?.name, startsAt: cls.starts_at, ...updates, siblingsUpdated },
    })

    return NextResponse.json({ class: cls, siblingsUpdated })
  } catch (error) {
    console.error('[admin/schedule] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
