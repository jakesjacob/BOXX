import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// Public keys that are safe to expose
const PUBLIC_KEYS = [
  'studio_name', 'studio_address', 'studio_phone', 'studio_email', 'studio_website',
  'social_instagram', 'social_tiktok', 'social_facebook', 'social_line', 'social_youtube',
  'seo_title', 'seo_description', 'seo_keywords', 'seo_url',
  'seo_og_title', 'seo_og_description', 'seo_og_image',
]

/**
 * GET /api/settings/public — Public studio settings (no auth required)
 * Cached for 60 seconds to avoid hammering DB on every page load
 */
export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ settings: {} })
    }

    const { data } = await supabaseAdmin
      .from('studio_settings')
      .select('key, value')
      .in('key', PUBLIC_KEYS)

    const settings = Object.fromEntries((data || []).map((r) => [r.key, r.value]))

    return NextResponse.json({ settings }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('[settings/public] Error:', error)
    return NextResponse.json({ settings: {} })
  }
}
