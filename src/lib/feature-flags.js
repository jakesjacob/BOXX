import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Feature flag resolution engine.
 *
 * Resolution order per flag:
 * 1. is_killed = true → always false (global emergency kill)
 * 2. Per-tenant override in tenant_feature_flags → explicit true/false
 * 3. Plan gate: enabled_for_plans includes tenant's plan
 * 4. Rollout %: deterministic hash of (tenantId + flagKey)
 * 5. default_enabled fallback
 *
 * Results are cached in-memory for 5 minutes per tenant.
 */

const CACHE_TTL_MS = 300_000 // 5 minutes — flags rarely change mid-session

// Cache: tenantId → { flags: Map<string, boolean>, plan: string, fetchedAt: number }
const _cache = new Map()

/**
 * Simple deterministic hash for rollout percentage.
 * Returns 0-99 based on input string.
 */
function hashPercent(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % 100
}

/**
 * Load all flags for a tenant (with caching).
 * Returns a Map of flagKey → boolean.
 */
async function loadTenantFlags(tenantId, plan) {
  if (!supabaseAdmin || !tenantId) return new Map()

  const cacheKey = tenantId
  const cached = _cache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS && cached.plan === plan) {
    return cached.flags
  }

  // Fetch all flag definitions and tenant overrides in parallel
  const [flagsRes, overridesRes] = await Promise.all([
    supabaseAdmin.from('feature_flags').select('*'),
    supabaseAdmin.from('tenant_feature_flags').select('flag_key, enabled').eq('tenant_id', tenantId),
  ])

  const allFlags = flagsRes.data || []
  const overrides = new Map((overridesRes.data || []).map(o => [o.flag_key, o.enabled]))

  const resolved = new Map()

  for (const flag of allFlags) {
    // 1. Kill switch
    if (flag.is_killed) {
      resolved.set(flag.key, false)
      continue
    }

    // 2. Per-tenant override
    if (overrides.has(flag.key)) {
      resolved.set(flag.key, overrides.get(flag.key))
      continue
    }

    // 3. Plan gate
    const enabledPlans = flag.enabled_for_plans || []
    if (enabledPlans.length > 0 && plan) {
      if (enabledPlans.includes(plan)) {
        // 4. Rollout percentage
        if (flag.rollout_pct < 100) {
          const bucket = hashPercent(`${tenantId}:${flag.key}`)
          resolved.set(flag.key, bucket < flag.rollout_pct)
        } else {
          resolved.set(flag.key, true)
        }
        continue
      }
      // Plan not in the list → feature not available
      resolved.set(flag.key, false)
      continue
    }

    // 5. Default
    resolved.set(flag.key, flag.default_enabled)
  }

  _cache.set(cacheKey, { flags: resolved, plan, fetchedAt: Date.now() })
  return resolved
}

/**
 * Check if a specific feature is enabled for a tenant.
 *
 * @param {string} tenantId
 * @param {string} flagKey - e.g. 'ai_assistant', 'custom_domain'
 * @param {string} plan - tenant's plan (e.g. 'free', 'starter', 'growth', 'pro', 'enterprise')
 * @returns {Promise<boolean>}
 */
export async function isFeatureEnabled(tenantId, flagKey, plan) {
  const flags = await loadTenantFlags(tenantId, plan)
  return flags.get(flagKey) ?? false
}

/**
 * Get all resolved flags for a tenant.
 * Returns an object { flagKey: boolean, ... }
 *
 * @param {string} tenantId
 * @param {string} plan
 * @returns {Promise<Record<string, boolean>>}
 */
export async function getTenantFlags(tenantId, plan) {
  const flags = await loadTenantFlags(tenantId, plan)
  return Object.fromEntries(flags)
}

/**
 * Get plan limits for a specific plan tier.
 *
 * @param {string} plan - e.g. 'free', 'starter', 'growth', 'pro', 'enterprise'
 * @returns {Promise<object|null>}
 */
export async function getPlanLimits(plan) {
  if (!supabaseAdmin || !plan) return null
  const { data } = await supabaseAdmin
    .from('plan_limits')
    .select('*')
    .eq('plan', plan)
    .single()
  return data || null
}

/**
 * Check if a tenant has exceeded a specific plan limit.
 *
 * @param {string} tenantId
 * @param {string} plan
 * @param {string} limitKey - e.g. 'max_members', 'max_classes_month'
 * @param {number} currentCount
 * @returns {Promise<{ allowed: boolean, limit: number, current: number }>}
 */
export async function checkPlanLimit(tenantId, plan, limitKey, currentCount) {
  const limits = await getPlanLimits(plan)
  if (!limits) return { allowed: true, limit: 9999, current: currentCount }

  const limit = limits[limitKey]
  if (limit === undefined || limit === null) return { allowed: true, limit: 9999, current: currentCount }

  return {
    allowed: currentCount < limit,
    limit,
    current: currentCount,
  }
}

/**
 * Invalidate cached flags for a tenant.
 * Call this when plan changes or flags are updated.
 */
export function invalidateFlagCache(tenantId) {
  if (tenantId) {
    _cache.delete(tenantId)
  } else {
    _cache.clear()
  }
}
