import { NextResponse } from 'next/server'

const MAX_BODY_SIZE = 1024 * 1024 // 1MB
const FETCH_TIMEOUT = 10000 // 10s
const USER_AGENT = 'Zatrovo/1.0'

// Private/reserved IP ranges for SSRF protection
const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
  /^fd/,
  /^localhost$/i,
]

function isPrivateHost(hostname) {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname))
}

function normalizeUrl(url) {
  let normalized = url.trim()
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = 'https://' + normalized
  }
  return normalized
}

function extractBusinessName(html) {
  // Try og:site_name first
  const ogSiteName = html.match(
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i
  )
  if (ogSiteName) return ogSiteName[1].trim()

  // Try og:title
  const ogTitle = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
  )
  if (ogTitle) return ogTitle[1].trim()

  // Also match reverse attribute order (content before property)
  const ogSiteNameRev = html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i
  )
  if (ogSiteNameRev) return ogSiteNameRev[1].trim()

  const ogTitleRev = html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i
  )
  if (ogTitleRev) return ogTitleRev[1].trim()

  // Fall back to <title>
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (title) {
    // Clean up title - remove common suffixes like " | Home", " - Welcome"
    return title[1]
      .replace(/\s*[|–—-]\s*(home|welcome|official).*$/i, '')
      .trim()
  }

  return null
}

function extractLogo(html, baseUrl) {
  const candidates = []

  // apple-touch-icon
  const appleIcon = html.match(
    /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i
  )
  if (appleIcon) candidates.push(appleIcon[1])

  // Also match reverse attribute order
  const appleIconRev = html.match(
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i
  )
  if (appleIconRev) candidates.push(appleIconRev[1])

  // og:image
  const ogImage = html.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
  )
  if (ogImage) candidates.push(ogImage[1])

  const ogImageRev = html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
  )
  if (ogImageRev) candidates.push(ogImageRev[1])

  // favicon
  const favicon = html.match(
    /<link[^>]+rel=["']icon["'][^>]+href=["']([^"']+)["']/i
  )
  if (favicon) candidates.push(favicon[1])

  const faviconRev = html.match(
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']icon["']/i
  )
  if (faviconRev) candidates.push(faviconRev[1])

  // img tags with "logo" in class, id, or alt
  const logoImgs = html.matchAll(
    /<img[^>]+(?:class|id|alt)=["'][^"']*logo[^"']*["'][^>]*src=["']([^"']+)["']/gi
  )
  for (const match of logoImgs) {
    candidates.push(match[1])
  }

  // Also match src before class/id/alt
  const logoImgsRev = html.matchAll(
    /<img[^>]+src=["']([^"']+)["'][^>]*(?:class|id|alt)=["'][^"']*logo[^"']*["']/gi
  )
  for (const match of logoImgsRev) {
    candidates.push(match[1])
  }

  // Resolve relative URLs and return the first valid one
  for (const candidate of candidates) {
    try {
      const resolved = new URL(candidate, baseUrl).href
      return resolved
    } catch {
      continue
    }
  }

  return null
}

function extractColors(html) {
  const colors = {
    primary: null,
    secondary: null,
    accent: null,
    background: null,
  }

  // Theme color meta tag
  const themeColor = html.match(
    /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i
  )
  const themeColorRev = html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/i
  )
  const themeColorValue = themeColor?.[1] || themeColorRev?.[1]
  if (themeColorValue) {
    colors.primary = themeColorValue.trim()
  }

  // CSS custom properties with brand-related names
  const brandVarPatterns = [
    /--(?:primary|brand|main)[-_]?(?:color)?:\s*(#[0-9a-fA-F]{3,8})/g,
    /--(?:secondary)[-_]?(?:color)?:\s*(#[0-9a-fA-F]{3,8})/g,
    /--(?:accent|highlight)[-_]?(?:color)?:\s*(#[0-9a-fA-F]{3,8})/g,
    /--(?:background|bg)[-_]?(?:color)?:\s*(#[0-9a-fA-F]{3,8})/g,
  ]

  const varKeys = ['primary', 'secondary', 'accent', 'background']
  brandVarPatterns.forEach((pattern, index) => {
    const match = pattern.exec(html)
    if (match && !colors[varKeys[index]]) {
      colors[varKeys[index]] = match[1]
    }
  })

  // Common grays/blacks/whites to exclude from frequency analysis
  const commonNeutrals = new Set([
    '#000', '#000000', '#fff', '#ffffff', '#fafafa', '#f5f5f5',
    '#f0f0f0', '#e0e0e0', '#d0d0d0', '#c0c0c0', '#ccc', '#cccccc',
    '#999', '#999999', '#888', '#888888', '#777', '#777777',
    '#666', '#666666', '#555', '#555555', '#444', '#444444',
    '#333', '#333333', '#222', '#222222', '#111', '#111111',
    '#eee', '#eeeeee', '#ddd', '#dddddd', '#bbb', '#bbbbbb',
    '#aaa', '#aaaaaa', '#fff0', '#0000', '#00000000', '#ffffff00',
  ])

  // Find most frequent hex colors in page
  const hexMatches = html.matchAll(/#([0-9a-fA-F]{3,8})\b/g)
  const colorFrequency = {}
  for (const match of hexMatches) {
    const hex = '#' + match[1].toLowerCase()
    // Only consider 3-char or 6-char hex (not 4 or 8 with alpha, unless common)
    if (hex.length !== 4 && hex.length !== 7) continue
    if (commonNeutrals.has(hex)) continue
    colorFrequency[hex] = (colorFrequency[hex] || 0) + 1
  }

  const sortedColors = Object.entries(colorFrequency)
    .sort((a, b) => b[1] - a[1])
    .map(([color]) => color)

  // Fill in missing colors from frequency analysis
  let colorIndex = 0
  for (const key of varKeys) {
    if (!colors[key] && sortedColors[colorIndex]) {
      colors[key] = sortedColors[colorIndex]
      colorIndex++
    }
  }

  return colors
}

function extractFont(html) {
  // Google Fonts link
  const googleFonts = html.match(
    /fonts\.googleapis\.com\/css2?\?family=([^&"']+)/i
  )
  if (googleFonts) {
    // Decode family name: "Roboto+Slab:wght@..." -> "Roboto Slab"
    const family = decodeURIComponent(googleFonts[1].split(':')[0])
      .replace(/\+/g, ' ')
    return family
  }

  // CSS font-family declarations (pick the first non-generic one)
  const fontFamilyMatch = html.match(
    /font-family:\s*["']?([^"';,}]+)/i
  )
  if (fontFamilyMatch) {
    const font = fontFamilyMatch[1].trim()
    const genericFonts = [
      'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
      'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace',
      'inherit', 'initial', 'unset',
    ]
    if (!genericFonts.includes(font.toLowerCase())) {
      return font
    }
  }

  return null
}

function extractDescription(html) {
  const desc = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
  )
  if (desc) return desc[1].trim()

  const descRev = html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i
  )
  if (descRev) return descRev[1].trim()

  return null
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      )
    }

    const normalizedUrl = normalizeUrl(url)

    // Validate URL
    let parsedUrl
    try {
      parsedUrl = new URL(normalizedUrl)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL' },
        { status: 400 }
      )
    }

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { success: false, error: 'Only HTTP and HTTPS URLs are allowed' },
        { status: 400 }
      )
    }

    // SSRF protection - block private/local IPs
    if (isPrivateHost(parsedUrl.hostname)) {
      return NextResponse.json(
        { success: false, error: 'Local/private URLs are not allowed' },
        { status: 400 }
      )
    }

    // Fetch the page
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

    let response
    try {
      response = await fetch(normalizedUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      })
    } catch (err) {
      clearTimeout(timeout)
      if (err.name === 'AbortError') {
        return NextResponse.json(
          { success: false, error: 'Request timed out' },
          { status: 504 }
        )
      }
      return NextResponse.json(
        { success: false, error: 'Failed to fetch website' },
        { status: 502 }
      )
    }
    clearTimeout(timeout)

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Website returned ${response.status}` },
        { status: 502 }
      )
    }

    // Limit response body size
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Website response too large' },
        { status: 502 }
      )
    }

    // Read body with size limit
    const reader = response.body.getReader()
    const chunks = []
    let totalSize = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalSize += value.length
      if (totalSize > MAX_BODY_SIZE) {
        reader.cancel()
        break
      }
      chunks.push(value)
    }

    const decoder = new TextDecoder()
    const html = chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('')
      + decoder.decode()

    const baseUrl = parsedUrl.origin

    // Extract brand elements
    const brand = {
      name: extractBusinessName(html),
      logo: extractLogo(html, baseUrl),
      description: extractDescription(html),
      colors: extractColors(html),
      font: extractFont(html),
    }

    return NextResponse.json({ success: true, brand })
  } catch (err) {
    console.error('Brand extraction error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to extract brand information' },
      { status: 500 }
    )
  }
}
