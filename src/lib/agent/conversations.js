/**
 * Shared conversation helpers for the agent system.
 */
import { supabaseAdmin } from '@/lib/supabase/admin'

const MAX_CONVERSATIONS = 50

/**
 * Enforce conversation cap for a user — deletes oldest if at limit.
 */
export async function enforceConversationCap(userId) {
  const { count } = await supabaseAdmin
    .from('agent_conversations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (count >= MAX_CONVERSATIONS) {
    const { data: oldest } = await supabaseAdmin
      .from('agent_conversations')
      .select('id')
      .eq('user_id', userId)
      .order('updated_at', { ascending: true })
      .limit(count - MAX_CONVERSATIONS + 1)

    if (oldest?.length) {
      await supabaseAdmin
        .from('agent_conversations')
        .delete()
        .in('id', oldest.map((c) => c.id))
    }
  }
}
