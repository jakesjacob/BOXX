import { requireStaff, requireAdmin } from '@/lib/api-helpers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/admin/locations — List all locations for tenant
 */
export async function GET(request) {
  try {
    const result = await requireStaff(request)
    if (result.response) return result.response
    const { session, tenantId } = result

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { data, error } = await supabaseAdmin
      .from('locations')
      .select('*, zones(id, name, capacity, is_active)')
      .eq('tenant_id', tenantId)
      .order('name')

    if (error) {
      console.error('[admin/locations] Error:', error)
      return NextResponse.json({ error: 'Failed to load locations' }, { status: 500 })
    }

    return NextResponse.json({ locations: data || [] })
  } catch (error) {
    console.error('[admin/locations] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).nullable().optional(),
  city: z.string().max(200).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  timezone: z.string().max(100).nullable().optional(),
  buffer_mins: z.number().int().min(0).max(120).optional(),
})

/**
 * POST /api/admin/locations — Create a location
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
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    // Check plan-level location limit
    const { checkTenantPlanLimit } = await import('@/lib/platform-limits')
    const locLimit = await checkTenantPlanLimit(tenantId, 'max_locations')
    if (!locLimit.allowed) {
      return NextResponse.json({ error: `Location limit reached (${locLimit.current}/${locLimit.limit})` }, { status: 403 })
    }

    const { data: location, error } = await supabaseAdmin
      .from('locations')
      .insert({
        tenant_id: tenantId,
        name: parsed.data.name,
        address: parsed.data.address || null,
        city: parsed.data.city || null,
        country: parsed.data.country || null,
        phone: parsed.data.phone || null,
        timezone: parsed.data.timezone || null,
        buffer_mins: parsed.data.buffer_mins ?? 0,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('[admin/locations] Create error:', error)
      return NextResponse.json({ error: 'Failed to create location' }, { status: 500 })
    }

    await supabaseAdmin.from('admin_audit_log').insert({
      tenant_id: tenantId,
      admin_id: session.user.id,
      action: 'create_location',
      target_type: 'locations',
      target_id: location.id,
      details: { name: location.name },
    })

    return NextResponse.json({ location })
  } catch (error) {
    console.error('[admin/locations] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

const updateSchema = z.object({
  id: z.string().regex(uuidRegex, 'Invalid ID'),
  name: z.string().min(1).max(200).optional(),
  address: z.string().max(500).nullable().optional(),
  city: z.string().max(200).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  timezone: z.string().max(100).nullable().optional(),
  buffer_mins: z.number().int().min(0).max(120).optional(),
  is_active: z.boolean().optional(),
})

/**
 * PUT /api/admin/locations — Update a location
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
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { id, ...updates } = parsed.data

    // Prevent deactivation if future active classes reference this location
    if (updates.is_active === false) {
      const { count } = await supabaseAdmin
        .from('class_schedule')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('location_id', id)
        .eq('status', 'active')
        .gt('starts_at', new Date().toISOString())

      if (count > 0) {
        return NextResponse.json(
          { error: `Cannot deactivate: ${count} upcoming class${count !== 1 ? 'es' : ''} use this location. Cancel or reassign them first.` },
          { status: 409 }
        )
      }
    }

    const { data: location, error } = await supabaseAdmin
      .from('locations')
      .update(updates)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[admin/locations] Update error:', error)
      return NextResponse.json({ error: 'Failed to update location' }, { status: 500 })
    }

    await supabaseAdmin.from('admin_audit_log').insert({
      tenant_id: tenantId,
      admin_id: session.user.id,
      action: 'update_location',
      target_type: 'locations',
      target_id: id,
      details: { name: location.name, changes: updates },
    })

    return NextResponse.json({ location })
  } catch (error) {
    console.error('[admin/locations] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

const deleteSchema = z.object({
  id: z.string().regex(uuidRegex, 'Invalid ID'),
})

/**
 * DELETE /api/admin/locations — Delete a location
 */
export async function DELETE(request) {
  try {
    const result = await requireAdmin(request)
    if (result.response) return result.response
    const { session, tenantId } = result

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const body = await request.json()
    const parsed = deleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { id } = parsed.data

    // Block if any class_schedule rows reference this location
    const { count } = await supabaseAdmin
      .from('class_schedule')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('location_id', id)

    if (count > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${count} scheduled class${count !== 1 ? 'es' : ''} use this location. Delete those classes first, or deactivate this location instead.` },
        { status: 409 }
      )
    }

    const { error } = await supabaseAdmin
      .from('locations')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', id)

    if (error) {
      console.error('[admin/locations] Delete error:', error)
      return NextResponse.json({ error: 'Failed to delete location' }, { status: 500 })
    }

    await supabaseAdmin.from('admin_audit_log').insert({
      tenant_id: tenantId,
      admin_id: session.user.id,
      action: 'delete_location',
      target_type: 'locations',
      target_id: id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[admin/locations] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
