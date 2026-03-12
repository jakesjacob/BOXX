import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

/**
 * Smart redirect after login (especially Google OAuth).
 * Reads the session, determines role & tenant, redirects to the right place.
 */
export default async function AuthRedirectPage() {
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
