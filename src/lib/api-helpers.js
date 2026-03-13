import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Tenant-aware auth helpers for API routes.
 *
 * All helpers return { session, tenantId, ... } on success,
 * or { response } with an error Response on failure.
 *
 * IMPORTANT: When the user is on a different subdomain than they logged in on,
 * these helpers look up the user's ACTUAL record on the current tenant from the DB.
 * This ensures the correct userId, role, and tenantId are used for all queries.
 *
 * Usage:
 *   const result = await requireAuth()
 *   if (result.response) return result.response
 *   const { session, tenantId } = result
 */

// Default tenant for backward compatibility during migration
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'

// Tenant plan cache: tenantId → { plan, fetchedAt }
const _planCache = new Map()
const PLAN_CACHE_TTL = 60_000 // 1 minute
const MAX_PLAN_CACHE = 500

function getRequestTenantId(request) {
  if (request) {
    const headerTenantId = request.headers.get('x-tenant-id')
    if (headerTenantId) return headerTenantId
  }
  return null
}

/**
 * Resolve the correct user identity for the current tenant.
 *
 * If the JWT tenant matches the subdomain tenant → use JWT data (fast path, no DB call).
 * If they differ → look up the user by email on the current tenant (slow path, 1 DB call).
 *
 * Returns { userId, role, tenantId } or null if user doesn't exist on this tenant.
 */
async function resolveUser(session, request) {
  const headerTenantId = getRequestTenantId(request)
  const jwtTenantId = session.user.tenantId
  const tenantId = headerTenantId || jwtTenantId || DEFAULT_TENANT_ID

  // Fast path: JWT tenant matches request tenant (or no subdomain header)
  if (!headerTenantId || headerTenantId === jwtTenantId) {
    return {
      userId: session.user.id,
      role: session.user.role,
      tenantId,
    }
  }

  // Slow path: user is on a different tenant's subdomain — look up their record
  const email = session.user.email
  if (!email || !supabaseAdmin) return null

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, role')
    .eq('email', email.toLowerCase())
    .eq('tenant_id', tenantId)
    .single()

  if (!user) return null

  return {
    userId: user.id,
    role: user.role,
    tenantId,
  }
}

/**
 * Patch the session object with the resolved user data for the current tenant.
 * This ensures session.user.id and session.user.role are correct for downstream code.
 */
function patchSession(session, resolved) {
  return {
    ...session,
    user: {
      ...session.user,
      id: resolved.userId,
      role: resolved.role,
      tenantId: resolved.tenantId,
    },
  }
}

/**
 * Require any authenticated user. Returns tenantId.
 */
export async function requireAuth(request) {
  const session = await auth()
  if (!session) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const resolved = await resolveUser(session, request)
  if (!resolved) {
    return { response: NextResponse.json({ error: 'No account on this studio' }, { status: 401 }) }
  }

  // Block frozen users
  if (resolved.role === 'frozen') {
    return { response: NextResponse.json({ error: 'Account frozen' }, { status: 403 }) }
  }

  return { session: patchSession(session, resolved), tenantId: resolved.tenantId }
}

/**
 * Require staff access (owner, admin, or employee). Returns tenantId.
 */
export async function requireStaff(request) {
  const session = await auth()
  if (!session) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const resolved = await resolveUser(session, request)
  if (!resolved) {
    return { response: NextResponse.json({ error: 'No account on this studio' }, { status: 401 }) }
  }

  const { role } = resolved
  if (role !== 'owner' && role !== 'admin' && role !== 'employee') {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  return {
    session: patchSession(session, resolved),
    tenantId: resolved.tenantId,
    isOwner: role === 'owner',
    isAdmin: role === 'admin' || role === 'owner',
    isEmployee: role === 'employee',
  }
}

/**
 * Require admin or owner access. Returns tenantId.
 */
export async function requireAdmin(request) {
  const session = await auth()
  if (!session) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const resolved = await resolveUser(session, request)
  if (!resolved) {
    return { response: NextResponse.json({ error: 'No account on this studio' }, { status: 401 }) }
  }

  const { role } = resolved
  if (role !== 'admin' && role !== 'owner') {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  return {
    session: patchSession(session, resolved),
    tenantId: resolved.tenantId,
    isOwner: role === 'owner',
  }
}

/**
 * Require owner access. Returns tenantId.
 */
export async function requireOwner(request) {
  const session = await auth()
  if (!session) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const resolved = await resolveUser(session, request)
  if (!resolved || resolved.role !== 'owner') {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  return {
    session: patchSession(session, resolved),
    tenantId: resolved.tenantId,
  }
}

/**
 * Get the plan for a tenant (cached for 1 minute).
 */
export async function getTenantPlan(tenantId) {
  if (!tenantId || !supabaseAdmin) return 'free'

  const cached = _planCache.get(tenantId)
  if (cached && Date.now() - cached.fetchedAt < PLAN_CACHE_TTL) {
    return cached.plan
  }

  const { data } = await supabaseAdmin
    .from('tenants')
    .select('plan')
    .eq('id', tenantId)
    .single()

  const plan = data?.plan || 'free'
  if (_planCache.size >= MAX_PLAN_CACHE) {
    const now = Date.now()
    for (const [k, v] of _planCache) { if (now - v.fetchedAt >= PLAN_CACHE_TTL) _planCache.delete(k) }
    if (_planCache.size >= MAX_PLAN_CACHE) _planCache.clear()
  }
  _planCache.set(tenantId, { plan, fetchedAt: Date.now() })
  return plan
}

/**
 * Check if a feature flag is enabled for the request's tenant.
 * Returns { allowed: true, plan } or a 402 JSON response with upgrade info.
 *
 * Usage:
 *   const flag = await requireFeature(tenantId, 'ai_assistant')
 *   if (flag.response) return flag.response
 */
export async function requireFeature(tenantId, flagKey) {
  const { isFeatureEnabled } = await import('@/lib/feature-flags')
  const plan = await getTenantPlan(tenantId)
  const enabled = await isFeatureEnabled(tenantId, flagKey, plan)

  if (!enabled) {
    return {
      response: NextResponse.json({
        error: 'Feature not available on your current plan',
        feature: flagKey,
        plan,
        upgradeUrl: '/admin/settings?tab=billing',
      }, { status: 402 }),
    }
  }

  return { allowed: true, plan }
}
