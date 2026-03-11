'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

const EXCLUDED_PREFIXES = ['/admin', '/api']

export default function Analytics() {
  const pathname = usePathname()
  const lastTracked = useRef(null)

  useEffect(() => {
    if (!pathname) return

    // Don't track admin or API paths
    if (EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return

    // Debounce: skip if we already tracked this path
    if (lastTracked.current === pathname) return
    lastTracked.current = pathname

    const url = new URL(window.location.href)

    const payload = JSON.stringify({
      path: pathname,
      referrer: document.referrer || null,
      utm_source: url.searchParams.get('utm_source') || null,
      utm_medium: url.searchParams.get('utm_medium') || null,
      utm_campaign: url.searchParams.get('utm_campaign') || null,
      screen_width: window.screen.width,
    })

    // Use sendBeacon for non-blocking fire-and-forget
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' })
      navigator.sendBeacon('/api/analytics/track', blob)
    } else {
      // Fallback for older browsers
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // Silently ignore tracking failures
      })
    }
  }, [pathname])

  return null
}
