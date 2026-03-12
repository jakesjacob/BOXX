'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'

export default function RegisterForm({ tenantId, tenantSlug }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!consent) {
      setError('You must agree to the Privacy Policy and Terms of Service')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          consent,
          tenantId: tenantId || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        setLoading(false)
        return
      }

      // Auto-login after registration
      const result = await signIn('credentials', {
        email,
        password,
        tenantId: tenantId || undefined,
        redirect: false,
      })

      if (result?.ok || result?.url) {
        // Members always go to /dashboard, but make sure we stay on the right subdomain
        const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || ''
        const hostname = window.location.hostname
        const isOnSubdomain = baseDomain && hostname.endsWith(`.${baseDomain}`)

        if (isOnSubdomain) {
          // Already on tenant subdomain — stay here
          window.location.href = '/dashboard'
        } else if (tenantSlug && baseDomain && !baseDomain.includes('localhost')) {
          // Root domain — redirect to tenant subdomain
          window.location.href = `https://${tenantSlug}.${baseDomain}/dashboard`
        } else {
          window.location.href = '/dashboard'
        }
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const handleGoogleRegister = () => {
    // Set cookies so the OAuth callback can associate with this tenant
    // Use root domain so cookies are readable at zatrovo.com (where OAuth callback lands)
    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || ''
    const domainAttr = baseDomain && !baseDomain.includes('localhost') ? `;domain=.${baseDomain}` : ''
    if (tenantId) {
      document.cookie = `pending_tenant_id=${tenantId};path=/;max-age=600;samesite=lax${domainAttr}`
    }
    if (tenantSlug) {
      document.cookie = `pending_tenant_slug=${tenantSlug};path=/;max-age=600;samesite=lax${domainAttr}`
    }
    // Use the smart redirect page — it reads the session and redirects to the right tenant/role
    signIn('google', { callbackUrl: '/auth/redirect' })
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-card-border rounded-lg p-8">
          <h1 className="text-2xl font-bold text-foreground text-center mb-2">
            Create your account
          </h1>
          <p className="text-muted text-sm text-center mb-8">
            Sign up to get started
          </p>

          {error && (
            <div className="mb-6 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* Google OAuth */}
          <button
            onClick={handleGoogleRegister}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded bg-white text-[#0a0a0a] font-medium hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign up with Google
          </button>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-card-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted">or create an account</span>
            </div>
          </div>

          {/* Email Register */}
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm text-muted mb-1.5">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded bg-background border border-card-border text-foreground placeholder-muted/50 focus:outline-none focus:border-accent transition-colors"
                placeholder="Your name"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm text-muted mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded bg-background border border-card-border text-foreground placeholder-muted/50 focus:outline-none focus:border-accent transition-colors"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm text-muted mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 rounded bg-background border border-card-border text-foreground placeholder-muted/50 focus:outline-none focus:border-accent transition-colors"
                placeholder="At least 8 characters"
              />
            </div>

            {/* Consent checkbox */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-card-border bg-background accent-accent"
              />
              <span className="text-sm text-muted">
                I agree to the{' '}
                <Link href="/privacy" className="text-accent hover:text-accent-dim">
                  Privacy Policy
                </Link>{' '}
                and{' '}
                <Link href="/terms" className="text-accent hover:text-accent-dim">
                  Terms of Service
                </Link>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded bg-accent text-background font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            Already have an account?{' '}
            <Link href="/login" className="text-accent hover:text-accent-dim transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
