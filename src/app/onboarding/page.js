'use client'

import { useState, useCallback, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { Check, ChevronRight, ChevronLeft, Loader2, Eye, EyeOff, Upload, X } from 'lucide-react'

const VERTICALS = [
  { value: 'boxing', label: 'Boxing / MMA', emoji: '🥊' },
  { value: 'yoga', label: 'Yoga / Pilates', emoji: '🧘' },
  { value: 'fitness', label: 'Gym / Fitness', emoji: '💪' },
  { value: 'dance', label: 'Dance Studio', emoji: '💃' },
  { value: 'pt', label: 'Personal Training', emoji: '🏋️' },
  { value: 'other', label: 'Other', emoji: '✨' },
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
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'THB', label: 'THB (฿)' },
  { value: 'AUD', label: 'AUD ($)' },
  { value: 'CAD', label: 'CAD ($)' },
  { value: 'SGD', label: 'SGD ($)' },
  { value: 'JPY', label: 'JPY (¥)' },
  { value: 'INR', label: 'INR (₹)' },
  { value: 'BRL', label: 'BRL (R$)' },
]

const STEPS = ['Account', 'Studio', 'Location', 'Brand', 'Launch']

function StepIndicator({ current, steps }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-10">
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
        className={`w-full px-4 py-3 rounded bg-background border ${error ? 'border-red-500/50' : 'border-card-border'} text-foreground placeholder-muted/50 focus:outline-none focus:border-accent transition-colors`}
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
        className={`w-full px-4 py-3 rounded bg-background border ${error ? 'border-red-500/50' : 'border-card-border'} text-foreground focus:outline-none focus:border-accent transition-colors`}
        {...props}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)

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
    primaryColor: '#3b82f6',
    logoUrl: null,
  })

  // Slug state
  const [slugAvailable, setSlugAvailable] = useState(null)
  const [slugChecking, setSlugChecking] = useState(false)
  const [autoSlug, setAutoSlug] = useState(true)

  // Result
  const [result, setResult] = useState(null)

  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setFieldErrors(prev => ({ ...prev, [key]: null }))
  }

  // Auto-generate slug from studio name
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

  const validateStep = useCallback(() => {
    const errors = {}

    if (step === 0) {
      if (!form.ownerName.trim()) errors.ownerName = 'Name is required'
      if (!form.ownerEmail.trim()) errors.ownerEmail = 'Email is required'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.ownerEmail)) errors.ownerEmail = 'Invalid email'
      if (!form.password) errors.password = 'Password is required'
      else if (form.password.length < 8) errors.password = 'At least 8 characters'
    }

    if (step === 1) {
      if (!form.studioName.trim()) errors.studioName = 'Studio name is required'
      if (!form.slug || form.slug.length < 3) errors.slug = 'URL must be at least 3 characters'
      if (slugAvailable === false) errors.slug = 'This URL is taken'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }, [step, form, slugAvailable])

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

  const handleSubmit = async () => {
    if (!validateStep()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/onboarding/create-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        if (data.field) {
          setFieldErrors(prev => ({ ...prev, [data.field]: data.error }))
          // Go back to the step with the error
          if (['ownerName', 'ownerEmail', 'password'].includes(data.field)) setStep(0)
          else if (['studioName', 'slug'].includes(data.field)) setStep(1)
        }
        setLoading(false)
        return
      }

      setResult(data)

      // Auto-login
      const loginResult = await signIn('credentials', {
        email: form.ownerEmail,
        password: form.password,
        redirect: false,
      })

      if (loginResult?.error) {
        setError('Account created but auto-login failed. Please log in manually.')
      }

      setStep(STEPS.length - 1)
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Preview immediately
    const preview = URL.createObjectURL(file)
    set('logoUrl', preview)
    set('_logoFile', file)
  }

  // ─── Step content ──────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      case 0: // Account
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Create your account</h2>
            <p className="text-muted text-sm mb-6">You&apos;ll be the owner of this studio.</p>

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

      case 1: // Studio
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Set up your studio</h2>
            <p className="text-muted text-sm mb-6">Tell us about your business.</p>

            <InputField
              label="Studio name" id="studioName" placeholder="My Fitness Studio"
              value={form.studioName} onChange={e => set('studioName', e.target.value)}
              error={fieldErrors.studioName}
            />

            <div>
              <label htmlFor="slug" className="block text-sm text-muted mb-1.5">Studio URL</label>
              <div className="flex items-center gap-0">
                <span className="px-3 py-3 rounded-l bg-card border border-r-0 border-card-border text-muted text-sm whitespace-nowrap">
                  https://
                </span>
                <input
                  id="slug"
                  value={form.slug}
                  onChange={e => { setAutoSlug(false); set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')) }}
                  className={`flex-1 px-3 py-3 bg-background border ${fieldErrors.slug ? 'border-red-500/50' : 'border-card-border'} text-foreground placeholder-muted/50 focus:outline-none focus:border-accent transition-colors min-w-0`}
                  placeholder="my-studio"
                />
                <span className="px-3 py-3 rounded-r bg-card border border-l-0 border-card-border text-muted text-sm whitespace-nowrap">
                  .yourdomain.com
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
                {VERTICALS.map(v => (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => set('vertical', v.value)}
                    className={`px-4 py-3 rounded border text-left text-sm transition-all ${
                      form.vertical === v.value
                        ? 'border-accent bg-accent/10 text-foreground'
                        : 'border-card-border bg-card text-muted hover:border-accent/30'
                    }`}
                  >
                    <span className="mr-2">{v.emoji}</span>{v.label}
                  </button>
                ))}
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

      case 2: // Location
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Your location</h2>
            <p className="text-muted text-sm mb-6">Where is your studio? You can add more locations later.</p>

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

            <p className="text-muted text-xs">All fields are optional. You can update them later in Settings.</p>
          </div>
        )

      case 3: // Brand
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground">Brand your studio</h2>
            <p className="text-muted text-sm mb-6">Make it yours. You can change these anytime.</p>

            {/* Logo upload */}
            <div>
              <label className="block text-sm text-muted mb-2">Logo</label>
              <div className="flex items-center gap-4">
                {form.logoUrl ? (
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-card-border bg-card">
                    <img src={form.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => { set('logoUrl', null); set('_logoFile', null) }}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="w-16 h-16 rounded-lg border border-dashed border-card-border bg-card flex items-center justify-center cursor-pointer hover:border-accent/30 transition-colors">
                    <Upload className="w-5 h-5 text-muted" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                )}
                <div className="text-xs text-muted">
                  <p>PNG, JPG, WebP, or SVG</p>
                  <p>Max 2MB</p>
                </div>
              </div>
            </div>

            {/* Color picker */}
            <div>
              <label className="block text-sm text-muted mb-2">Brand color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={e => set('primaryColor', e.target.value)}
                  className="w-12 h-10 rounded cursor-pointer border border-card-border bg-transparent"
                />
                <input
                  type="text"
                  value={form.primaryColor}
                  onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) set('primaryColor', e.target.value) }}
                  className="w-28 px-3 py-2 rounded bg-background border border-card-border text-foreground text-sm font-mono focus:outline-none focus:border-accent"
                />
                <div className="flex gap-1.5">
                  {['#3b82f6', '#ef4444', '#22c55e', '#f97316', '#8b5cf6', '#ec4899', '#c8a750'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set('primaryColor', c)}
                      className={`w-7 h-7 rounded-full transition-all ${form.primaryColor === c ? 'ring-2 ring-offset-2 ring-offset-background ring-accent scale-110' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Live preview */}
            <div>
              <label className="block text-sm text-muted mb-2">Preview</label>
              <div className="rounded-lg border border-card-border bg-card p-4">
                <div className="flex items-center gap-3 mb-3">
                  {form.logoUrl ? (
                    <img src={form.logoUrl} alt="" className="w-8 h-8 rounded object-contain" />
                  ) : (
                    <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold text-background" style={{ backgroundColor: form.primaryColor }}>
                      {(form.studioName || 'S')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="font-semibold text-foreground">{form.studioName || 'Your Studio'}</span>
                </div>
                <div className="flex gap-2">
                  <div className="px-4 py-2 rounded text-sm font-medium text-background" style={{ backgroundColor: form.primaryColor }}>
                    Book a Class
                  </div>
                  <div className="px-4 py-2 rounded text-sm font-medium border" style={{ borderColor: form.primaryColor, color: form.primaryColor }}>
                    View Schedule
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 4: // Launch (result)
        return (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-foreground mb-2">You&apos;re all set!</h2>
            <p className="text-muted mb-8">
              <strong>{result?.tenant?.name || form.studioName}</strong> is ready to go.
            </p>

            <div className="bg-card border border-card-border rounded-lg p-4 mb-8 text-left">
              <p className="text-sm text-muted mb-1">Your studio URL</p>
              <p className="text-foreground font-mono text-sm">
                https://{result?.tenant?.slug || form.slug}.yourdomain.com
              </p>
              {result?.tenant?.trialEndsAt && (
                <p className="text-xs text-muted mt-3">
                  Free trial until {new Date(result.tenant.trialEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Get started checklist</h3>
              <div className="text-left space-y-2">
                {[
                  'Add your first class type',
                  'Create an instructor profile',
                  'Schedule your first class',
                  'Set up a class pack for members',
                  'Connect Stripe for payments',
                  'Invite your first member',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-muted">
                    <div className="w-5 h-5 rounded border border-card-border flex items-center justify-center text-xs">
                      {i + 1}
                    </div>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => window.location.href = '/admin'}
              className="w-full mt-8 py-3 rounded font-semibold text-background transition-colors"
              style={{ backgroundColor: form.primaryColor }}
            >
              Go to Admin Dashboard
            </button>
          </div>
        )
    }
  }

  const isLastFormStep = step === 3
  const isComplete = step === 4

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Launch your studio
          </h1>
          <p className="text-muted text-sm mt-1">Free 14-day trial. No credit card required.</p>
        </div>

        {!isComplete && <StepIndicator current={step} steps={STEPS} />}

        <div className="bg-card border border-card-border rounded-lg p-8">
          {error && (
            <div className="mb-6 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
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

              {isLastFormStep ? (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded bg-accent text-background font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loading ? 'Creating...' : 'Launch Studio'}
                </button>
              ) : (
                <button
                  onClick={next}
                  className="flex items-center gap-1 px-6 py-2.5 rounded bg-accent text-background font-semibold hover:bg-accent-dim transition-colors"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {!isComplete && (
          <p className="text-center text-xs text-muted mt-4">
            By creating an account you agree to our Terms of Service and Privacy Policy.
          </p>
        )}
      </div>
    </div>
  )
}
