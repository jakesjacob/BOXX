import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const RESERVED_SLUGS = [
  'www', 'app', 'api', 'admin', 'login', 'register', 'signup', 'onboarding',
  'dashboard', 'settings', 'billing', 'support', 'help', 'docs', 'blog',
  'mail', 'email', 'ftp', 'ssh', 'status', 'cdn', 'static', 'assets',
  'demo', 'test', 'staging', 'dev', 'localhost', 'null', 'undefined',
]

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/

export async function POST(request) {
  try {
    const { slug } = await request.json()

    if (!slug) {
      return NextResponse.json({ available: false, error: 'Slug is required' })
    }

    const normalized = slug.toLowerCase().trim()

    if (!SLUG_REGEX.test(normalized)) {
      return NextResponse.json({
        available: false,
        error: 'Must be 3-50 characters, lowercase letters, numbers, and hyphens only',
      })
    }

    if (RESERVED_SLUGS.includes(normalized)) {
      return NextResponse.json({ available: false, error: 'This name is reserved' })
    }

    const { data } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('slug', normalized)
      .single()

    return NextResponse.json({ available: !data, slug: normalized })
  } catch {
    return NextResponse.json({ available: false, error: 'Check failed' }, { status: 500 })
  }
}
