import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

const memberRoutes = ['/dashboard', '/book', '/profile', '/buy-classes', '/my-bookings', '/confirmation']

// ─── Tenant slug/domain → ID cache ──────────────────────────────────────────
const tenantCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function resolveSlugToTenantId(slug) {
  const cacheKey = `slug:${slug}`
  const cached = tenantCache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) return cached.tenantId

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/tenants?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=id`,
      {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
      }
    )
    const data = await res.json()
    const tenantId = data?.[0]?.id || null
    tenantCache.set(cacheKey, { tenantId, expiresAt: Date.now() + CACHE_TTL })
    return tenantId
  } catch {
    return null
  }
}

async function resolveCustomDomainToTenantId(domain) {
  const cacheKey = `domain:${domain}`
  const cached = tenantCache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) return cached.tenantId

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/tenants?custom_domain=eq.${encodeURIComponent(domain)}&is_active=eq.true&select=id`,
      {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
      }
    )
    const data = await res.json()
    const tenantId = data?.[0]?.id || null
    tenantCache.set(cacheKey, { tenantId, expiresAt: Date.now() + CACHE_TTL })
    return tenantId
  } catch {
    return null
  }
}

/**
 * Resolve tenant from the request host.
 * Returns { tenantId, slug } or null.
 */
async function resolveTenantFromHost(req) {
  const host = req.headers.get('host') || ''
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'localhost:3000'

  // Subdomain match: slug.basedomain.com
  if (host.endsWith(`.${baseDomain}`)) {
    const slug = host.replace(`.${baseDomain}`, '').split('.')[0]
    if (slug && slug !== 'www') {
      const tenantId = await resolveSlugToTenantId(slug)
      return tenantId ? { tenantId, slug } : null
    }
  }

  // Custom domain match (not baseDomain, not www, not localhost, not vercel.app)
  if (
    host !== baseDomain &&
    host !== `www.${baseDomain}` &&
    !host.includes('localhost') &&
    !host.includes('vercel.app')
  ) {
    const tenantId = await resolveCustomDomainToTenantId(host)
    return tenantId ? { tenantId, slug: null } : null
  }

  return null
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Resolve tenant from subdomain/custom domain
  const tenant = await resolveTenantFromHost(req)
  const response = NextResponse.next()

  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'localhost:3000'
  const host = req.headers.get('host') || ''
  const isRootDomain = host === baseDomain || host === `www.${baseDomain}`

  if (tenant) {
    // Subdomain-resolved tenant ID — this is the source of truth for pre-auth pages
    response.headers.set('x-tenant-id', tenant.tenantId)
    if (tenant.slug) {
      response.headers.set('x-tenant-slug', tenant.slug)
    }
  } else if (isRootDomain && session?.user?.tenantSlug) {
    // Authenticated user on root domain — redirect to their tenant subdomain
    // (This happens after Google OAuth callback lands on zatrovo.com)
    const slug = session.user.tenantSlug
    const role = session.user.role
    const isStaff = ['owner', 'admin', 'employee'].includes(role)

    // Only redirect for pages that should be tenant-scoped (not /onboarding, /auth/redirect, etc.)
    const shouldRedirect = pathname === '/dashboard' || pathname.startsWith('/admin') ||
      pathname === '/book' || pathname === '/buy-classes' || pathname === '/my-bookings' ||
      pathname === '/profile'

    if (shouldRedirect) {
      const targetPath = pathname === '/dashboard' && isStaff ? '/admin' : pathname
      return NextResponse.redirect(new URL(`https://${slug}.${baseDomain}${targetPath}`))
    }

    // For login/register on root domain with error params, redirect to subdomain login
    if ((pathname === '/login' || pathname === '/register') && req.nextUrl.search) {
      return NextResponse.redirect(new URL(`https://${slug}.${baseDomain}${pathname}${req.nextUrl.search}`))
    }

    response.headers.set('x-tenant-id', session.user.tenantId)
  } else if (isRootDomain && !session && (pathname === '/login' || pathname === '/register') && req.nextUrl.search) {
    // Unauthenticated error redirect on root domain (e.g. Google OAuth failure)
    // Use pending_tenant_id cookie to redirect back to the correct subdomain
    const pendingTenantSlug = req.cookies.get('pending_tenant_slug')?.value
    if (pendingTenantSlug) {
      return NextResponse.redirect(new URL(`https://${pendingTenantSlug}.${baseDomain}${pathname}${req.nextUrl.search}`))
    }
  } else if (session?.user?.tenantId) {
    // Authenticated user's tenant from JWT (for non-subdomain access like vercel.app)
    response.headers.set('x-tenant-id', session.user.tenantId)
  }

  // Check member routes
  const isProtected = memberRoutes.some((r) => pathname.startsWith(r))
  if (isProtected && !session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname + req.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  // Block frozen users from accessing member routes
  if (isProtected && session?.user?.role === 'frozen') {
    return NextResponse.redirect(new URL('/login?error=frozen', req.url))
  }

  // Check admin routes — allow admin and employee roles
  if (pathname.startsWith('/admin')) {
    if (!session) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
    const role = session.user.role
    if (role !== 'owner' && role !== 'admin' && role !== 'employee') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Employee restrictions — block admin-only pages
    if (role === 'employee') {
      const adminOnlyPaths = ['/admin/settings', '/admin/packs']
      if (adminOnlyPaths.some((p) => pathname.startsWith(p))) {
        return NextResponse.redirect(new URL('/admin', req.url))
      }
    }
  }

  return response
})

export const config = {
  matcher: [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password/:path*',
    '/dashboard/:path*',
    '/book/:path*',
    '/profile/:path*',
    '/buy-classes/:path*',
    '/my-bookings/:path*',
    '/confirmation/:path*',
    '/admin/:path*',
    '/auth/:path*',
    '/api/:path*',
  ],
}
