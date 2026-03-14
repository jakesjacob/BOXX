import { requireStaff, requireAdmin } from '@/lib/api-helpers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/admin/locations/[id]/zones — List zones for a location
 */
export async function GET(request, { params }) {
  try {
    const result = await requireStaff(request)
    if (result.response) return result.response
    const { session, tenantId } = result

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { id: locationId } = await params

    const { data, error } = await supabaseAdmin
      .from('zones')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('location_id', locationId)
      .order('name')

    if (error) {
      console.error('[admin/locations/zones] Error:', error)
      return NextResponse.json({ error: 'Failed to load zones' }, { status: 500 })
    }

    return NextResponse.json({ zones: data || [] })
  } catch (error) {
    console.error('[admin/locations/zones] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  capacity: z.number().int().min(1).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
})

/**
 * POST /api/admin/locations/[id]/zones — Create a zone
 */
export async function POST(request, { params }) {
  try {
    const result = await requireStaff(request)
    if (result.response) return result.response
    const { session, tenantId } = result

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { id: locationId } = await params

    // Check zones feature flag
    const { isFeatureEnabled, getTenantPlan } = await import('@/lib/feature-flags')
    const plan = await getTenantPlan(tenantId)
    if (!await isFeatureEnabled(tenantId, 'zones', plan)) {
      return NextResponse.json({ error: 'Zones feature not available on your plan' }, { status: 402 })
    }

    // Check plan-level zone limit
    const { checkTenantPlanLimit } = await import('@/lib/platform-limits')
    const zoneLimit = await checkTenantPlanLimit(tenantId, 'max_zones')
    if (!zoneLimit.allowed) {
      return NextResponse.json({ error: `Zone limit reached (${zoneLimit.current}/${zoneLimit.limit})` }, { status: 403 })
    }

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { data: zone, error } = await supabaseAdmin
      .from('zones')
      .insert({
        tenant_id: tenantId,
        location_id: locationId,
        name: parsed.data.name,
        capacity: parsed.data.capacity ?? null,
        description: parsed.data.description || null,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('[admin/locations/zones] Create error:', error)
      return NextResponse.json({ error: 'Failed to create zone' }, { status: 500 })
    }

    await supabaseAdmin.from('admin_audit_log').insert({
      tenant_id: tenantId,
      admin_id: session.user.id,
      action: 'create_zone',
      target_type: 'zones',
      target_id: zone.id,
      details: { name: zone.name, location_id: locationId },
    })

    return NextResponse.json({ zone })
  } catch (error) {
    console.error('[admin/locations/zones] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

const updateSchema = z.object({
  id: z.string().regex(uuidRegex, 'Invalid ID'),
  name: z.string().min(1).max(200).optional(),
  capacity: z.number().int().min(1).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  is_active: z.boolean().optional(),
})

/**
 * PUT /api/admin/locations/[id]/zones — Update a zone
 */
export async function PUT(request, { params }) {
  try {
    const result = await requireStaff(request)
    if (result.response) return result.response
    const { session, tenantId } = result

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { id: locationId } = await params

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { id, ...updates } = parsed.data

    // Prevent deactivation if future active classes reference this zone
    if (updates.is_active === false) {
      const { count } = await supabaseAdmin
        .from('class_schedule')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('zone_id', id)
        .eq('status', 'active')
        .gt('starts_at', new Date().toISOString())

      if (count > 0) {
        return NextResponse.json(
          { error: `Cannot deactivate: ${count} upcoming class${count !== 1 ? 'es' : ''} use this zone. Cancel or reassign them first.` },
          { status: 409 }
        )
      }
    }

    const { data: zone, error } = await supabaseAdmin
      .from('zones')
      .update(updates)
      .eq('tenant_id', tenantId)
      .eq('location_id', locationId)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[admin/locations/zones] Update error:', error)
      return NextResponse.json({ error: 'Failed to update zone' }, { status: 500 })
    }

    await supabaseAdmin.from('admin_audit_log').insert({
      tenant_id: tenantId,
      admin_id: session.user.id,
      action: 'update_zone',
      target_type: 'zones',
      target_id: id,
      details: { name: zone.name, changes: updates },
    })

    return NextResponse.json({ zone })
  } catch (error) {
    console.error('[admin/locations/zones] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

const deleteSchema = z.object({
  id: z.string().regex(uuidRegex, 'Invalid ID'),
})

/**
 * DELETE /api/admin/locations/[id]/zones — Delete a zone
 */
export async function DELETE(request, { params }) {
  try {
    const result = await requireAdmin(request)
    if (result.response) return result.response
    const { session, tenantId } = result

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { id: locationId } = await params

    const body = await request.json()
    const parsed = deleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { id } = parsed.data

    // Block if any class_schedule rows reference this zone
    const { count } = await supabaseAdmin
      .from('class_schedule')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('zone_id', id)

    if (count > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${count} scheduled class${count !== 1 ? 'es' : ''} use this zone. Delete those classes first, or deactivate this zone instead.` },
        { status: 409 }
      )
    }

    const { error } = await supabaseAdmin
      .from('zones')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('location_id', locationId)
      .eq('id', id)

    if (error) {
      console.error('[admin/locations/zones] Delete error:', error)
      return NextResponse.json({ error: 'Failed to delete zone' }, { status: 500 })
    }

    await supabaseAdmin.from('admin_audit_log').insert({
      tenant_id: tenantId,
      admin_id: session.user.id,
      action: 'delete_zone',
      target_type: 'zones',
      target_id: id,
      details: { location_id: locationId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[admin/locations/zones] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
