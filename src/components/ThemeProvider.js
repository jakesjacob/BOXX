'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

export function useTheme() {
  return useContext(ThemeContext) || { theme: null }
}

/**
 * ThemeProvider — fetches tenant theme and injects CSS variables + Google Fonts.
 * Wrap admin/member layouts with this to apply tenant branding.
 */
export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tenant/theme')
      .then(r => r.json())
      .then(data => {
        if (data.theme) setTheme(data.theme)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Inject CSS variables when theme loads
  useEffect(() => {
    if (!theme) return

    const root = document.documentElement

    // Map theme keys to CSS variable names
    const varMap = {
      background: '--background',
      surface: '--card',
      primary: '--accent',
      foreground: '--foreground',
      muted: '--muted',
      border: '--card-border',
    }

    // Apply each theme color as a CSS variable
    for (const [key, cssVar] of Object.entries(varMap)) {
      if (theme[key]) {
        root.style.setProperty(cssVar, theme[key])
      }
    }

    // Additional derived vars
    if (theme.primaryHover) root.style.setProperty('--accent-dim', theme.primaryHover)
    if (theme.accent) root.style.setProperty('--cta', theme.accent)
    if (theme.borderHover) root.style.setProperty('--cta-hover', theme.borderHover)

    // Apply fonts
    if (theme.bodyFont) {
      root.style.setProperty('--font-tenant-body', `"${theme.bodyFont}", sans-serif`)
    }
    if (theme.titleFont) {
      root.style.setProperty('--font-tenant-title', `"${theme.titleFont}", sans-serif`)
    }

    return () => {
      // Clean up on unmount
      for (const cssVar of Object.values(varMap)) {
        root.style.removeProperty(cssVar)
      }
      root.style.removeProperty('--accent-dim')
      root.style.removeProperty('--cta')
      root.style.removeProperty('--cta-hover')
      root.style.removeProperty('--font-tenant-body')
      root.style.removeProperty('--font-tenant-title')
    }
  }, [theme])

  // Load Google Fonts
  useEffect(() => {
    if (!theme) return
    const fonts = new Set()
    if (theme.titleFont && theme.titleFont !== 'Inter') fonts.add(theme.titleFont)
    if (theme.bodyFont && theme.bodyFont !== 'Inter') fonts.add(theme.bodyFont)
    if (fonts.size === 0) return

    const families = Array.from(fonts).map(f => f.replace(/ /g, '+')).join('&family=')
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${families}:wght@300;400;500;600;700&display=swap`
    document.head.appendChild(link)

    return () => { link.remove() }
  }, [theme?.titleFont, theme?.bodyFont])

  // Render children immediately — don't block on theme fetch.
  // CSS variables apply as soon as theme loads (no layout shift, just color swap).
  return (
    <ThemeContext.Provider value={{ theme, loading }}>
      {theme?.bodyFont && (
        <style>{`
          .tenant-body { font-family: var(--font-tenant-body, inherit); }
          .tenant-title { font-family: var(--font-tenant-title, var(--font-tenant-body, inherit)); }
        `}</style>
      )}
      <div className={theme?.bodyFont ? 'tenant-body' : ''}>
        {children}
      </div>
    </ThemeContext.Provider>
  )
}
