import { requireStaff } from '@/lib/api-helpers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/admin/availability — List all availability windows
 */
export async function GET(request) {
  try {
    const result = await requireStaff(request)
    if (result.response) return result.response
    const { tenantId } = result

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const instructorId = searchParams.get('instructorId')

    let query = supabaseAdmin
      .from('instructor_availability')
      .select('*, instructors(id, name, photo_url), locations(id, name), zones(id, name)')
      .eq('tenant_id', tenantId)
      .order('day_of_week')
      .order('start_time')

    if (instructorId) {
      query = query.eq('instructor_id', instructorId)
    }

    const { data, error } = await query

    if (error) {
      console.error('[admin/availability] Error:', error)
      return NextResponse.json({ error: 'Failed to load availability' }, { status: 500 })
    }

    return NextResponse.json({ availability: data || [] })
  } catch (error) {
    console.error('[admin/availability] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

const createSchema = z.object({
  instructorId: z.string().regex(uuidRegex),
  locationId: z.string().regex(uuidRegex).nullable().optional(),
  zoneId: z.string().regex(uuidRegex).nullable().optional(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  sessionDuration: z.number().int().min(15).max(480).optional(),
  concurrentSlots: z.number().int().min(1).max(100).optional(),
  creditsCost: z.number().int().min(0).optional(),
})

/**
 * POST /api/admin/availability — Create an availability window
 */
export async function POST(request) {
  try {
    const result = await requireStaff(request)
    if (result.response) return result.response
    const { session, tenantId } = result

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // Check feature flag
    const { isFeatureEnabled, getTenantPlan } = await import('@/lib/feature-flags')
    const plan = await getTenantPlan(tenantId)
    if (!await isFeatureEnabled(tenantId, 'appointment_booking', plan)) {
      return NextResponse.json({ error: 'Appointment booking is not available on your plan' }, { status: 402 })
    }

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { instructorId, locationId, zoneId, dayOfWeek, startTime, endTime, sessionDuration, concurrentSlots, creditsCost } = parsed.data

    // Validate endTime > startTime
    if (endTime <= startTime) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })
    }

    // Validate session duration fits in window
    const [sh, sm] = startTime.split(':').map(Number)
    const [eh, em] = endTime.split(':').map(Number)
    const windowMins = (eh * 60 + em) - (sh * 60 + sm)
    const duration = sessionDuration || 60
    if (duration > windowMins) {
      return NextResponse.json({ error: `Session duration (${duration}min) exceeds the availability window (${windowMins}min)` }, { status: 400 })
    }

    // Validate zone belongs to location
    if (zoneId && locationId) {
      const { data: zone } = await supabaseAdmin
        .from('zones')
        .select('location_id')
        .eq('id', zoneId)
        .eq('tenant_id', tenantId)
        .single()
      if (!zone || zone.location_id !== locationId) {
        return NextResponse.json({ error: 'Zone does not belong to the selected location' }, { status: 400 })
      }
    }

    const { data: avail, error } = await supabaseAdmin
      .from('instructor_availability')
      .insert({
        tenant_id: tenantId,
        instructor_id: instructorId,
        location_id: locationId || null,
        zone_id: zoneId || null,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        session_duration: sessionDuration || 60,
        concurrent_slots: concurrentSlots || 1,
        credits_cost: creditsCost ?? 1,
        is_active: true,
      })
      .select('*, instructors(id, name), locations(id, name), zones(id, name)')
      .single()

    if (error) {
      console.error('[admin/availability] Create error:', error)
      return NextResponse.json({ error: 'Failed to create availability' }, { status: 500 })
    }

    await supabaseAdmin.from('admin_audit_log').insert({
      tenant_id: tenantId,
      admin_id: session.user.id,
      action: 'create_availability',
      target_type: 'instructor_availability',
      target_id: avail.id,
      details: { instructorId, dayOfWeek, startTime, endTime },
    })

    return NextResponse.json({ availability: avail })
  } catch (error) {
    console.error('[admin/availability] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

const updateSchema = z.object({
  id: z.string().regex(uuidRegex),
  locationId: z.string().regex(uuidRegex).nullable().optional(),
  zoneId: z.string().regex(uuidRegex).nullable().optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  sessionDuration: z.number().int().min(15).max(480).optional(),
  concurrentSlots: z.number().int().min(1).max(100).optional(),
  creditsCost: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

/**
 * PUT /api/admin/availability — Update an availability window
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
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { id, locationId, zoneId, dayOfWeek, startTime, endTime, sessionDuration, concurrentSlots, creditsCost, isActive } = parsed.data

    const updates = {}
    if (locationId !== undefined) updates.location_id = locationId
    if (zoneId !== undefined) updates.zone_id = zoneId
    if (dayOfWeek !== undefined) updates.day_of_week = dayOfWeek
    if (startTime !== undefined) updates.start_time = startTime
    if (endTime !== undefined) updates.end_time = endTime
    if (sessionDuration !== undefined) updates.session_duration = sessionDuration
    if (concurrentSlots !== undefined) updates.concurrent_slots = concurrentSlots
    if (creditsCost !== undefined) updates.credits_cost = creditsCost
    if (isActive !== undefined) updates.is_active = isActive

    const { data: avail, error } = await supabaseAdmin
      .from('instructor_availability')
      .update(updates)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select('*, instructors(id, name), locations(id, name), zones(id, name)')
      .single()

    if (error) {
      console.error('[admin/availability] Update error:', error)
      return NextResponse.json({ error: 'Failed to update availability' }, { status: 500 })
    }

    await supabaseAdmin.from('admin_audit_log').insert({
      tenant_id: tenantId,
      admin_id: session.user.id,
      action: 'update_availability',
      target_type: 'instructor_availability',
      target_id: id,
      details: updates,
    })

    return NextResponse.json({ availability: avail })
  } catch (error) {
    console.error('[admin/availability] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/availability — Delete an availability window
 */
export async function DELETE(request) {
  try {
    const result = await requireStaff(request)
    if (result.response) return result.response
    const { session, tenantId } = result

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const body = await request.json()
    const id = body.id

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('instructor_availability')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', id)

    if (error) {
      console.error('[admin/availability] Delete error:', error)
      return NextResponse.json({ error: 'Failed to delete availability' }, { status: 500 })
    }

    await supabaseAdmin.from('admin_audit_log').insert({
      tenant_id: tenantId,
      admin_id: session.user.id,
      action: 'delete_availability',
      target_type: 'instructor_availability',
      target_id: id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[admin/availability] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
