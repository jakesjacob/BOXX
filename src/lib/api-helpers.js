import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Tenant-aware auth helpers for API routes.
 *
 * All helpers return { session, tenantId, ... } on success,
 * or { response } with an error Response on failure.
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

function getTenantId(session, request) {
  // 1. From JWT/session (primary source of truth)
  if (session?.user?.tenantId) return session.user.tenantId

  // 2. From middleware-injected header
  if (request) {
    const headerTenantId = request.headers.get('x-tenant-id')
    if (headerTenantId) return headerTenantId
  }

  // 3. Fallback to default (Bert's tenant) during migration
  return DEFAULT_TENANT_ID
}

/**
 * Require any authenticated user. Returns tenantId.
 */
export async function requireAuth(request) {
  const session = await auth()
  if (!session) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  // Block frozen users
  if (session.user.role === 'frozen') {
    return { response: NextResponse.json({ error: 'Account frozen' }, { status: 403 }) }
  }

  const tenantId = getTenantId(session, request)

  return { session, tenantId }
}

/**
 * Require staff access (owner, admin, or employee). Returns tenantId.
 */
export async function requireStaff(request) {
  const session = await auth()
  console.log('[requireStaff] session:', session ? { id: session.user?.id, role: session.user?.role, tenantId: session.user?.tenantId } : 'NULL')
  if (!session) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const role = session.user.role
  if (role !== 'owner' && role !== 'admin' && role !== 'employee') {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const tenantId = getTenantId(session, request)

  return {
    session,
    tenantId,
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
  const role = session?.user?.role
  console.log('[requireAdmin] session:', session ? { id: session.user?.id, role, tenantId: session.user?.tenantId } : 'NULL')
  if (!session || (role !== 'admin' && role !== 'owner')) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const tenantId = getTenantId(session, request)

  return { session, tenantId, isOwner: role === 'owner' }
}

/**
 * Require owner access. Returns tenantId.
 */
export async function requireOwner(request) {
  const session = await auth()
  if (!session || session.user.role !== 'owner') {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const tenantId = getTenantId(session, request)

  return { session, tenantId }
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
