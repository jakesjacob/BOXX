import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { computeGamificationStats } from '@/lib/gamification'
import { NextResponse } from 'next/server'

/**
 * GET /api/gamification — Get user's gamification stats, badges, streak
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const userId = session.user.id

    // Get all confirmed bookings for this user
    const { data: bookings } = await supabaseAdmin
      .from('bookings')
      .select(`
        id, status,
        class_schedule(starts_at, class_types(name))
      `)
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: true })

    // Get total active class types for "tried all" badge
    const { data: classTypes } = await supabaseAdmin
      .from('class_types')
      .select('id')
      .eq('active', true)

    const totalClassTypes = classTypes?.length || 4

    const result = computeGamificationStats(bookings || [], totalClassTypes)

    return NextResponse.json(result)
  } catch (error) {
    console.error('[gamification] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
