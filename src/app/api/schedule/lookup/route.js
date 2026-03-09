import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/schedule/lookup?id=<class_schedule_id>
 * Returns minimal info for a single class (used for deep-link resolution)
 */
export async function GET(request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id param required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('class_schedule')
      .select('id, starts_at, status')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    return NextResponse.json({ id: data.id, starts_at: data.starts_at, status: data.status })
  } catch (error) {
    console.error('[schedule/lookup] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
