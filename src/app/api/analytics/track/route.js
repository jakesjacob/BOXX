import { headers } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

const BOT_PATTERNS = [
  'bot', 'crawl', 'spider', 'slurp', 'facebookexternalhit',
  'linkedinbot', 'twitterbot', 'whatsapp', 'telegram',
  'pingdom', 'uptimerobot', 'headlesschrome', 'lighthouse',
  'googleother', 'bingpreview', 'yandex', 'baidu',
]

function isBot(userAgent) {
  if (!userAgent) return true
  const ua = userAgent.toLowerCase()
  return BOT_PATTERNS.some((pattern) => ua.includes(pattern))
}

function getDeviceType(screenWidth) {
  if (!screenWidth || typeof screenWidth !== 'number') return 'desktop'
  if (screenWidth < 768) return 'mobile'
  if (screenWidth < 1024) return 'tablet'
  return 'desktop'
}

export async function POST(request) {
  try {
    const headersList = await headers()
    const userAgent = headersList.get('user-agent') || ''

    // Ignore bots
    if (isBot(userAgent)) {
      return new Response(null, { status: 204 })
    }

    // Rate limit by IP
    const ip =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      'unknown'

    const { limited } = rateLimit(`analytics:${ip}`, 60, 60 * 1000)
    if (limited) {
      return new Response(null, { status: 429 })
    }

    const body = await request.json()

    // Validate path
    if (!body.path || typeof body.path !== 'string' || !body.path.startsWith('/')) {
      return new Response(null, { status: 400 })
    }

    const deviceType = getDeviceType(body.screen_width)

    await supabaseAdmin.from('page_views').insert({
      path: body.path,
      referrer: body.referrer || null,
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
      device_type: deviceType,
    })

    return new Response(null, { status: 204 })
  } catch {
    // Silently fail — analytics should never break the app
    return new Response(null, { status: 204 })
  }
}
