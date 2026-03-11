import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { AGENT_TOOLS } from '@/lib/agent/tools'
import { executeTool } from '@/lib/agent/executor'
import { rateLimit } from '@/lib/rate-limit'
import { updateMemory } from '@/lib/agent/memory'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DAILY_MESSAGE_LIMIT = 200
const MAX_CONVERSATIONS = 50

/**
 * Build system prompt with live studio context (class types, instructors, packs)
 */
async function buildSystemPrompt(adminName) {
  const [classTypesRes, instructorsRes, packsRes] = await Promise.all([
    supabaseAdmin.from('class_types').select('name, duration_mins, is_private').eq('active', true),
    supabaseAdmin.from('instructors').select('name').eq('active', true),
    supabaseAdmin.from('class_packs').select('name, credits, validity_days, price_thb').eq('active', true),
  ])

  const classTypes = (classTypesRes.data || []).map((ct) =>
    `- ${ct.name} (${ct.duration_mins}min${ct.is_private ? ', private' : ''})`
  ).join('\n')

  const instructors = (instructorsRes.data || []).map((i) => `- ${i.name}`).join('\n')

  const packs = (packsRes.data || []).map((p) =>
    `- ${p.name}: ${p.credits || 'unlimited'} credits, ${p.validity_days} days, ฿${p.price_thb}`
  ).join('\n')

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Bangkok',
  })

  return `You are the BOXX Studio Assistant — an AI helper for managing BOXX Boxing Studio in Chiang Mai, Thailand.

You help ${adminName || 'the admin'} manage the studio by executing actions through the available tools. You are friendly, concise, and professional.

## Rules
- ONLY use the provided tools. Never make up data or guess IDs.
- When a user asks to do something, call the appropriate tool. Don't just describe what you would do.
- If information is missing (e.g. no instructor specified), ask the user before calling the tool.
- For read-only queries (schedule, members, dashboard), call the tool immediately.
- For write actions (create, cancel, add, send), confirm with the user first by summarising what you're about to do and asking "Shall I go ahead?". Only call the tool after they confirm.
- Use Bangkok timezone (UTC+7) for all dates and times.
- Today is ${today}.
- Keep responses short and clear. Use bullet points for lists.

## Studio Context

Class Types:
${classTypes || '(none configured)'}

Instructors:
${instructors || '(none configured)'}

Class Packs:
${packs || '(none configured)'}

## Important
- You cannot access Stripe, billing, or payment settings.
- You cannot change system settings or modify the app itself.
- If the user asks for something outside your capabilities, politely explain what you can help with.`
}

/**
 * Check daily message usage for a user
 */
async function checkDailyLimit(userId) {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // Get user's conversation IDs
  const { data: convos } = await supabaseAdmin
    .from('agent_conversations')
    .select('id')
    .eq('user_id', userId)

  if (!convos?.length) return false

  const { count } = await supabaseAdmin
    .from('agent_messages')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'user')
    .gte('created_at', todayStart.toISOString())
    .in('conversation_id', convos.map((c) => c.id))

  return (count || 0) >= DAILY_MESSAGE_LIMIT
}

/**
 * Auto-generate a conversation title from the first user message
 */
function generateTitle(message) {
  const clean = message.replace(/[#*_`]/g, '').trim()
  if (clean.length <= 40) return clean
  return clean.slice(0, 40).replace(/\s\S*$/, '') + '...'
}

/**
 * POST /api/admin/agent — Process an agent chat message
 *
 * Body: { messages, conversationId?, newConversation? }
 * Response: { response, toolResults, conversationId }
 */
export async function POST(request) {
  try {
    const session = await auth()
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'owner')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI assistant is not configured.' }, { status: 500 })
    }

    // Burst rate limit: 30 messages per minute
    const { limited } = rateLimit(`agent:${session.user.id}`, 30, 60 * 1000)
    if (limited) {
      return NextResponse.json({ error: 'Too many messages. Please wait a moment.' }, { status: 429 })
    }

    // Daily rate limit
    const dailyLimited = await checkDailyLimit(session.user.id)
    if (dailyLimited) {
      return NextResponse.json({ error: `Daily limit reached (${DAILY_MESSAGE_LIMIT} messages). Try again tomorrow.` }, { status: 429 })
    }

    const body = await request.json()
    const { messages, conversationId, newConversation } = body

    if (!messages?.length) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
    }

    // Resolve or create conversation (best-effort — chat works without persistence)
    let convoId = conversationId
    const userMessage = messages[messages.length - 1]?.content || ''

    try {
      if (newConversation || !convoId) {
        // Enforce conversation cap
        const { count } = await supabaseAdmin
          .from('agent_conversations')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', session.user.id)

        if (count >= MAX_CONVERSATIONS) {
          const { data: oldest } = await supabaseAdmin
            .from('agent_conversations')
            .select('id')
            .eq('user_id', session.user.id)
            .order('updated_at', { ascending: true })
            .limit(count - MAX_CONVERSATIONS + 1)

          if (oldest?.length) {
            await supabaseAdmin.from('agent_conversations').delete().in('id', oldest.map((c) => c.id))
          }
        }

        const { data: convo } = await supabaseAdmin
          .from('agent_conversations')
          .insert({
            user_id: session.user.id,
            title: generateTitle(userMessage),
          })
          .select('id')
          .single()

        convoId = convo?.id
      } else {
        // Verify ownership
        const { data: convo } = await supabaseAdmin
          .from('agent_conversations')
          .select('id')
          .eq('id', convoId)
          .eq('user_id', session.user.id)
          .single()

        if (!convo) convoId = null // conversation missing — continue without persistence
      }

      // Save user message
      if (convoId) {
        await supabaseAdmin.from('agent_messages').insert({
          conversation_id: convoId,
          role: 'user',
          content: userMessage,
        })
      }
    } catch (err) {
      console.error('[admin/agent] Conversation persistence error:', err.message)
      convoId = null // continue without persistence
    }

    const systemPrompt = await buildSystemPrompt(session.user.name)
    const context = { adminId: session.user.id, adminName: session.user.name }

    // Call Claude with tool use
    let response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      tools: AGENT_TOOLS,
      messages,
    })

    // Process tool calls in a loop (Claude may chain multiple tools)
    const toolResults = []
    let iterations = 0
    const MAX_ITERATIONS = 5

    while (response.stop_reason === 'tool_use' && iterations < MAX_ITERATIONS) {
      iterations++
      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use')
      const toolResultMessages = []

      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(toolUse.name, toolUse.input, context)
        toolResults.push({ tool: toolUse.name, input: toolUse.input, result })

        toolResultMessages.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        })
      }

      // Continue conversation with tool results
      response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        tools: AGENT_TOOLS,
        messages: [
          ...messages,
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResultMessages },
        ],
      })
    }

    // Extract text response
    const textContent = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')

    // Save assistant message (best-effort)
    if (convoId) {
      try {
        await supabaseAdmin.from('agent_messages').insert({
          conversation_id: convoId,
          role: 'assistant',
          content: textContent,
          tool_results: toolResults.length ? toolResults : null,
        })
        await supabaseAdmin
          .from('agent_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', convoId)
      } catch (err) {
        console.error('[admin/agent] Message save error:', err.message)
      }
    }

    // Update memory (best-effort, non-blocking)
    updateMemory(session.user.id, userMessage).catch(() => {})

    return NextResponse.json({
      response: textContent,
      toolResults,
      conversationId: convoId,
    })
  } catch (error) {
    console.error('[admin/agent] Error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
