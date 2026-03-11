'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { signIn, useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Check, ChevronRight, ChevronLeft, Loader2, Eye, EyeOff,
  Upload, X, Globe, Zap, Leaf, Dumbbell, Music, Target,
  Sparkles, MapPin, SkipForward, Palette, Monitor, Sun, Moon,
  Crown, Trees, Waves, Flame, Wand2, ExternalLink, Building2,
} from 'lucide-react'

// ─── Themes ────────────────────────────────────────────────
const THEMES = [
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Dark & modern',
    icon: Moon,
    // Backgrounds
    background: '#0a0a0b',
    surface: '#141416',
    surfaceHover: '#1c1c1f',
    // Brand
    primary: '#6366f1',
    primaryHover: '#5558e8',
    secondary: '#818cf8',
    accent: '#a78bfa',
    // Text
    foreground: '#f0f0f5',
    muted: '#71717a',
    // Borders
    border: '#27272a',
    borderHover: '#3f3f46',
    // Fonts
    titleFont: 'Inter',
    titleFontType: 'sans-serif',
    bodyFont: 'Inter',
    bodyFontType: 'sans-serif',
  },
  {
    id: 'ember',
    name: 'Ember',
    description: 'Warm & energetic',
    icon: Flame,
    background: '#0c0a09',
    surface: '#1c1917',
    surfaceHover: '#262220',
    primary: '#f97316',
    primaryHover: '#ea6c0e',
    secondary: '#fb923c',
    accent: '#fbbf24',
    foreground: '#fafaf9',
    muted: '#a8a29e',
    border: '#292524',
    borderHover: '#3d3835',
    titleFont: 'DM Sans',
    titleFontType: 'sans-serif',
    bodyFont: 'DM Sans',
    bodyFontType: 'sans-serif',
  },
  {
    id: 'ivory',
    name: 'Ivory',
    description: 'Light & clean',
    icon: Sun,
    background: '#fafafa',
    surface: '#ffffff',
    surfaceHover: '#f4f4f5',
    primary: '#0d9488',
    primaryHover: '#0b7f74',
    secondary: '#2dd4bf',
    accent: '#5eead4',
    foreground: '#18181b',
    muted: '#71717a',
    border: '#e4e4e7',
    borderHover: '#d4d4d8',
    titleFont: 'Plus Jakarta Sans',
    titleFontType: 'sans-serif',
    bodyFont: 'Plus Jakarta Sans',
    bodyFontType: 'sans-serif',
  },
  {
    id: 'royal',
    name: 'Royal',
    description: 'Bold & luxurious',
    icon: Crown,
    background: '#09090b',
    surface: '#141417',
    surfaceHover: '#1c1c20',
    primary: '#c8a750',
    primaryHover: '#b89640',
    secondary: '#d4af37',
    accent: '#e8c547',
    foreground: '#fafaf5',
    muted: '#a1a1aa',
    border: '#27272a',
    borderHover: '#3a3a3f',
    titleFont: 'Playfair Display',
    titleFontType: 'serif',
    bodyFont: 'Inter',
    bodyFontType: 'sans-serif',
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Natural & calm',
    icon: Trees,
    background: '#f8faf5',
    surface: '#f0f7ec',
    surfaceHover: '#e5f0df',
    primary: '#16a34a',
    primaryHover: '#138a3e',
    secondary: '#4ade80',
    accent: '#86efac',
    foreground: '#1a2e1a',
    muted: '#6b8f6b',
    border: '#d1e7d1',
    borderHover: '#b8d9b8',
    titleFont: 'Nunito',
    titleFontType: 'sans-serif',
    bodyFont: 'Nunito',
    bodyFontType: 'sans-serif',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Fresh & professional',
    icon: Waves,
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceHover: '#f1f5f9',
    primary: '#0ea5e9',
    primaryHover: '#0c93cf',
    secondary: '#38bdf8',
    accent: '#7dd3fc',
    foreground: '#0f172a',
    muted: '#64748b',
    border: '#e2e8f0',
    borderHover: '#cbd5e1',
    titleFont: 'Poppins',
    titleFontType: 'sans-serif',
    bodyFont: 'Inter',
    bodyFontType: 'sans-serif',
  },
]

// ─── Font options for manual selection ─────────────────────
const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter', type: 'Sans-serif' },
  { value: 'DM Sans', label: 'DM Sans', type: 'Sans-serif' },
  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans', type: 'Sans-serif' },
  { value: 'Poppins', label: 'Poppins', type: 'Sans-serif' },
  { value: 'Nunito', label: 'Nunito', type: 'Rounded' },
  { value: 'Playfair Display', label: 'Playfair Display', type: 'Serif' },
]

// ─── Verticals (with icons) ───────────────────────────────
const VERTICALS = [
  { value: 'boxing', label: 'Boxing / MMA', Icon: Zap },
  { value: 'yoga', label: 'Yoga / Pilates', Icon: Leaf },
  { value: 'fitness', label: 'Gym / Fitness', Icon: Dumbbell },
  { value: 'dance', label: 'Dance Studio', Icon: Music },
  { value: 'pt', label: 'Personal Training', Icon: Target },
  { value: 'other', label: 'Other', Icon: Sparkles },
]

// ─── Rotating taglines ────────────────────────────────────
const TAGLINES = [
  'Get more bookings',
  'Streamline your admin',
  'Manage your schedule',
  'Grow your business',
  'Delight your clients',
]

const TIMEZONES = [
  { value: 'Pacific/Honolulu', label: 'Hawaii (HST)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PST/PDT)' },
  { value: 'America/Denver', label: 'Mountain (MST/MDT)' },
  { value: 'America/Chicago', label: 'Central (CST/CDT)' },
  { value: 'America/New_York', label: 'Eastern (EST/EDT)' },
  { value: 'America/Sao_Paulo', label: 'Brazil (BRT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central Europe (CET/CEST)' },
  { value: 'Europe/Helsinki', label: 'Eastern Europe (EET/EEST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (ICT)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'New Zealand (NZST/NZDT)' },
]

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (\u20AC)' },
  { value: 'GBP', label: 'GBP (\u00A3)' },
  { value: 'THB', label: 'THB (\u0E3F)' },
  { value: 'AUD', label: 'AUD ($)' },
  { value: 'CAD', label: 'CAD ($)' },
  { value: 'SGD', label: 'SGD ($)' },
  { value: 'JPY', label: 'JPY (\u00A5)' },
  { value: 'INR', label: 'INR (\u20B9)' },
  { value: 'BRL', label: 'BRL (R$)' },
]

const STEPS = ['Account', 'Business', 'Location', 'Brand', 'Launch']

// ─── Sub-components ───────────────────────────────────────

function StepIndicator({ current, steps }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all
            ${i < current ? 'bg-accent text-background' : i === current ? 'bg-accent/20 text-accent border border-accent' : 'bg-card border border-card-border text-muted'}
          `}>
            {i < current ? <Check className="w-4 h-4" /> : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-px transition-colors ${i < current ? 'bg-accent' : 'bg-card-border'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function InputField({ label, id, error, ...props }) {
  return (
    <div>
      {label && <label htmlFor={id} className="block text-sm text-muted mb-1.5">{label}</label>}
      <input
        id={id}
        className={`w-full px-4 py-3 rounded-lg bg-background border ${error ? 'border-red-500/50' : 'border-card-border'} text-foreground placeholder-muted/50 focus:outline-none focus:border-accent transition-colors`}
        {...props}
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
}

function SelectField({ label, id, options, error, ...props }) {
  return (
    <div>
      {label && <label htmlFor={id} className="block text-sm text-muted mb-1.5">{label}</label>}
      <select
        id={id}
        className={`w-full px-4 py-3 rounded-lg bg-background border ${error ? 'border-red-500/50' : 'border-card-border'} text-foreground focus:outline-none focus:border-accent transition-colors`}
        {...props}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function ThemePreview({ theme, businessName, logoUrl }) {
  const isDark = theme.background.replace('#', '').split('').reduce((sum, c) => sum + parseInt(c, 16), 0) < 24
  const titleFontCSS = `"${theme.titleFont}", ${theme.titleFontType}`
  const bodyFontCSS = `"${theme.bodyFont}", ${theme.bodyFontType}`

  return (
    <div
      className="rounded-xl overflow-hidden border shadow-lg"
      style={{ borderColor: theme.border, backgroundColor: theme.background, fontFamily: bodyFontCSS }}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-3 py-2" style={{ backgroundColor: theme.surface, borderBottom: `1px solid ${theme.border}` }}>
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#ef4444' }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#22c55e' }} />
        <div className="flex-1 mx-4 h-5 rounded-md text-center text-[10px] leading-5 truncate" style={{ backgroundColor: theme.background, color: theme.muted }}>
          {businessName ? `${businessName.toLowerCase().replace(/\s/g, '')}.zatrovo.com` : 'yourbusiness.zatrovo.com'}
        </div>
      </div>

      {/* Navbar */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: theme.surface, borderBottom: `1px solid ${theme.border}` }}>
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="w-5 h-5 rounded object-contain" />
          ) : (
            <div className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold" style={{ backgroundColor: theme.primary, color: isDark ? '#ffffff' : theme.background }}>
              {(businessName || 'Z')[0].toUpperCase()}
            </div>
          )}
          <span className="text-xs font-semibold truncate max-w-[100px]" style={{ color: theme.foreground, fontFamily: titleFontCSS }}>
            {businessName || 'Your Business'}
          </span>
        </div>
        <div className="flex gap-2">
          <div className="px-2 py-0.5 rounded text-[8px]" style={{ color: theme.muted }}>Classes</div>
          <div className="px-2 py-0.5 rounded text-[8px]" style={{ color: theme.muted }}>Pricing</div>
          <div className="px-2 py-0.5 rounded text-[8px]" style={{ color: theme.secondary }}>Login</div>
        </div>
      </div>

      {/* Hero */}
      <div className="px-5 py-6 text-center">
        <div className="text-base font-bold mb-1" style={{ color: theme.foreground, fontFamily: titleFontCSS }}>
          Welcome
        </div>
        <div className="text-[10px] mb-4" style={{ color: theme.muted, fontFamily: bodyFontCSS }}>
          Book your next session today
        </div>
        <div className="flex items-center justify-center gap-2">
          <div
            className="px-5 py-1.5 rounded-lg text-[10px] font-semibold"
            style={{ backgroundColor: theme.primary, color: isDark ? '#ffffff' : theme.background }}
          >
            Book Now
          </div>
          <div
            className="px-5 py-1.5 rounded-lg text-[10px] font-semibold"
            style={{ border: `1px solid ${theme.secondary}`, color: theme.secondary }}
          >
            View Schedule
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="px-4 pb-3 grid grid-cols-2 gap-2">
        {[
          { label: 'Morning Flow', badge: 'Popular' },
          { label: 'HIIT Session', badge: '3 spots' },
        ].map((item, i) => (
          <div key={i} className="rounded-lg p-2.5" style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
            <div className="w-full h-6 rounded mb-2" style={{ backgroundColor: theme.accent, opacity: 0.12 }} />
            <div className="text-[9px] font-semibold mb-0.5" style={{ color: theme.foreground, fontFamily: titleFontCSS }}>{item.label}</div>
            <div className="text-[8px] mb-1.5" style={{ color: theme.muted }}>9:00 AM — 60 min</div>
            <div className="flex items-center justify-between">
              <span className="text-[7px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: theme.accent, opacity: 0.15, color: theme.accent === theme.primary ? theme.foreground : theme.accent }}>{item.badge}</span>
              <span className="text-[8px] font-semibold" style={{ color: theme.primary }}>Book</span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer accent bar */}
      <div className="h-1" style={{ background: `linear-gradient(to right, ${theme.primary}, ${theme.secondary}, ${theme.accent})` }} />
    </div>
  )
}

// ─── Color utility functions ──────────────────────────────

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return [h * 360, s * 100, l * 100]
}

function hslToHex(h, s, l) {
  h /= 360; s /= 100; l /= 100
  const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q - p) * 6 * t; if (t < 1/2) return q; if (t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p }
  let r, g, b
  if (s === 0) { r = g = b = l } else { const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q; r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3) }
  return '#' + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
}

function lightenColor(hex, amount) {
  try { const [h, s, l] = hexToHsl(hex); return hslToHex(h, s, Math.min(100, l + amount)) } catch { return hex }
}

function darkenColor(hex, amount) {
  try { const [h, s, l] = hexToHsl(hex); return hslToHex(h, s, Math.max(0, l - amount)) } catch { return hex }
}

function shiftColor(hex, hueShift) {
  try { const [h, s, l] = hexToHsl(hex); return hslToHex((h + hueShift) % 360, s, l) } catch { return hex }
}

function isColorDark(hex) {
  try { const [,, l] = hexToHsl(hex); return l < 50 } catch { return true }
}

// ─── Analyzing steps animation ────────────────────────────
const ANALYZE_STEPS = [
  'Fetching website...',
  'Analyzing colors...',
  'Extracting logo...',
  'Detecting fonts...',
  'Building your theme...',
]

// ─── Main Component ───────────────────────────────────────

export default function OnboardingPage() {
  const { data: session, update: updateSession } = useSession()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [googleAuth, setGoogleAuth] = useState(false)

  // Form data
  const [form, setForm] = useState({
    ownerName: '',
    ownerEmail: '',
    password: '',
    studioName: '',
    slug: '',
    vertical: 'fitness',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    currency: 'USD',
    locationName: '',
    address: '',
    city: '',
    country: '',
    phone: '',
    primaryColor: '#6366f1',
    logoUrl: null,
  })

  // Brand/theme state
  const [selectedThemeId, setSelectedThemeId] = useState('midnight')
  const [customColors, setCustomColors] = useState(null)
  const [customTitleFont, setCustomTitleFont] = useState(null)
  const [customBodyFont, setCustomBodyFont] = useState(null)
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeStep, setAnalyzeStep] = useState(0)
  const [extractedBrand, setExtractedBrand] = useState(null)
  const [hasLocation, setHasLocation] = useState(true)
  const [logoFile, setLogoFile] = useState(null)
  const [showCustomize, setShowCustomize] = useState(false)
  const [showThemes, setShowThemes] = useState(true)

  // Slug state
  const [slugAvailable, setSlugAvailable] = useState(null)
  const [slugChecking, setSlugChecking] = useState(false)
  const [autoSlug, setAutoSlug] = useState(true)

  // Tagline rotation
  const [taglineIndex, setTaglineIndex] = useState(0)

  // Result
  const [result, setResult] = useState(null)

  // Effective theme (merged from selection + custom overrides)
  const effectiveTheme = useMemo(() => {
    const base = THEMES.find(t => t.id === selectedThemeId) || THEMES[0]
    return {
      ...base,
      ...(customColors ? {
        background: customColors.background || base.background,
        surface: customColors.surface || base.surface,
        surfaceHover: customColors.surfaceHover || base.surfaceHover,
        primary: customColors.primary || base.primary,
        primaryHover: customColors.primaryHover || base.primaryHover,
        secondary: customColors.secondary || base.secondary,
        accent: customColors.accent || base.accent,
        foreground: customColors.foreground || base.foreground,
        muted: customColors.muted || base.muted,
        border: customColors.border || base.border,
        borderHover: customColors.borderHover || base.borderHover,
      } : {}),
      ...(customTitleFont ? { titleFont: customTitleFont } : {}),
      ...(customBodyFont ? { bodyFont: customBodyFont } : {}),
    }
  }, [selectedThemeId, customColors, customTitleFont, customBodyFont])

  // Sync primary color to form
  useEffect(() => {
    setForm(prev => ({ ...prev, primaryColor: effectiveTheme.primary }))
  }, [effectiveTheme.primary])

  // Detect Google OAuth return
  useEffect(() => {
    if (session?.user && step === 0 && !googleAuth) {
      setGoogleAuth(true)
      setForm(prev => ({
        ...prev,
        ownerName: session.user.name || prev.ownerName,
        ownerEmail: session.user.email || prev.ownerEmail,
      }))
      setStep(1)
    }
  }, [session, step, googleAuth])

  // Tagline rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setTaglineIndex(i => (i + 1) % TAGLINES.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setFieldErrors(prev => ({ ...prev, [key]: null }))
  }

  // Auto-generate slug from business name
  useEffect(() => {
    if (autoSlug && form.studioName) {
      const generated = form.studioName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50)
      set('slug', generated)
    }
  }, [form.studioName, autoSlug])

  // Check slug availability (debounced)
  useEffect(() => {
    if (!form.slug || form.slug.length < 3) {
      setSlugAvailable(null)
      return
    }
    setSlugChecking(true)
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch('/api/onboarding/check-slug', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: form.slug }),
        })
        const data = await res.json()
        setSlugAvailable(data.available)
        if (!data.available && data.error) {
          setFieldErrors(prev => ({ ...prev, slug: data.error }))
        }
      } catch {
        setSlugAvailable(null)
      }
      setSlugChecking(false)
    }, 500)
    return () => clearTimeout(timeout)
  }, [form.slug])

  // Analyze steps animation
  useEffect(() => {
    if (!analyzing) { setAnalyzeStep(0); return }
    const interval = setInterval(() => {
      setAnalyzeStep(i => Math.min(i + 1, ANALYZE_STEPS.length - 1))
    }, 800)
    return () => clearInterval(interval)
  }, [analyzing])

  const validateStep = useCallback(() => {
    const errors = {}
    if (step === 0) {
      if (!form.ownerName.trim()) errors.ownerName = 'Name is required'
      if (!form.ownerEmail.trim()) errors.ownerEmail = 'Email is required'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.ownerEmail)) errors.ownerEmail = 'Invalid email'
      if (!googleAuth) {
        if (!form.password) errors.password = 'Password is required'
        else if (form.password.length < 8) errors.password = 'At least 8 characters'
      }
    }
    if (step === 1) {
      if (!form.studioName.trim()) errors.studioName = 'Business name is required'
      if (!form.slug || form.slug.length < 3) errors.slug = 'URL must be at least 3 characters'
      if (slugAvailable === false) errors.slug = 'This URL is taken'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }, [step, form, slugAvailable, googleAuth])

  const next = () => {
    if (validateStep()) {
      setStep(s => Math.min(s + 1, STEPS.length - 1))
      setError('')
    }
  }

  const prev = () => {
    setStep(s => Math.max(s - 1, 0))
    setError('')
  }

  const skip = () => {
    setStep(s => Math.min(s + 1, STEPS.length - 1))
    setError('')
  }

  // ─── Website analysis ───────────────────────────────────
  const handleAnalyzeWebsite = async () => {
    if (!websiteUrl.trim()) return
    setAnalyzing(true)
    setExtractedBrand(null)
    setError('')

    try {
      const res = await fetch('/api/onboarding/extract-brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Could not analyze website')
        setAnalyzing(false)
        return
      }

      setExtractedBrand(data.brand)

      // Apply extracted brand — build full custom color set with derived shades
      const c = data.brand.colors || {}
      if (c.primary || c.background) {
        const primary = c.primary || '#6366f1'
        const secondary = c.secondary || c.accent || shiftColor(primary, 30)
        const accent = c.accent || shiftColor(primary, 60)
        const bg = c.background || '#0f0f0f'
        const isDarkBg = isColorDark(bg)

        setCustomColors({
          background: bg,
          surface: isDarkBg ? lightenColor(bg, 8) : darkenColor(bg, 3),
          surfaceHover: isDarkBg ? lightenColor(bg, 14) : darkenColor(bg, 6),
          primary,
          primaryHover: darkenColor(primary, 10),
          secondary,
          accent,
          foreground: isDarkBg ? '#f0f0f5' : '#18181b',
          muted: isDarkBg ? '#71717a' : '#71717a',
          border: isDarkBg ? lightenColor(bg, 12) : darkenColor(bg, 10),
          borderHover: isDarkBg ? lightenColor(bg, 20) : darkenColor(bg, 16),
        })
        setSelectedThemeId('custom')
      }
      if (data.brand.titleFont || data.brand.font) {
        setCustomTitleFont(data.brand.titleFont || data.brand.font)
      }
      if (data.brand.bodyFont || data.brand.font) {
        setCustomBodyFont(data.brand.bodyFont || data.brand.font)
      }
      if (data.brand.logo) {
        setForm(prev => ({ ...prev, logoUrl: data.brand.logo }))
      }
      if (data.brand.name && !form.studioName) {
        set('studioName', data.brand.name)
      }
      // Collapse theme gallery since we have a custom theme now
      setShowThemes(false)
    } catch {
      setError('Could not analyze website. Please try again.')
    }
    setAnalyzing(false)
  }

  // ─── Logo upload ────────────────────────────────────────
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    setForm(prev => ({ ...prev, logoUrl: preview }))
    setLogoFile(file)
  }

  // ─── Submit ─────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateStep()) return
    setLoading(true)
    setError('')

    try {
      const payload = { ...form }

      // For Google-authed users, pass their existing user ID
      if (googleAuth && session?.user?.id) {
        payload.googleUserId = session.user.id
        delete payload.password
      }

      // If logoUrl is a blob (user upload), clear it — we'll upload after tenant creation
      const isUploadedFile = logoFile && form.logoUrl?.startsWith('blob:')
      if (isUploadedFile) {
        payload.logoUrl = null
      }

      const res = await fetch('/api/onboarding/create-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        if (data.field) {
          setFieldErrors(prev => ({ ...prev, [data.field]: data.error }))
          if (['ownerName', 'ownerEmail', 'password'].includes(data.field)) setStep(0)
          else if (['studioName', 'slug'].includes(data.field)) setStep(1)
        }
        setLoading(false)
        return
      }

      setResult(data)

      // Upload logo file if needed
      if (isUploadedFile && data.tenant?.id) {
        try {
          const formData = new FormData()
          formData.append('file', logoFile)
          formData.append('tenantId', data.tenant.id)
          const uploadRes = await fetch('/api/onboarding/upload-logo', { method: 'POST', body: formData })
          const uploadData = await uploadRes.json()
          if (uploadData.url) {
            setForm(prev => ({ ...prev, logoUrl: uploadData.url }))
          }
        } catch {
          // Non-critical — logo can be uploaded later
        }
      }

      if (googleAuth) {
        await updateSession()
      } else {
        const loginResult = await signIn('credentials', {
          email: form.ownerEmail,
          password: form.password,
          redirect: false,
        })
        if (loginResult?.error) {
          setError('Account created but auto-login failed. Please log in manually.')
        }
      }

      setStep(STEPS.length - 1)
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  // ─── Step rendering ─────────────────────────────────────

  const renderStep = () => {
    switch (step) {

      // ── STEP 0: Account ─────────────────────────────────
      case 0:
        return (
          <div className="space-y-5">
            <div className="text-center mb-2">
              <h2 className="text-xl font-bold text-foreground">Get started for free</h2>
              <p className="text-muted text-sm mt-1">No credit card required.</p>
            </div>

            {/* Google Sign-Up */}
            <button
              type="button"
              onClick={() => signIn('google', { callbackUrl: '/onboarding' })}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-card-border bg-card text-foreground font-medium hover:bg-background transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-card-border" />
              <span className="text-xs text-muted">or sign up with email</span>
              <div className="flex-1 h-px bg-card-border" />
            </div>

            <InputField
              label="Your name" id="ownerName" placeholder="Jane Smith"
              value={form.ownerName} onChange={e => set('ownerName', e.target.value)}
              error={fieldErrors.ownerName}
            />
            <InputField
              label="Email" id="ownerEmail" type="email" placeholder="you@example.com"
              value={form.ownerEmail} onChange={e => set('ownerEmail', e.target.value)}
              error={fieldErrors.ownerEmail}
            />
            <div className="relative">
              <InputField
                label="Password" id="password" type={showPassword ? 'text' : 'password'}
                placeholder="At least 8 characters"
                value={form.password} onChange={e => set('password', e.target.value)}
                error={fieldErrors.password}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-muted hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )

      // ── STEP 1: Business ────────────────────────────────
      case 1:
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-foreground">Tell us about your business</h2>
              <p className="text-muted text-sm mt-1">We&apos;ll set things up based on your type.</p>
            </div>

            <InputField
              label="Business name" id="studioName" placeholder="My Fitness Studio"
              value={form.studioName} onChange={e => set('studioName', e.target.value)}
              error={fieldErrors.studioName}
            />

            <div>
              <label htmlFor="slug" className="block text-sm text-muted mb-1.5">Your URL</label>
              <div className="flex items-center gap-0">
                <span className="px-3 py-3 rounded-l-lg bg-card border border-r-0 border-card-border text-muted text-sm whitespace-nowrap">
                  <Globe className="w-4 h-4 inline -mt-0.5 mr-1" />
                </span>
                <input
                  id="slug"
                  value={form.slug}
                  onChange={e => { setAutoSlug(false); set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')) }}
                  className={`flex-1 px-3 py-3 bg-background border ${fieldErrors.slug ? 'border-red-500/50' : 'border-card-border'} text-foreground placeholder-muted/50 focus:outline-none focus:border-accent transition-colors min-w-0`}
                  placeholder="my-business"
                />
                <span className="px-3 py-3 rounded-r-lg bg-card border border-l-0 border-card-border text-muted text-sm whitespace-nowrap">
                  .zatrovo.com
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 h-5">
                {slugChecking && <Loader2 className="w-3 h-3 animate-spin text-muted" />}
                {!slugChecking && slugAvailable === true && form.slug.length >= 3 && (
                  <span className="text-green-400 text-xs flex items-center gap-1"><Check className="w-3 h-3" /> Available</span>
                )}
                {fieldErrors.slug && <span className="text-red-400 text-xs">{fieldErrors.slug}</span>}
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted mb-2">What type of business?</label>
              <div className="grid grid-cols-2 gap-2">
                {VERTICALS.map(v => {
                  const VIcon = v.Icon
                  return (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => set('vertical', v.value)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left text-sm transition-all ${
                        form.vertical === v.value
                          ? 'border-accent bg-accent/10 text-foreground'
                          : 'border-card-border bg-card text-muted hover:border-accent/30'
                      }`}
                    >
                      <VIcon className="w-4 h-4 shrink-0" />
                      {v.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Timezone" id="timezone" options={TIMEZONES}
                value={form.timezone} onChange={e => set('timezone', e.target.value)}
              />
              <SelectField
                label="Currency" id="currency" options={CURRENCIES}
                value={form.currency} onChange={e => set('currency', e.target.value)}
              />
            </div>
          </div>
        )

      // ── STEP 2: Location ────────────────────────────────
      case 2:
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-foreground">Your location</h2>
              <p className="text-muted text-sm mt-1">Where do your clients come to you?</p>
            </div>

            {/* Toggle */}
            <button
              type="button"
              onClick={() => setHasLocation(!hasLocation)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-lg border text-left transition-all ${
                hasLocation
                  ? 'border-accent bg-accent/5 text-foreground'
                  : 'border-card-border bg-card text-muted'
              }`}
            >
              <div className={`w-10 h-5 rounded-full transition-colors relative ${hasLocation ? 'bg-accent' : 'bg-card-border'}`}>
                <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${hasLocation ? 'left-5.5' : 'left-0.5'}`}
                  style={{ left: hasLocation ? '22px' : '2px' }}
                />
              </div>
              <div>
                <span className="text-sm font-medium">I have a physical location</span>
                <p className="text-xs text-muted mt-0.5">Uncheck if you operate online only</p>
              </div>
            </button>

            {hasLocation ? (
              <div className="space-y-4">
                <InputField
                  label="Location name" id="locationName" placeholder={form.studioName || 'Main Location'}
                  value={form.locationName} onChange={e => set('locationName', e.target.value)}
                />
                <InputField
                  label="Address" id="address" placeholder="123 Main Street"
                  value={form.address} onChange={e => set('address', e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <InputField
                    label="City" id="city" placeholder="New York"
                    value={form.city} onChange={e => set('city', e.target.value)}
                  />
                  <InputField
                    label="Country" id="country" placeholder="USA"
                    value={form.country} onChange={e => set('country', e.target.value)}
                  />
                </div>
                <InputField
                  label="Phone" id="phone" type="tel" placeholder="+1 555 123 4567"
                  value={form.phone} onChange={e => set('phone', e.target.value)}
                />
              </div>
            ) : (
              <div className="text-center py-8">
                <Globe className="w-10 h-10 text-muted/30 mx-auto mb-3" />
                <p className="text-sm text-muted">No worries! You can add locations anytime in Settings.</p>
              </div>
            )}
          </div>
        )

      // ── STEP 3: Brand ──────────────────────────────────
      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Make it yours</h2>
              <p className="text-muted text-sm mt-1">Choose a look or import from your website.</p>
            </div>

            {/* Website import — most prominent */}
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wand2 className="w-4 h-4 text-accent" />
                <span className="text-sm font-semibold text-foreground">Import from your website</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-medium">Auto</span>
              </div>
              <p className="text-xs text-muted mb-3">
                We&apos;ll grab your logo, colors, and fonts automatically.
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={e => setWebsiteUrl(e.target.value)}
                    placeholder="www.yourbusiness.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-background border border-card-border text-foreground text-sm placeholder-muted/50 focus:outline-none focus:border-accent transition-colors"
                    onKeyDown={e => e.key === 'Enter' && handleAnalyzeWebsite()}
                  />
                </div>
                <button
                  onClick={handleAnalyzeWebsite}
                  disabled={analyzing || !websiteUrl.trim()}
                  className="px-4 py-2.5 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                >
                  {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {analyzing ? 'Analyzing...' : 'Analyze'}
                </button>
              </div>

              {/* Analysis progress */}
              {analyzing && (
                <div className="mt-3 space-y-1.5">
                  {ANALYZE_STEPS.map((s, i) => (
                    <div key={i} className={`flex items-center gap-2 text-xs transition-all duration-300 ${
                      i <= analyzeStep ? 'text-foreground' : 'text-muted/30'
                    }`}>
                      {i < analyzeStep ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : i === analyzeStep ? (
                        <Loader2 className="w-3 h-3 animate-spin text-accent" />
                      ) : (
                        <div className="w-3 h-3 rounded-full border border-card-border" />
                      )}
                      {s}
                    </div>
                  ))}
                </div>
              )}

              {/* Extracted results */}
              {extractedBrand && !analyzing && (
                <div className="mt-3 p-3 rounded-lg bg-card border border-card-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-medium text-foreground">Brand imported!</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    {extractedBrand.logo && (
                      <div className="flex items-center gap-1.5">
                        <img src={extractedBrand.logo} alt="" className="w-5 h-5 rounded object-contain" />
                        <span>Logo found</span>
                      </div>
                    )}
                    {extractedBrand.colors?.primary && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full border border-card-border" style={{ backgroundColor: extractedBrand.colors.primary }} />
                        <span>Colors detected</span>
                      </div>
                    )}
                    {(extractedBrand.titleFont || extractedBrand.font) && (
                      <span>Font: {extractedBrand.titleFont || extractedBrand.font}{extractedBrand.bodyFont && extractedBrand.bodyFont !== extractedBrand.titleFont ? ` / ${extractedBrand.bodyFont}` : ''}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Theme gallery — collapsible after AI analysis */}
            <div>
              <button
                type="button"
                onClick={() => setShowThemes(!showThemes)}
                className="flex items-center gap-3 w-full"
              >
                <div className="flex-1 h-px bg-card-border" />
                <span className="text-xs text-muted flex items-center gap-1.5">
                  {showThemes ? 'choose a theme' : 'show themes'}
                  <ChevronRight className={`w-3 h-3 transition-transform duration-300 ${showThemes ? 'rotate-90' : ''}`} />
                </span>
                <div className="flex-1 h-px bg-card-border" />
              </button>

              <div
                className={`grid grid-cols-3 gap-2 transition-all duration-500 ease-in-out origin-top ${
                  showThemes ? 'mt-3 max-h-[500px] opacity-100 scale-y-100' : 'max-h-0 opacity-0 scale-y-0 overflow-hidden'
                }`}
              >
                {THEMES.map(theme => {
                  const isSelected = selectedThemeId === theme.id && !customColors
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => { setSelectedThemeId(theme.id); setCustomColors(null); setCustomTitleFont(null); setCustomBodyFont(null); setExtractedBrand(null) }}
                      className={`relative rounded-lg border p-3 text-left transition-all ${
                        isSelected
                          ? 'border-accent ring-1 ring-accent'
                          : 'border-card-border hover:border-accent/30'
                      }`}
                    >
                      {/* Theme mini preview */}
                      <div className="flex gap-1 mb-2">
                        <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: theme.primary, borderColor: theme.border }} />
                        <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: theme.background, borderColor: theme.border }} />
                        <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: theme.surface, borderColor: theme.border }} />
                      </div>
                      <span className="text-xs font-semibold text-foreground block" style={{ fontFamily: `"${theme.titleFont}", ${theme.titleFontType}` }}>{theme.name}</span>
                      <span className="text-[10px] text-muted">{theme.description}</span>
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5">
                          <Check className="w-3.5 h-3.5 text-accent" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Live preview */}
            <div>
              <label className="block text-sm text-muted mb-2">Preview</label>
              <ThemePreview
                theme={effectiveTheme}
                businessName={form.studioName}
                logoUrl={form.logoUrl}
              />
            </div>

            {/* Customize (collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setShowCustomize(!showCustomize)}
                className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
              >
                <Palette className="w-4 h-4" />
                <span>Customize manually</span>
                <ChevronRight className={`w-4 h-4 transition-transform ${showCustomize ? 'rotate-90' : ''}`} />
              </button>

              {showCustomize && (
                <div className="mt-4 space-y-5 pl-6 border-l border-card-border">
                  {/* Logo upload */}
                  <div>
                    <label className="block text-xs text-muted mb-2">Logo</label>
                    {form.logoUrl ? (
                      <div className="flex items-center gap-4">
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-card-border bg-card">
                          <img src={form.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                          <button
                            type="button"
                            onClick={() => { set('logoUrl', null); setLogoFile(null) }}
                            className="absolute top-0 right-0 w-5 h-5 rounded-bl-lg bg-background/80 text-muted hover:text-red-400 flex items-center justify-center transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <label className="text-xs text-accent cursor-pointer hover:underline">
                          Change logo
                          <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
                        </label>
                      </div>
                    ) : (
                      <label className="flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-card-border bg-card/50 cursor-pointer hover:border-accent/30 transition-colors">
                        <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                          <Upload className="w-4 h-4 text-muted" />
                        </div>
                        <div>
                          <p className="text-xs text-foreground font-medium">Upload your logo</p>
                          <p className="text-[10px] text-muted">PNG, JPG, WebP, or SVG. Max 2MB.</p>
                        </div>
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
                      </label>
                    )}
                  </div>

                  {/* Title font selector */}
                  <div>
                    <label className="block text-xs text-muted mb-2">Title font</label>
                    <div className="grid grid-cols-2 gap-2">
                      {FONT_OPTIONS.map(f => (
                        <button
                          key={f.value}
                          type="button"
                          onClick={() => setCustomTitleFont(f.value)}
                          className={`px-3 py-2.5 rounded-lg border text-left transition-all ${
                            (customTitleFont || effectiveTheme.titleFont) === f.value
                              ? 'border-accent bg-accent/10'
                              : 'border-card-border bg-card hover:border-accent/30'
                          }`}
                        >
                          <span className="text-sm font-semibold text-foreground block" style={{ fontFamily: `"${f.value}", ${f.type.toLowerCase()}` }}>
                            {f.label}
                          </span>
                          <span className="text-[10px] text-muted">{f.type}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Body font selector */}
                  <div>
                    <label className="block text-xs text-muted mb-2">Body font</label>
                    <div className="grid grid-cols-2 gap-2">
                      {FONT_OPTIONS.map(f => (
                        <button
                          key={f.value}
                          type="button"
                          onClick={() => setCustomBodyFont(f.value)}
                          className={`px-3 py-2.5 rounded-lg border text-left transition-all ${
                            (customBodyFont || effectiveTheme.bodyFont) === f.value
                              ? 'border-accent bg-accent/10'
                              : 'border-card-border bg-card hover:border-accent/30'
                          }`}
                        >
                          <span className="text-sm font-semibold text-foreground block" style={{ fontFamily: `"${f.value}", ${f.type.toLowerCase()}` }}>
                            {f.label}
                          </span>
                          <span className="text-[10px] text-muted">{f.type}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color pickers */}
                  <div>
                    <label className="block text-xs text-muted mb-2">Colors</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'primary', label: 'Primary' },
                        { key: 'secondary', label: 'Secondary' },
                        { key: 'accent', label: 'Accent' },
                        { key: 'background', label: 'Background' },
                        { key: 'surface', label: 'Surface' },
                        { key: 'foreground', label: 'Text' },
                      ].map(({ key, label }) => {
                        const colorValue = (customColors?.[key] || effectiveTheme[key]) ?? '#000000'
                        return (
                          <label key={key} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-card-border bg-card cursor-pointer hover:border-accent/30 transition-colors">
                            <div className="relative shrink-0">
                              <div className="w-8 h-8 rounded-lg border border-card-border" style={{ backgroundColor: colorValue }} />
                              <input
                                type="color"
                                value={colorValue}
                                onChange={e => {
                                  const newColors = { ...(customColors || {}), [key]: e.target.value }
                                  // Auto-derive related shades when primary colors change
                                  if (key === 'primary') {
                                    newColors.primaryHover = darkenColor(e.target.value, 10)
                                  } else if (key === 'background') {
                                    const dark = isColorDark(e.target.value)
                                    newColors.surface = dark ? lightenColor(e.target.value, 8) : darkenColor(e.target.value, 3)
                                    newColors.surfaceHover = dark ? lightenColor(e.target.value, 14) : darkenColor(e.target.value, 6)
                                    newColors.border = dark ? lightenColor(e.target.value, 12) : darkenColor(e.target.value, 10)
                                    newColors.borderHover = dark ? lightenColor(e.target.value, 20) : darkenColor(e.target.value, 16)
                                    newColors.foreground = dark ? '#f0f0f5' : '#18181b'
                                    newColors.muted = '#71717a'
                                  } else if (key === 'surface') {
                                    newColors.surfaceHover = isColorDark(e.target.value) ? lightenColor(e.target.value, 6) : darkenColor(e.target.value, 4)
                                  }
                                  setCustomColors(newColors)
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              />
                            </div>
                            <div>
                              <span className="text-xs text-foreground font-medium block">{label}</span>
                              <span className="text-[10px] font-mono text-muted">{colorValue}</span>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-muted/50 text-center">You can change all of this anytime in Settings.</p>
          </div>
        )

      // ── STEP 4: Launch ──────────────────────────────────
      case 4:
        return (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-accent" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">You&apos;re all set!</h2>
            <p className="text-muted mb-8">
              <strong>{result?.tenant?.name || form.studioName}</strong> is ready to go.
            </p>

            <div className="bg-card border border-card-border rounded-lg p-4 mb-8 text-left">
              <p className="text-sm text-muted mb-1">Your URL</p>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-accent" />
                <p className="text-foreground font-mono text-sm">
                  {result?.tenant?.slug || form.slug}.zatrovo.com
                </p>
                <ExternalLink className="w-3 h-3 text-muted" />
              </div>
              {result?.tenant?.trialEndsAt && (
                <p className="text-xs text-muted mt-3">
                  Free until {new Date(result.tenant.trialEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>

            <div className="space-y-3 mb-8">
              <h3 className="text-sm font-semibold text-foreground">Get started checklist</h3>
              <div className="text-left space-y-2">
                {[
                  { icon: Zap, text: 'Add your first class type' },
                  { icon: Target, text: 'Create an instructor profile' },
                  { icon: Building2, text: 'Schedule your first class' },
                  { icon: Sparkles, text: 'Set up a class pack' },
                  { icon: Globe, text: 'Connect Stripe for payments' },
                  { icon: MapPin, text: 'Invite your first client' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-muted">
                    <div className="w-6 h-6 rounded-lg border border-card-border bg-card flex items-center justify-center">
                      <item.icon className="w-3 h-3" />
                    </div>
                    {item.text}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => window.location.href = '/admin'}
              className="w-full py-3 rounded-lg font-semibold text-background bg-accent hover:bg-accent-dim transition-colors flex items-center justify-center gap-2"
            >
              Go to Dashboard
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )
    }
  }

  const isLastFormStep = step === 3
  const isComplete = step === 4
  const isOptionalStep = step === 2 // Location is optional

  return (
    <>
      {/* Google Fonts for theme previews */}
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&family=Nunito:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <style>{`
        @keyframes tagline-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        .animate-tagline { animation: tagline-in 1.2s ease-in-out; }
      `}</style>

      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <div className={`w-full transition-all duration-300 ${step === 3 ? 'max-w-2xl' : 'max-w-lg'}`}>
          {/* Header */}
          {!isComplete && (
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">
                Zatrovo
              </h1>
              <p
                key={taglineIndex}
                className="animate-tagline text-muted/60 text-sm font-medium h-5"
              >
                {TAGLINES[taglineIndex]}
              </p>
            </div>
          )}

          {!isComplete && <StepIndicator current={step} steps={STEPS} />}

          <div className="bg-card border border-card-border rounded-xl p-8">
            {error && (
              <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            {renderStep()}

            {/* Navigation */}
            {!isComplete && (
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-card-border">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={prev}
                    className="flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                ) : (
                  <Link href="/login" className="text-sm text-muted hover:text-foreground transition-colors">
                    Already have an account?
                  </Link>
                )}

                <div className="flex items-center gap-3">
                  {isOptionalStep && (
                    <button
                      type="button"
                      onClick={skip}
                      className="flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
                    >
                      <SkipForward className="w-4 h-4" /> Skip
                    </button>
                  )}

                  {isLastFormStep ? (
                    <button
                      onClick={handleSubmit}
                      disabled={loading}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent text-background font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {loading ? 'Creating...' : 'Launch'}
                    </button>
                  ) : (
                    <button
                      onClick={next}
                      className="flex items-center gap-1 px-6 py-2.5 rounded-lg bg-accent text-background font-semibold hover:bg-accent-dim transition-colors"
                    >
                      Continue <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {!isComplete && step === 0 && (
            <p className="text-center text-xs text-muted mt-4">
              By creating an account you agree to our Terms of Service and Privacy Policy.
            </p>
          )}
        </div>
      </div>
    </>
  )
}
