import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/schedule/options — Get class types and instructors for dropdowns
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin' && session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const [classTypesRes, instructorsRes] = await Promise.all([
      supabaseAdmin
        .from('class_types')
        .select('id, name, color, duration_mins, is_private')
        .eq('active', true)
        .order('name'),
      supabaseAdmin
        .from('instructors')
        .select('id, name')
        .eq('active', true)
        .order('name'),
    ])

    return NextResponse.json({
      classTypes: classTypesRes.data || [],
      instructors: instructorsRes.data || [],
    })
  } catch (error) {
    console.error('[admin/schedule/options] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
