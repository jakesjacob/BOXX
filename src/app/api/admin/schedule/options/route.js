import { requireStaff } from '@/lib/api-helpers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/schedule/options — Get class types, instructors, and locations for dropdowns
 */
export async function GET(request) {
  try {
    const result = await requireStaff(request)
    if (result.response) return result.response
    const { session, tenantId } = result

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const [classTypesRes, instructorsRes, locationsRes] = await Promise.all([
      supabaseAdmin
        .from('class_types')
        .select('id, name, color, duration_mins, is_private')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .order('name'),
      supabaseAdmin
        .from('instructors')
        .select('id, name, instructor_locations(location_id)')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .order('name'),
      supabaseAdmin
        .from('locations')
        .select('id, name, zones(id, name, capacity, is_active)')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name'),
    ])

    return NextResponse.json({
      classTypes: classTypesRes.data || [],
      instructors: instructorsRes.data || [],
      locations: locationsRes.data || [],
    })
  } catch (error) {
    console.error('[admin/schedule/options] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
