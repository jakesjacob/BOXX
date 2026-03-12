import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

export const { handlers, auth, signIn, signOut } = NextAuth({
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

        console.log('[auth] authorize called. email:', credentials.email, 'tenantId:', credentials.tenantId)

        // Tenant-scoped login: if tenantId provided, scope lookup
        const query = supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', credentials.email.toLowerCase())

        if (credentials.tenantId) {
          query.eq('tenant_id', credentials.tenantId)
        }

        const { data: user, error } = await query.single()

        if (error || !user || !user.password_hash) {
          console.log('[auth] authorize failed. error:', error?.message, 'user found:', !!user)
          return null
        }

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

        console.log('[auth] authorize success. userId:', user.id, 'tenant_id:', user.tenant_id, 'role:', user.role)
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
        if (!supabaseAdmin) return false

        // Check if user exists by google_id first
        const { data: existing } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('google_id', account.providerAccountId)
          .single()

        if (existing) {
          if (existing.role === 'frozen') return false
          user.id = existing.id
          user.role = existing.role
          user.image = existing.avatar_url
          user.tenantId = existing.tenant_id
          // Look up slug for redirect
          const { data: t } = await supabaseAdmin.from('tenants').select('slug').eq('id', existing.tenant_id).single()
          user.tenantSlug = t?.slug
          return true
        }

        // New Google user — create account
        // Read tenant from cookie set by login/register page before OAuth redirect
        let tenantId = process.env.DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'
        try {
          const cookieStore = await cookies()
          const pendingTenant = cookieStore.get('pending_tenant_id')?.value
          if (pendingTenant) tenantId = pendingTenant
        } catch {
          // cookies() may not be available in all contexts
        }

        // Check if a user with this email already exists on the target tenant
        const { data: existingByEmail } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', user.email.toLowerCase())
          .eq('tenant_id', tenantId)
          .single()

        if (existingByEmail) {
          // Link Google account to existing email user
          if (existingByEmail.role === 'frozen') return false
          await supabaseAdmin
            .from('users')
            .update({ google_id: account.providerAccountId, avatar_url: user.image })
            .eq('id', existingByEmail.id)

          user.id = existingByEmail.id
          user.role = existingByEmail.role
          user.tenantId = existingByEmail.tenant_id
          const { data: t2 } = await supabaseAdmin.from('tenants').select('slug').eq('id', existingByEmail.tenant_id).single()
          user.tenantSlug = t2?.slug
          return true
        }

        // Truly new user — create account
        const { data: newUser, error } = await supabaseAdmin
          .from('users')
          .insert({
            email: user.email.toLowerCase(),
            name: user.name,
            avatar_url: user.image,
            google_id: account.providerAccountId,
            role: 'member',
            tenant_id: tenantId,
          })
          .select()
          .single()

        if (error) {
          console.error('[auth] Google signup failed:', error.message)
          return false
        }

        user.id = newUser.id
        user.role = newUser.role
        user.tenantId = newUser.tenant_id
        const { data: t3 } = await supabaseAdmin.from('tenants').select('slug').eq('id', newUser.tenant_id).single()
        user.tenantSlug = t3?.slug
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
  },
})
