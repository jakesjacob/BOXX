import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const MAX_BODY_SIZE = 2 * 1024 * 1024 // 2MB
const CSS_MAX_SIZE = 512 * 1024 // 512KB per CSS file
const FETCH_TIMEOUT = 15000 // 15s
const CSS_FETCH_TIMEOUT = 5000 // 5s per CSS file
const MAX_CSS_FILES = 5

// Realistic browser UA — many sites block bots
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// SSRF protection
const PRIVATE_IP_PATTERNS = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^0\./, /^169\.254\./, /^::1$/, /^fc00:/, /^fe80:/, /^fd/, /^localhost$/i,
]

function isPrivateHost(hostname) {
  return PRIVATE_IP_PATTERNS.some(p => p.test(hostname))
}

function normalizeUrl(url) {
  let normalized = url.trim()
  if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized
  return normalized
}

// ─── Fetch helper with size limit ─────────────────────────
async function safeFetch(url, { timeout = FETCH_TIMEOUT, maxSize = MAX_BODY_SIZE } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,text/css,application/xhtml+xml,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    })
    clearTimeout(timer)

    if (!res.ok) return null

    const contentLength = res.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > maxSize) return null

    // Stream with size cap
    const reader = res.body.getReader()
    const chunks = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      if (total > maxSize) { reader.cancel(); break }
      chunks.push(value)
    }
    return new TextDecoder().decode(Buffer.concat(chunks.map(c => Buffer.from(c))))
  } catch {
    clearTimeout(timer)
    return null
  }
}

// ─── Extract external CSS content ─────────────────────────
async function fetchExternalCSS(html, baseUrl) {
  const cssLinks = []
  const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi
  const linkRegexRev = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["']/gi

  for (const regex of [linkRegex, linkRegexRev]) {
    let match
    while ((match = regex.exec(html)) !== null) {
      try {
        const resolved = new URL(match[1], baseUrl).href
        if (!cssLinks.includes(resolved)) cssLinks.push(resolved)
      } catch { /* skip invalid URLs */ }
    }
  }

  // Also look for @import in inline styles
  const importRegex = /@import\s+(?:url\()?["']([^"']+)["']\)?/g
  let match
  while ((match = importRegex.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1], baseUrl).href
      if (!cssLinks.includes(resolved)) cssLinks.push(resolved)
    } catch { /* skip */ }
  }

  // Fetch CSS files in parallel (limit to MAX_CSS_FILES)
  const fetches = cssLinks.slice(0, MAX_CSS_FILES).map(url =>
    safeFetch(url, { timeout: CSS_FETCH_TIMEOUT, maxSize: CSS_MAX_SIZE })
  )
  const results = await Promise.allSettled(fetches)
  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value)
    .join('\n')
}

// ─── Extractors ───────────────────────────────────────────

function extractBusinessName(html) {
  // og:site_name (both attribute orders)
  const ogSite = html.match(/<meta[^>]+(?:property=["']og:site_name["'][^>]+content=["']([^"']+)["']|content=["']([^"']+)["'][^>]+property=["']og:site_name["'])/i)
  if (ogSite) return (ogSite[1] || ogSite[2]).trim()

  // og:title
  const ogTitle = html.match(/<meta[^>]+(?:property=["']og:title["'][^>]+content=["']([^"']+)["']|content=["']([^"']+)["'][^>]+property=["']og:title["'])/i)
  if (ogTitle) return (ogTitle[1] || ogTitle[2]).trim()

  // <title>
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (title) {
    return title[1].replace(/\s*[|–—\-]\s*(home|welcome|official|website).*$/i, '').trim()
  }
  return null
}

function extractLogo(html, baseUrl) {
  const candidates = []
  const resolve = href => { try { return new URL(href, baseUrl).href } catch { return null } }

  // Ordered by quality/likelihood of being the actual logo

  // 1. apple-touch-icon (usually high-res PNG)
  const appleIcons = html.matchAll(/<link[^>]+(?:rel=["']apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']|href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon[^"']*["'])/gi)
  for (const m of appleIcons) candidates.push(resolve(m[1] || m[2]))

  // 2. <img> with "logo" in src path, class, id, or alt
  const logoImgs = html.matchAll(/<img[^>]+src=["']([^"']*logo[^"']*?)["']/gi)
  for (const m of logoImgs) candidates.push(resolve(m[1]))

  const logoImgs2 = html.matchAll(/<img[^>]+(?:class|id|alt)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/gi)
  for (const m of logoImgs2) candidates.push(resolve(m[1]))

  const logoImgs3 = html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]+(?:class|id|alt)=["'][^"']*logo[^"']*["']/gi)
  for (const m of logoImgs3) candidates.push(resolve(m[1]))

  // 3. SVG with "logo" in parent container
  // Check for <a> or <div> with logo class containing an <img>
  const logoContainers = html.matchAll(/<(?:a|div|span|header)[^>]+(?:class|id)=["'][^"']*logo[^"']*["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/gi)
  for (const m of logoContainers) candidates.push(resolve(m[1]))

  // 4. og:image (often a social preview, not always logo but better than nothing)
  const ogImage = html.match(/<meta[^>]+(?:property=["']og:image["'][^>]+content=["']([^"']+)["']|content=["']([^"']+)["'][^>]+property=["']og:image["'])/i)
  if (ogImage) candidates.push(resolve(ogImage[1] || ogImage[2]))

  // 5. Favicon (last resort)
  const favicons = html.matchAll(/<link[^>]+(?:rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']|href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["'])/gi)
  for (const m of favicons) candidates.push(resolve(m[1] || m[2]))

  // Return first valid candidate
  return candidates.find(c => c) || null
}

function extractColors(html, cssContent) {
  const allContent = html + '\n' + cssContent
  const colors = { primary: null, secondary: null, accent: null, background: null }

  // 1. Theme color meta tag
  const themeColor = html.match(/<meta[^>]+(?:name=["']theme-color["'][^>]+content=["']([^"']+)["']|content=["']([^"']+)["'][^>]+name=["']theme-color["'])/i)
  if (themeColor) colors.primary = (themeColor[1] || themeColor[2]).trim()

  // 2. CSS custom properties (search both HTML and external CSS)
  const varPatterns = [
    { key: 'primary', regex: /--(?:color-)?(?:primary|brand|main)(?:[-_]color)?:\s*(#[0-9a-fA-F]{3,8})/gi },
    { key: 'secondary', regex: /--(?:color-)?(?:secondary)(?:[-_]color)?:\s*(#[0-9a-fA-F]{3,8})/gi },
    { key: 'accent', regex: /--(?:color-)?(?:accent|highlight|cta)(?:[-_]color)?:\s*(#[0-9a-fA-F]{3,8})/gi },
    { key: 'background', regex: /--(?:color-)?(?:background|bg|surface)(?:[-_]color)?:\s*(#[0-9a-fA-F]{3,8})/gi },
  ]

  for (const { key, regex } of varPatterns) {
    if (colors[key]) continue
    const match = regex.exec(allContent)
    if (match) colors[key] = match[1]
  }

  // 3. Look for Tailwind-style config colors (common in modern sites)
  const twColors = allContent.matchAll(/["'](?:primary|brand|accent)["']\s*:\s*["'](#[0-9a-fA-F]{3,8})["']/g)
  for (const m of twColors) {
    if (!colors.primary) { colors.primary = m[1]; break }
  }

  // 4. Frequency analysis of non-neutral hex colors
  const neutrals = new Set([
    '#000', '#000000', '#fff', '#ffffff', '#fafafa', '#f5f5f5', '#f0f0f0',
    '#e5e5e5', '#e0e0e0', '#d4d4d4', '#d0d0d0', '#c0c0c0', '#ccc', '#cccccc',
    '#bbb', '#bbbbbb', '#aaa', '#aaaaaa', '#999', '#999999', '#888', '#888888',
    '#777', '#777777', '#666', '#666666', '#555', '#555555', '#444', '#444444',
    '#333', '#333333', '#222', '#222222', '#111', '#111111',
    '#eee', '#eeeeee', '#ddd', '#dddddd', '#f8f8f8', '#f9f9f9', '#fefefe',
    '#e8e8e8', '#d8d8d8', '#c8c8c8', '#b8b8b8', '#a8a8a8', '#989898',
    '#f7f7f7', '#f4f4f4', '#f3f3f3', '#f2f2f2', '#f1f1f1',
    '#e6e6e6', '#e4e4e7', '#d1d5db', '#9ca3af', '#6b7280', '#4b5563',
    '#374151', '#1f2937', '#111827', '#030712',
  ])

  const freq = {}
  const hexMatches = allContent.matchAll(/#([0-9a-fA-F]{6})\b/g)
  for (const m of hexMatches) {
    const hex = '#' + m[1].toLowerCase()
    if (neutrals.has(hex)) continue
    freq[hex] = (freq[hex] || 0) + 1
  }

  const ranked = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([c]) => c)
  const keys = ['primary', 'secondary', 'accent', 'background']
  let ri = 0
  for (const key of keys) {
    if (!colors[key] && ranked[ri]) { colors[key] = ranked[ri]; ri++ }
  }

  return colors
}

function extractFont(html, cssContent) {
  const allContent = html + '\n' + cssContent

  // 1. Google Fonts <link> (most reliable)
  const googleFonts = html.match(/fonts\.googleapis\.com\/css2?\?[^"']*family=([^&"']+)/i)
  if (googleFonts) {
    const family = decodeURIComponent(googleFonts[1].split(':')[0]).replace(/\+/g, ' ')
    return family
  }

  // 2. Google Fonts @import in CSS
  const googleImport = allContent.match(/fonts\.googleapis\.com\/css2?\?[^)]*family=([^&)"']+)/i)
  if (googleImport) {
    const family = decodeURIComponent(googleImport[1].split(':')[0]).replace(/\+/g, ' ')
    return family
  }

  // 3. @font-face declarations
  const fontFace = allContent.match(/@font-face\s*\{[^}]*font-family:\s*["']?([^"';},]+)/i)
  if (fontFace) {
    const font = fontFace[1].trim()
    const generic = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'inherit']
    if (!generic.includes(font.toLowerCase())) return font
  }

  // 4. body/html font-family
  const bodyFont = allContent.match(/(?:body|html)\s*\{[^}]*font-family:\s*["']?([^"';,}]+)/i)
  if (bodyFont) {
    const font = bodyFont[1].trim()
    const generic = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'inherit', 'initial']
    if (!generic.includes(font.toLowerCase())) return font
  }

  // 5. Most common font-family value
  const fontFamilies = allContent.matchAll(/font-family:\s*["']?([^"';,}]+)/gi)
  const fontFreq = {}
  const genericFonts = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'inherit', 'initial', 'unset', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue', 'Arial', 'Helvetica'])
  for (const m of fontFamilies) {
    const font = m[1].trim().replace(/^["']|["']$/g, '')
    if (!genericFonts.has(font) && font.length > 1) {
      fontFreq[font] = (fontFreq[font] || 0) + 1
    }
  }
  const topFont = Object.entries(fontFreq).sort((a, b) => b[1] - a[1])[0]
  if (topFont) return topFont[0]

  return null
}

function extractDescription(html) {
  const desc = html.match(/<meta[^>]+(?:name=["']description["'][^>]+content=["']([^"']+)["']|content=["']([^"']+)["'][^>]+name=["']description["'])/i)
  if (desc) return (desc[1] || desc[2]).trim()
  return null
}

// ─── AI Brand Analysis (Claude) ───────────────────────────

async function aiAnalyzeBrand(html, cssContent, regexBrand) {
  if (!process.env.ANTHROPIC_API_KEY) return null

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Extract a concise version of the page for Claude to analyze
    // Strip scripts/styles/noscript, keep structure
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s{2,}/g, ' ')
      .slice(0, 15000) // Keep it concise for the prompt

    // Extract just CSS variable declarations and key rules
    const cssSnippet = cssContent
      .replace(/\/\*[\s\S]*?\*\//g, '') // strip comments
      .match(/(?::root|body|html|\*)\s*\{[^}]+\}/gi)
      ?.join('\n')
      ?.slice(0, 5000) || ''

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are a UI/UX design expert. Analyze this website's HTML and CSS to extract its brand identity. Be precise with hex color values.

Here's what regex extraction found (may be incomplete or wrong):
- Name: ${regexBrand.name || 'not found'}
- Primary color: ${regexBrand.colors?.primary || 'not found'}
- Secondary color: ${regexBrand.colors?.secondary || 'not found'}
- Font: ${regexBrand.font || 'not found'}
- Description: ${regexBrand.description || 'not found'}

HTML (truncated):
${cleaned}

CSS variables & key rules:
${cssSnippet}

Return a JSON object with your best assessment. Fix any incorrect regex results. Fill in missing values by analyzing the actual HTML structure and CSS. For colors, look at buttons, headers, links, nav backgrounds. For the font, look at font-family declarations on body/html/main content.

Return ONLY valid JSON, no markdown:
{
  "name": "Business Name",
  "primary": "#hex",
  "secondary": "#hex",
  "accent": "#hex",
  "background": "#hex",
  "font": "Font Family Name",
  "fontType": "sans-serif|serif|monospace",
  "mood": "dark|light|warm|cool|luxury|minimal|bold|playful"
}`
      }],
    })

    const text = message.content[0]?.text?.trim()
    if (!text) return null

    // Parse JSON (handle potential markdown wrapping)
    const jsonStr = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    return JSON.parse(jsonStr)
  } catch (err) {
    console.error('[extract-brand] AI analysis failed:', err.message)
    return null
  }
}

// ─── Route handler ────────────────────────────────────────

export async function POST(request) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 })
    }

    const normalizedUrl = normalizeUrl(url)

    let parsedUrl
    try { parsedUrl = new URL(normalizedUrl) }
    catch { return NextResponse.json({ success: false, error: 'Invalid URL' }, { status: 400 }) }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ success: false, error: 'Only HTTP and HTTPS URLs are allowed' }, { status: 400 })
    }

    if (isPrivateHost(parsedUrl.hostname)) {
      return NextResponse.json({ success: false, error: 'Local/private URLs are not allowed' }, { status: 400 })
    }

    // Fetch the page
    const html = await safeFetch(normalizedUrl)
    if (!html) {
      return NextResponse.json({ success: false, error: 'Could not fetch website. Check the URL and try again.' }, { status: 502 })
    }

    // Fetch external CSS files for better color/font extraction
    const cssContent = await fetchExternalCSS(html, parsedUrl.origin)

    const baseUrl = parsedUrl.origin

    // Step 1: Regex extraction (fast, always runs)
    const regexBrand = {
      name: extractBusinessName(html),
      logo: extractLogo(html, baseUrl),
      description: extractDescription(html),
      colors: extractColors(html, cssContent),
      font: extractFont(html, cssContent),
    }

    // Step 2: AI analysis (enhances/corrects regex results)
    const aiResult = await aiAnalyzeBrand(html, cssContent, regexBrand)

    // Merge: AI results take priority where they exist, regex fills gaps
    const brand = {
      name: aiResult?.name || regexBrand.name,
      logo: regexBrand.logo, // AI can't extract logo URLs reliably
      description: regexBrand.description,
      colors: {
        primary: aiResult?.primary || regexBrand.colors?.primary,
        secondary: aiResult?.secondary || regexBrand.colors?.secondary,
        accent: aiResult?.accent || regexBrand.colors?.accent,
        background: aiResult?.background || regexBrand.colors?.background,
      },
      font: aiResult?.font || regexBrand.font,
      fontType: aiResult?.fontType || null,
      mood: aiResult?.mood || null,
    }

    return NextResponse.json({ success: true, brand })
  } catch (err) {
    console.error('[extract-brand] Error:', err)
    return NextResponse.json({ success: false, error: 'Failed to extract brand information' }, { status: 500 })
  }
}
