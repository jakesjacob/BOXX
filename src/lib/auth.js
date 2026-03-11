import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { supabaseAdmin } from '@/lib/supabase/admin'
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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        if (!supabaseAdmin) return null

        // Tenant-scoped login: if tenantId provided, scope lookup
        const query = supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', credentials.email.toLowerCase())

        if (credentials.tenantId) {
          query.eq('tenant_id', credentials.tenantId)
        }

        const { data: user, error } = await query.single()

        if (error || !user || !user.password_hash) return null

        const valid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!valid) return null

        // Block frozen accounts
        if (user.role === 'frozen') return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar_url,
          role: user.role,
          tenantId: user.tenant_id,
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
          return true
        }

        // New Google user — create account
        // Resolve tenant from the request context (stored in account metadata)
        const tenantId = account.tenantId || process.env.DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'

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
          // Email might already exist with password auth
          // Don't auto-link — security risk
          console.error('[auth] Google signup failed:', error.message)
          return false
        }

        user.id = newUser.id
        user.role = newUser.role
        user.tenantId = newUser.tenant_id
      }

      return true
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.role = user.role || 'member'
        token.tenantId = user.tenantId
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
        }
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      session.user.role = token.role
      session.user.tenantId = token.tenantId

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
