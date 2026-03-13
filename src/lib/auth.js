import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { cookies, headers } from 'next/headers'
import bcrypt from 'bcryptjs'

export const { handlers, auth, signIn, signOut } = NextAuth({
  cookies: {
    // Set all auth cookies on the root domain so they work across subdomains
    // (OAuth starts on slug.zatrovo.com but callback lands on zatrovo.com)
    // CSRF token must NOT use __Host- prefix (which forbids domain attribute)
    csrfToken: {
      name: 'authjs.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.NEXT_PUBLIC_BASE_DOMAIN ? `.${process.env.NEXT_PUBLIC_BASE_DOMAIN}` : undefined,
      },
    },
    pkceCodeVerifier: {
      name: 'authjs.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.NEXT_PUBLIC_BASE_DOMAIN ? `.${process.env.NEXT_PUBLIC_BASE_DOMAIN}` : undefined,
      },
    },
    state: {
      name: 'authjs.state',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.NEXT_PUBLIC_BASE_DOMAIN ? `.${process.env.NEXT_PUBLIC_BASE_DOMAIN}` : undefined,
      },
    },
    callbackUrl: {
      name: 'authjs.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.NEXT_PUBLIC_BASE_DOMAIN ? `.${process.env.NEXT_PUBLIC_BASE_DOMAIN}` : undefined,
      },
    },
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-authjs.session-token' : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.NEXT_PUBLIC_BASE_DOMAIN ? `.${process.env.NEXT_PUBLIC_BASE_DOMAIN}` : undefined,
      },
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile',
        },
      },
    }),
    Credentials({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        tenantId: { label: 'Tenant', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        if (!supabaseAdmin) return null

        // Tenant-scoped login: if tenantId provided, scope lookup
        let query = supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', credentials.email.toLowerCase())

        if (credentials.tenantId) {
          query = query.eq('tenant_id', credentials.tenantId)
        }

        const { data: user, error } = await query.single()

        if (error || !user || !user.password_hash) return null

        const valid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!valid) return null

        // Block frozen accounts
        if (user.role === 'frozen') return null

        // Look up tenant slug for redirect after login
        let tenantSlug = null
        if (user.tenant_id) {
          const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('slug')
            .eq('id', user.tenant_id)
            .single()
          tenantSlug = tenant?.slug
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar_url,
          role: user.role,
          tenantId: user.tenant_id,
          tenantSlug,
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days for members
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        if (!supabaseAdmin) {
          console.error('[auth] Google signIn: supabaseAdmin not configured')
          return false
        }

        // Read target tenant from cookie (set by login/register page before OAuth redirect)
        // Use raw Cookie header for reliability — cookies() can be unreliable in NextAuth callbacks
        let targetTenantId = null
        try {
          const headersList = await headers()
          const cookieHeader = headersList.get('cookie') || ''
          const tidMatch = cookieHeader.match(/pending_tenant_id=([^;]+)/)
          if (tidMatch) targetTenantId = tidMatch[1].trim()
        } catch (e) {
          console.error('[auth] headers() failed:', e.message)
        }

        // Try to clear pending cookies
        try {
          const cookieStore = await cookies()
          const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN
          const cookieOpts = {
            path: '/',
            ...(baseDomain ? { domain: `.${baseDomain}` } : {}),
          }
          cookieStore.delete({ name: 'pending_tenant_id', ...cookieOpts })
          cookieStore.delete({ name: 'pending_tenant_slug', ...cookieOpts })
        } catch {
          // Best effort cleanup
        }

        // Helper to populate user fields + tenant slug
        async function setUserFields(dbUser) {
          user.id = dbUser.id
          user.role = dbUser.role
          user.image = dbUser.avatar_url
          user.tenantId = dbUser.tenant_id
          const { data: t } = await supabaseAdmin.from('tenants').select('slug').eq('id', dbUser.tenant_id).single()
          user.tenantSlug = t?.slug
        }

        try {
          // 1. If we have a target tenant, look for user on THAT tenant first
          if (targetTenantId) {
            // Check by google_id on target tenant
            const { data: onTenant } = await supabaseAdmin
              .from('users')
              .select('*')
              .eq('google_id', account.providerAccountId)
              .eq('tenant_id', targetTenantId)
              .single()

            if (onTenant) {
              if (onTenant.role === 'frozen') return false
              await setUserFields(onTenant)
              return true
            }

            // Check by email on target tenant (link Google account)
            const { data: byEmail } = await supabaseAdmin
              .from('users')
              .select('*')
              .eq('email', user.email.toLowerCase())
              .eq('tenant_id', targetTenantId)
              .single()

            if (byEmail) {
              if (byEmail.role === 'frozen') return false
              const { error: linkError } = await supabaseAdmin
                .from('users')
                .update({ google_id: account.providerAccountId, avatar_url: user.image })
                .eq('id', byEmail.id)
              if (linkError) console.error('[auth] link error:', linkError.message)
              await setUserFields(byEmail)
              return true
            }

            // New user on target tenant — create account
            const { data: newUser, error } = await supabaseAdmin
              .from('users')
              .insert({
                email: user.email.toLowerCase(),
                name: user.name,
                avatar_url: user.image,
                google_id: account.providerAccountId,
                role: 'member',
                tenant_id: targetTenantId,
              })
              .select()
              .single()

            if (error) {
              console.error('[auth] create user failed:', error.message)
              return false
            }

            await setUserFields(newUser)
            return true
          }

          // 2. No target tenant (root domain login) — find by google_id globally
          const { data: existing } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('google_id', account.providerAccountId)
            .limit(1)
            .single()

          if (existing) {
            if (existing.role === 'frozen') return false
            await setUserFields(existing)
            return true
          }

          // 3. No google_id match, no target tenant — check by email globally
          const { data: byEmailGlobal } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('email', user.email.toLowerCase())
            .limit(1)
            .single()

          if (byEmailGlobal) {
            if (byEmailGlobal.role === 'frozen') return false
            await supabaseAdmin
              .from('users')
              .update({ google_id: account.providerAccountId, avatar_url: user.image })
              .eq('id', byEmailGlobal.id)
            await setUserFields(byEmailGlobal)
            return true
          }

          // 4. Completely new user, no target tenant — use default
          const defaultTenantId = process.env.DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'
          const { data: newUser, error } = await supabaseAdmin
            .from('users')
            .insert({
              email: user.email.toLowerCase(),
              name: user.name,
              avatar_url: user.image,
              google_id: account.providerAccountId,
              role: 'member',
              tenant_id: defaultTenantId,
            })
            .select()
            .single()

          if (error) {
            console.error('[auth] create on default failed:', error.message)
            return false
          }

          await setUserFields(newUser)
        } catch (err) {
          console.error('[auth] Google signIn error:', err.message)
          return false
        }
      }

      return true
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.role = user.role || 'member'
        token.tenantId = user.tenantId
        token.tenantSlug = user.tenantSlug
      }
      // Refresh token data when session.update() is called (e.g. after onboarding)
      if (trigger === 'update' && token.id) {
        const { data } = await supabaseAdmin
          .from('users')
          .select('tenant_id, role')
          .eq('id', token.id)
          .single()
        if (data) {
          token.tenantId = data.tenant_id
          token.role = data.role
          const { data: t } = await supabaseAdmin.from('tenants').select('slug').eq('id', data.tenant_id).single()
          token.tenantSlug = t?.slug
        }
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      session.user.role = token.role
      session.user.tenantId = token.tenantId
      session.user.tenantSlug = token.tenantSlug

      // Admin, owner, and employee sessions expire after 8 hours
      if (token.role === 'owner' || token.role === 'admin' || token.role === 'employee') {
        const eightHours = 8 * 60 * 60 * 1000
        const tokenAge = Date.now() - (token.iat * 1000)
        if (tokenAge > eightHours) {
          return null // Force re-login
        }
      }

      return session
    },
    async redirect({ url, baseUrl }) {
      // Allow redirects to any subdomain of our base domain
      // IMPORTANT: always return absolute URLs — NextAuth client does new URL(data.url)
      // which throws on relative paths
      const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN
      if (baseDomain) {
        try {
          const parsed = new URL(url, baseUrl)
          if (parsed.hostname === baseDomain || parsed.hostname.endsWith(`.${baseDomain}`)) {
            return parsed.href
          }
        } catch {
          // Invalid URL — fall through to default
        }
      }
      // Default: allow relative URLs and same-origin
      if (url.startsWith('/')) return `${baseUrl}${url}`
      if (url.startsWith(baseUrl)) return url
      return baseUrl
    },
  },
})
