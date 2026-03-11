'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-96 bg-card rounded-lg" />}>
      <SettingsContent />
    </Suspense>
  )
}

const TABS = [
  { id: 'payments', label: 'Payments', icon: '💳' },
  { id: 'studio', label: 'Studio', icon: '🏢' },
  { id: 'social', label: 'Social Links', icon: '🔗' },
  { id: 'seo', label: 'SEO', icon: '🔍' },
  { id: 'booking', label: 'Booking', icon: '📋' },
  { id: 'reminders', label: 'Reminders', icon: '🔔' },
]

function SettingsContent() {
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('tab') || 'payments'
  const [activeTab, setActiveTab] = useState(defaultTab)

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">Settings</h1>

      {/* Tab buttons — horizontal scroll on mobile */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0',
              activeTab === tab.id
                ? 'bg-accent/10 text-accent'
                : 'text-muted hover:text-foreground hover:bg-white/5'
            )}
          >
            <span className="text-base">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'payments' && <PaymentsTab />}
      {activeTab === 'studio' && <StudioInfoTab />}
      {activeTab === 'social' && <SocialLinksTab />}
      {activeTab === 'seo' && <SeoTab />}
      {activeTab === 'booking' && <BookingRulesTab />}
      {activeTab === 'reminders' && <RemindersTab />}
    </div>
  )
}

// ─── Studio Info Tab (B1) ────────────────────────────────────────────────────

function StudioInfoTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [form, setForm] = useState({
    studio_name: '',
    studio_address: '',
    studio_phone: '',
    studio_email: '',
    studio_website: '',
  })

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/settings')
        if (res.ok) {
          const { settings } = await res.json()
          setForm({
            studio_name: settings.studio_name || 'BOXX Boxing Studio',
            studio_address: settings.studio_address || '89/2 Bumruang Road, Wat Ket, Chiang Mai 50000',
            studio_phone: settings.studio_phone || '+66 93 497 2306',
            studio_email: settings.studio_email || 'hello@boxxthailand.com',
            studio_website: settings.studio_website || 'https://boxxthailand.com',
          })
        }
      } catch (err) {
        console.error('Failed to load settings:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Studio info saved.' })
      } else {
        setMessage({ type: 'error', text: 'Failed to save.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-card-border rounded w-48" />
            <div className="h-10 bg-card-border rounded w-full" />
            <div className="h-10 bg-card-border rounded w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Studio Information</CardTitle>
        <CardDescription>Public contact details for your studio</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="studio_name">Studio Name</Label>
            <Input id="studio_name" value={form.studio_name} onChange={(e) => setForm({ ...form, studio_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="studio_address">Address</Label>
            <Input id="studio_address" value={form.studio_address} onChange={(e) => setForm({ ...form, studio_address: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="studio_phone">Phone</Label>
              <Input id="studio_phone" value={form.studio_phone} onChange={(e) => setForm({ ...form, studio_phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="studio_email">Email</Label>
              <Input id="studio_email" type="email" value={form.studio_email} onChange={(e) => setForm({ ...form, studio_email: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="studio_website">Website</Label>
            <Input id="studio_website" value={form.studio_website} onChange={(e) => setForm({ ...form, studio_website: e.target.value })} />
          </div>

          {message && (
            <p className={cn('text-sm', message.type === 'success' ? 'text-green-400' : 'text-red-400')}>
              {message.text}
            </p>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Studio Info'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Social Links Tab ────────────────────────────────────────────────────────

function SocialLinksTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [form, setForm] = useState({
    social_instagram: '',
    social_tiktok: '',
    social_facebook: '',
    social_line: '',
    social_youtube: '',
  })

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/settings')
        if (res.ok) {
          const { settings } = await res.json()
          setForm({
            social_instagram: settings.social_instagram || 'https://instagram.com/boxxthailand',
            social_tiktok: settings.social_tiktok || 'https://tiktok.com/@boxxthailand',
            social_facebook: settings.social_facebook || '',
            social_line: settings.social_line || '@boxxthailand',
            social_youtube: settings.social_youtube || '',
          })
        }
      } catch (err) {
        console.error('Failed to load settings:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Social links saved. Changes are live on the website.' })
      } else {
        setMessage({ type: 'error', text: 'Failed to save.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-card-border rounded w-48" />
            <div className="h-10 bg-card-border rounded w-full" />
            <div className="h-10 bg-card-border rounded w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const fields = [
    { key: 'social_instagram', label: 'Instagram URL', placeholder: 'https://instagram.com/boxxthailand' },
    { key: 'social_tiktok', label: 'TikTok URL', placeholder: 'https://tiktok.com/@boxxthailand' },
    { key: 'social_facebook', label: 'Facebook URL', placeholder: 'https://facebook.com/boxxthailand' },
    { key: 'social_line', label: 'LINE ID', placeholder: '@boxxthailand' },
    { key: 'social_youtube', label: 'YouTube URL', placeholder: 'https://youtube.com/@boxxthailand' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Social Media Links</CardTitle>
        <CardDescription>These appear in the footer, contact section, and email templates. Changes go live immediately.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                value={form[field.key]}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                placeholder={field.placeholder}
              />
            </div>
          ))}

          {message && (
            <p className={cn('text-sm', message.type === 'success' ? 'text-green-400' : 'text-red-400')}>
              {message.text}
            </p>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Social Links'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── SEO Tab ────────────────────────────────────────────────────────────────

function SeoTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [form, setForm] = useState({
    seo_title: '',
    seo_description: '',
    seo_keywords: '',
    seo_og_title: '',
    seo_og_description: '',
    seo_og_image: '',
    seo_url: '',
  })

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/settings')
        if (res.ok) {
          const { settings } = await res.json()
          setForm({
            seo_title: settings.seo_title || 'BOXX | Luxury Boutique Boxing & Personal Training Studio in Chiang Mai',
            seo_description: settings.seo_description || "Chiang Mai's first luxury boutique boxing and personal training studio. UK-qualified coaches delivering authentic British boxing and strength training. Small-group classes, max 6 per session.",
            seo_keywords: settings.seo_keywords || 'boxing, chiang mai, personal training, boutique gym, luxury fitness, boxing classes, strength training, thailand',
            seo_og_title: settings.seo_og_title || 'BOXX | Luxury Boutique Boxing Studio in Chiang Mai',
            seo_og_description: settings.seo_og_description || 'Boxing and strength training, done properly. Small-group classes led by UK-qualified coaches.',
            seo_og_image: settings.seo_og_image || '/images/brand/og-share.jpg',
            seo_url: settings.seo_url || 'https://www.boxxthailand.com',
          })
        }
      } catch (err) {
        console.error('Failed to load settings:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'SEO settings saved. Changes take effect on next page load.' })
      } else {
        setMessage({ type: 'error', text: 'Failed to save.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-card-border rounded w-48" />
            <div className="h-10 bg-card-border rounded w-full" />
            <div className="h-10 bg-card-border rounded w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Page Title & Meta</CardTitle>
          <CardDescription>Controls how your site appears in Google search results</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="seo_title">Page Title</Label>
              <Input
                id="seo_title"
                value={form.seo_title}
                onChange={(e) => setForm({ ...form, seo_title: e.target.value })}
                placeholder="BOXX | Luxury Boxing Studio in Chiang Mai"
              />
              <p className="text-xs text-muted">{form.seo_title.length}/60 characters — keep under 60 for best results</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="seo_description">Meta Description</Label>
              <textarea
                id="seo_description"
                value={form.seo_description}
                onChange={(e) => setForm({ ...form, seo_description: e.target.value })}
                rows={3}
                className="flex w-full rounded-md border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                placeholder="A short description of your business for search engines"
              />
              <p className="text-xs text-muted">{form.seo_description.length}/160 characters — keep under 160 for best results</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="seo_keywords">Keywords</Label>
              <Input
                id="seo_keywords"
                value={form.seo_keywords}
                onChange={(e) => setForm({ ...form, seo_keywords: e.target.value })}
                placeholder="boxing, chiang mai, personal training, fitness"
              />
              <p className="text-xs text-muted">Comma-separated keywords</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="seo_url">Site URL</Label>
              <Input
                id="seo_url"
                value={form.seo_url}
                onChange={(e) => setForm({ ...form, seo_url: e.target.value })}
                placeholder="https://www.boxxthailand.com"
              />
            </div>

            {message && (
              <p className={cn('text-sm', message.type === 'success' ? 'text-green-400' : 'text-red-400')}>
                {message.text}
              </p>
            )}

            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save SEO Settings'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Social Sharing (Open Graph)</CardTitle>
          <CardDescription>Controls how your site appears when shared on social media</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="seo_og_title">Share Title</Label>
              <Input
                id="seo_og_title"
                value={form.seo_og_title}
                onChange={(e) => setForm({ ...form, seo_og_title: e.target.value })}
                placeholder="BOXX | Luxury Boxing Studio"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="seo_og_description">Share Description</Label>
              <textarea
                id="seo_og_description"
                value={form.seo_og_description}
                onChange={(e) => setForm({ ...form, seo_og_description: e.target.value })}
                rows={2}
                className="flex w-full rounded-md border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                placeholder="Short description for social media shares"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="seo_og_image">Share Image URL</Label>
              <Input
                id="seo_og_image"
                value={form.seo_og_image}
                onChange={(e) => setForm({ ...form, seo_og_image: e.target.value })}
                placeholder="https://www.boxxthailand.com/images/brand/og-image.jpg"
              />
              <p className="text-xs text-muted">Recommended: 1200x630px. Leave blank to use auto-generated image.</p>
              {form.seo_og_image && (
                <div className="mt-2 rounded border border-card-border overflow-hidden max-w-xs">
                  <img src={form.seo_og_image} alt="OG preview" className="w-full" onError={(e) => { e.target.style.display = 'none' }} />
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="mt-4 p-4 rounded-lg bg-background/50 border border-card-border/50">
              <p className="text-[10px] uppercase tracking-wider text-muted mb-2">Social Share Preview</p>
              <div className="rounded border border-card-border overflow-hidden max-w-sm">
                {form.seo_og_image ? (
                  <img src={form.seo_og_image} alt="Share preview" className="w-full aspect-[1200/630] object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                ) : (
                  <div className="h-32 bg-card-border flex items-center justify-center text-muted text-xs">
                    Auto-generated image
                  </div>
                )}
                <div className="p-3 bg-card">
                  <p className="text-xs text-muted truncate">{form.seo_url || 'boxxthailand.com'}</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5 truncate">{form.seo_og_title || 'Page title'}</p>
                  <p className="text-xs text-muted mt-0.5 line-clamp-2">{form.seo_og_description || 'Page description'}</p>
                </div>
              </div>
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Social Sharing'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Booking Rules Tab (B2) ──────────────────────────────────────────────────

function BookingRulesTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [form, setForm] = useState({
    default_capacity: '6',
    cancellation_window_hours: '24',
    max_advance_booking_days: '28',
  })

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/settings')
        if (res.ok) {
          const { settings } = await res.json()
          setForm({
            default_capacity: settings.default_capacity || '6',
            cancellation_window_hours: settings.cancellation_window_hours || '24',
            max_advance_booking_days: settings.max_advance_booking_days || '28',
          })
        }
      } catch (err) {
        console.error('Failed to load settings:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Booking rules saved.' })
      } else {
        setMessage({ type: 'error', text: 'Failed to save.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-card-border rounded w-48" />
            <div className="h-10 bg-card-border rounded w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Booking Rules</CardTitle>
        <CardDescription>Configure default booking behavior and policies</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="default_capacity">Default Class Capacity</Label>
            <Input
              id="default_capacity"
              type="number"
              min="1"
              max="50"
              value={form.default_capacity}
              onChange={(e) => setForm({ ...form, default_capacity: e.target.value })}
            />
            <p className="text-xs text-muted">Maximum number of members per class (default for new classes)</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cancellation_window_hours">Cancellation Window (hours)</Label>
            <Input
              id="cancellation_window_hours"
              type="number"
              min="0"
              max="168"
              value={form.cancellation_window_hours}
              onChange={(e) => setForm({ ...form, cancellation_window_hours: e.target.value })}
            />
            <p className="text-xs text-muted">Members must cancel at least this many hours before class to receive a credit refund</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="max_advance_booking_days">Max Advance Booking (days)</Label>
            <Input
              id="max_advance_booking_days"
              type="number"
              min="1"
              max="90"
              value={form.max_advance_booking_days}
              onChange={(e) => setForm({ ...form, max_advance_booking_days: e.target.value })}
            />
            <p className="text-xs text-muted">How far in advance members can book classes</p>
          </div>

          {message && (
            <p className={cn('text-sm', message.type === 'success' ? 'text-green-400' : 'text-red-400')}>
              {message.text}
            </p>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Booking Rules'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Reminders Tab (B3) ──────────────────────────────────────────────────────

function RemindersTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [reminder1h, setReminder1h] = useState(true)
  const [reminder24h, setReminder24h] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/settings')
        if (res.ok) {
          const { settings } = await res.json()
          setReminder1h(settings.reminder_1h !== 'false')
          setReminder24h(settings.reminder_24h === 'true')
        }
      } catch (err) {
        console.error('Failed to load settings:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reminder_1h: reminder1h.toString(),
          reminder_24h: reminder24h.toString(),
        }),
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Reminder settings saved.' })
      } else {
        setMessage({ type: 'error', text: 'Failed to save.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-card-border rounded w-48" />
            <div className="h-10 bg-card-border rounded w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Class Reminders</CardTitle>
        <CardDescription>Configure automated email reminders sent before classes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-card-border/50">
          <div>
            <p className="text-sm font-medium text-foreground">1-Hour Reminder</p>
            <p className="text-xs text-muted mt-0.5">Send reminder email 1 hour before class starts</p>
          </div>
          <Switch
            checked={reminder1h}
            onCheckedChange={setReminder1h}
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-card-border/50">
          <div>
            <p className="text-sm font-medium text-foreground">24-Hour Reminder</p>
            <p className="text-xs text-muted mt-0.5">Send reminder email 24 hours before class starts</p>
          </div>
          <Switch
            checked={reminder24h}
            onCheckedChange={setReminder24h}
          />
        </div>

        <div className="p-3 bg-amber-600/10 border border-amber-600/20 rounded-lg">
          <p className="text-xs text-amber-400/80">Reminders require the RESEND_API_KEY environment variable to be configured. The 1-hour reminder runs via a cron job every 15 minutes.</p>
        </div>

        {message && (
          <p className={cn('text-sm', message.type === 'success' ? 'text-green-400' : 'text-red-400')}>
            {message.text}
          </p>
        )}

        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Reminder Settings'}
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Payments Tab (existing) ─────────────────────────────────────────────────

function PaymentsTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState(null)
  const [stripeConfigured, setStripeConfigured] = useState(false)
  const [secretKey, setSecretKey] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [settingsRes, stripeRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/settings/stripe-status'),
      ])

      if (settingsRes.ok) {
        const { settings } = await settingsRes.json()
        if (settings.stripe_secret_key) setSecretKey('sk_•••••••••••••••••')
      }

      if (stripeRes.ok) {
        const data = await stripeRes.json()
        setStripeConfigured(data.configured)
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveKey() {
    if (!secretKey || secretKey.includes('•')) {
      setSaveMessage({ type: 'error', text: 'Enter your Stripe secret key.' })
      return
    }

    setSaving(true)
    setSaveMessage(null)

    try {
      const res = await fetch('/api/admin/stripe-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretKey: secretKey.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setSaveMessage({ type: 'error', text: data.error || 'Failed to save.' })
        return
      }

      setStripeConfigured(true)
      setSecretKey('sk_•••••••••••••••••')

      if (data.webhookConfigured) {
        setSaveMessage({ type: 'success', text: 'Stripe connected! Webhook configured automatically.' })
      } else {
        setSaveMessage({ type: 'success', text: 'Key saved but webhook could not be auto-configured. Set it up manually in Stripe.' })
      }
    } catch (err) {
      setSaveMessage({ type: 'error', text: 'Failed to connect Stripe.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleClearKeys() {
    if (!confirm('Disconnect Stripe? Payments will stop working until a new key is added.')) return
    setSaving(true)
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripe_secret_key: '', stripe_webhook_secret: '' }),
      })
      setSecretKey('')
      setStripeConfigured(false)
      setSaveMessage({ type: 'success', text: 'Stripe disconnected.' })
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to disconnect.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-card-border rounded w-48" />
            <div className="h-12 bg-card-border rounded w-full sm:w-64" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stripe Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span>💳</span> Stripe Payments
          </CardTitle>
          <CardDescription>
            Paste your Stripe Secret Key to enable payments. Webhooks are configured automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            {stripeConfigured ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Badge variant="destructive">Not Connected</Badge>
            )}
          </div>

          <div>
            <Label htmlFor="stripe-sk">Secret Key</Label>
            <Input
              id="stripe-sk"
              type="password"
              placeholder="sk_test_... or sk_live_..."
              value={secretKey}
              onFocus={() => { if (secretKey.includes('•')) setSecretKey('') }}
              onChange={(e) => setSecretKey(e.target.value)}
              className="mt-1 font-mono text-xs"
            />
            <p className="text-[11px] text-muted mt-1">
              From{' '}
              <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                Stripe Dashboard → Developers → API Keys
              </a>
            </p>
          </div>

          {saveMessage && (
            <p className={cn('text-sm', saveMessage.type === 'success' ? 'text-green-400' : 'text-red-400')}>
              {saveMessage.text}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button onClick={handleSaveKey} disabled={saving} className="w-full sm:w-auto">
              {saving ? 'Connecting...' : stripeConfigured ? 'Update Key' : 'Connect Stripe'}
            </Button>
            {stripeConfigured && (
              <>
                <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                  <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer">
                    API Keys ↗
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                  <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer">
                    Webhooks ↗
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto text-red-400 border-red-400/30 hover:bg-red-400/10"
                  onClick={handleClearKeys}
                  disabled={saving}
                >
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Setup instructions — always visible */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{stripeConfigured ? 'Linking Products' : 'Setup Guide'}</CardTitle>
          <CardDescription>
            {stripeConfigured
              ? 'Link each of your class packs to a Stripe product so customers can pay.'
              : 'Follow these steps to start accepting payments.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-muted list-decimal list-inside">
            {!stripeConfigured && (
              <>
                <li>Create a <a href="https://dashboard.stripe.com/register" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Stripe account</a> (or sign in to your existing one)</li>
                <li>Go to <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Developers → API Keys</a> and copy your <strong className="text-foreground">Secret Key</strong></li>
                <li>Paste it above and click <strong className="text-foreground">Connect Stripe</strong> — webhooks are set up automatically</li>
              </>
            )}
            <li>
              Go to your <a href="https://dashboard.stripe.com/products" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Stripe Product Catalogue</a> and create a <strong className="text-foreground">Product</strong> for each class pack (e.g. &quot;5 Class Pack — ฿2,750&quot;). Set the price when creating the product.
            </li>
            <li>
              Copy the <strong className="text-foreground">product URL</strong> from your browser address bar (it looks like <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">https://dashboard.stripe.com/products/prod_...</code>)
            </li>
            <li>
              Go to the <a href="/admin/packs" className="text-accent hover:underline">Class Packs</a> page, edit each pack, and paste the URL into the <strong className="text-foreground">Stripe Product</strong> field. The system will automatically link it.
            </li>
          </ol>
          {stripeConfigured && (
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="https://dashboard.stripe.com/products" target="_blank" rel="noopener noreferrer">
                  Product Catalogue ↗
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/admin/packs">
                  Class Packs →
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
