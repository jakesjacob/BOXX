import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { auth } from '@/lib/auth'

/**
 * Smart redirect after login (especially Google OAuth).
 * Reads the session, determines role & tenant, redirects to the right place.
 */
export default async function AuthRedirectPage() {
  // Clear pending tenant cookies so they don't leak into the next OAuth attempt
  try {
    const cookieStore = await cookies()
    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN
    const cookieOpts = {
      path: '/',
      ...(baseDomain ? { domain: `.${baseDomain}` } : {}),
    }
    if (cookieStore.get('pending_tenant_id')?.value) {
      cookieStore.delete({ name: 'pending_tenant_id', ...cookieOpts })
    }
    if (cookieStore.get('pending_tenant_slug')?.value) {
      cookieStore.delete({ name: 'pending_tenant_slug', ...cookieOpts })
    }
  } catch {
    // Best effort
  }

  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const { role, tenantSlug } = session.user
  const isStaff = ['owner', 'admin', 'employee'].includes(role)
  const targetPath = isStaff ? '/admin' : '/dashboard'

  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || ''

  if (tenantSlug && baseDomain && !baseDomain.includes('localhost')) {
    redirect(`https://${tenantSlug}.${baseDomain}${targetPath}`)
  }

  redirect(targetPath)
}
