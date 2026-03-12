import { requireAdmin, requireFeature } from '@/lib/api-helpers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { getSuggestions } from '@/lib/agent/memory'
import { getUsage } from '@/lib/agent/usage'
import { enforceConversationCap } from '@/lib/agent/conversations'

/**
 * GET /api/admin/agent/conversations — List conversations + dynamic suggestions
 */
export async function GET(request) {
  try {
    const result = await requireAdmin(request)
    if (result.response) return result.response
    const { session, tenantId } = result

    // Feature flag: AI assistant
    const featureCheck = await requireFeature(tenantId, 'ai_assistant')
    if (featureCheck.response) return featureCheck.response

    const { data: conversations } = await supabaseAdmin
      .from('agent_conversations')
      .select('id, title, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })
      .limit(50)

    // Add creator name from session (all conversations belong to the current user)
    if (conversations) {
      for (const c of conversations) {
        c.created_by = session.user.name || null
      }
    }

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
    const result = await requireAdmin(request)
    if (result.response) return result.response
    const { session, tenantId } = result

    // Feature flag: AI assistant
    const featureCheck = await requireFeature(tenantId, 'ai_assistant')
    if (featureCheck.response) return featureCheck.response

    await enforceConversationCap(session.user.id)

    const body = await request.json().catch(() => ({}))

    const { data: conversation, error } = await supabaseAdmin
      .from('agent_conversations')
      .insert({
        tenant_id: tenantId,
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
