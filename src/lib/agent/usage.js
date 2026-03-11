/**
 * Agent Usage Tracking — Track AI token spend per user per month.
 * Free tier: $2.00/month. Pricing based on Claude Haiku 4.5.
 */
import { supabaseAdmin } from '@/lib/supabase/admin'

// Haiku 4.5 pricing (USD per token)
const INPUT_COST = 1.00 / 1_000_000   // $1.00 per 1M input tokens
const OUTPUT_COST = 5.00 / 1_000_000  // $5.00 per 1M output tokens

const MONTHLY_LIMIT_USD = 2.00

function currentMonth() {
  // Use Bangkok timezone so the month resets at midnight Bangkok time
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }).slice(0, 7)
}

/**
 * Calculate cost from token counts
 */
export function calculateCost(inputTokens, outputTokens) {
  return (inputTokens * INPUT_COST) + (outputTokens * OUTPUT_COST)
}

/**
 * Get current month's usage for a user.
 * Returns { cost_usd, input_tokens, output_tokens, limit_usd, limited }
 */
export async function getUsage(userId) {
  const month = currentMonth()

  try {
    const { data } = await supabaseAdmin
      .from('agent_usage')
      .select('input_tokens, output_tokens, cost_usd')
      .eq('user_id', userId)
      .eq('month', month)
      .single()

    const cost = data ? parseFloat(data.cost_usd) : 0
    return {
      cost_usd: cost,
      input_tokens: data?.input_tokens || 0,
      output_tokens: data?.output_tokens || 0,
      limit_usd: MONTHLY_LIMIT_USD,
      limited: cost >= MONTHLY_LIMIT_USD,
    }
  } catch {
    return {
      cost_usd: 0,
      input_tokens: 0,
      output_tokens: 0,
      limit_usd: MONTHLY_LIMIT_USD,
      limited: false,
    }
  }
}

/**
 * Check if user has exceeded monthly limit.
 */
export async function checkUsageLimit(userId) {
  const usage = await getUsage(userId)
  return usage.limited
}

/**
 * Record token usage after an API call.
 * Uses atomic RPC to avoid race conditions with concurrent requests.
 */
export async function trackUsage(userId, inputTokens, outputTokens) {
  const month = currentMonth()
  const cost = calculateCost(inputTokens, outputTokens)

  try {
    const { error } = await supabaseAdmin.rpc('increment_agent_usage', {
      p_user_id: userId,
      p_month: month,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_cost: cost,
    })

    if (error) {
      console.error('[agent/usage] RPC error:', error.message)
    }
  } catch (err) {
    console.error('[agent/usage] Track error:', err.message)
  }
}
