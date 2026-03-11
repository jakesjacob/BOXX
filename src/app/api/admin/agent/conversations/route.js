import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { getSuggestions } from '@/lib/agent/memory'
import { getUsage } from '@/lib/agent/usage'
import { enforceConversationCap } from '@/lib/agent/conversations'

/**
 * GET /api/admin/agent/conversations — List conversations + dynamic suggestions
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'owner')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: conversations } = await supabaseAdmin
      .from('agent_conversations')
      .select('id, title, created_at, updated_at')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })
      .limit(50)

    const [suggestions, usage] = await Promise.all([
      getSuggestions(session.user.id),
      getUsage(session.user.id).catch(() => null),
    ])

    return NextResponse.json({
      conversations: conversations || [],
      suggestions,
      usage,
    })
  } catch (error) {
    console.error('[agent/conversations] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

/**
 * POST /api/admin/agent/conversations — Create a new conversation
 */
export async function POST(request) {
  try {
    const session = await auth()
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'owner')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await enforceConversationCap(session.user.id)

    const body = await request.json().catch(() => ({}))

    const { data: conversation, error } = await supabaseAdmin
      .from('agent_conversations')
      .insert({
        user_id: session.user.id,
        title: body.title || 'New conversation',
      })
      .select('id, title, created_at, updated_at')
      .single()

    if (error) {
      console.error('[agent/conversations] Create error:', error)
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    }

    return NextResponse.json({ conversation })
  } catch (error) {
    console.error('[agent/conversations] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
