import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/packs — Get active class packs and user's active credits
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

    // Get active packs ordered by display_order
    const { data: packs, error: packsError } = await supabaseAdmin
      .from('class_packs')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true })

    if (packsError) {
      console.error('[packs] Error fetching packs:', packsError)
      return NextResponse.json({ error: 'Failed to load packs' }, { status: 500 })
    }

    // Get user's active credits
    const { data: activeCredits } = await supabaseAdmin
      .from('user_credits')
      .select('id, credits_remaining, expires_at, status, class_packs(name, is_membership)')
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())

    return NextResponse.json({
      packs: packs || [],
      activeCredits: activeCredits || [],
    })
  } catch (error) {
    console.error('[packs] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
