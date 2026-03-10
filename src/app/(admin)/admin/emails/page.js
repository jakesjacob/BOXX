'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'overview', label: 'Email Events', icon: '📧' },
  { id: 'compose', label: 'Compose', icon: '✉️' },
]

// ─── Email events ───────────────────────────────────────────────────────────

const EMAIL_EVENTS = [
  { slug: 'booking_confirmation', name: 'Booking Confirmation', description: 'Sent when a member books a class', trigger: 'Member books a class', defaultSubject: 'Booking Confirmed — {{class}}' },
  { slug: 'class_reminder', name: 'Class Reminder (1hr)', description: 'Sent 1 hour before a class starts', trigger: 'Cron every 15min', defaultSubject: 'Reminder: {{class}} in 1 hour' },
  { slug: 'waitlist_promotion', name: 'Waitlist Promotion', description: 'Sent when a member is promoted from the waitlist', trigger: 'Spot opens up', defaultSubject: 'Spot Available — {{class}}' },
  { slug: 'credit_expiry_warning', name: 'Credit Expiry Warning', description: 'Sent when credits are about to expire', trigger: 'Cron daily', defaultSubject: 'Credits Expiring Soon — {{pack}}' },
  { slug: 'welcome', name: 'Welcome Email', description: 'Sent when a new member registers', trigger: 'User registers', defaultSubject: 'Welcome to BOXX' },
  { slug: 'cancellation_confirmation', name: 'Cancellation Confirmation', description: 'Sent when a member cancels a booking', trigger: 'Member cancels', defaultSubject: 'Booking Cancelled — {{class}}' },
  { slug: 'class_cancelled_admin', name: 'Class Cancelled by Admin', description: 'Sent to all booked members when admin cancels a class', trigger: 'Admin cancels class', defaultSubject: 'Class Cancelled — {{class}}' },
  { slug: 'pack_purchase_confirmation', name: 'Pack Purchase Confirmation', description: 'Sent after successful pack purchase', trigger: 'Stripe webhook', defaultSubject: 'Pack Purchased — {{pack}}' },
  { slug: 'credits_low_warning', name: 'Credits Low Warning', description: 'Sent when member has 1 credit remaining', trigger: 'Credit drops to 1', defaultSubject: 'Low Credits — 1 remaining' },
  { slug: 'class_changed', name: 'Class Change Notification', description: 'Sent when admin edits a class with existing bookings', trigger: 'Admin edits class', defaultSubject: 'Class Updated — {{class}}' },
  { slug: 'removed_from_class', name: 'Removed from Class', description: 'Sent when admin removes a member from a class', trigger: 'Admin removes member', defaultSubject: 'Removed from {{class}}' },
  { slug: 'admin_cancelled_booking', name: 'Admin Cancels Booking', description: 'Sent when admin cancels a booking on behalf of a member', trigger: 'Admin cancels booking', defaultSubject: 'Booking Cancelled — {{class}}' },
  { slug: 'private_class_invitation', name: 'Private Class Invitation', description: 'Sent when admin adds a member to a private class', trigger: 'Admin adds to private class', defaultSubject: 'Private Class Invitation — {{class}}' },
]

export default function EmailsPage() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">Emails</h1>

      {/* Tab buttons */}
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

      {activeTab === 'overview' && <EmailOverviewTab />}
      {activeTab === 'compose' && <ComposeTab />}
    </div>
  )
}

// ─── Email Overview Tab ──────────────────────────────────────────────────────

function EmailOverviewTab() {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [editSlug, setEditSlug] = useState(null)
  const [previewSlug, setPreviewSlug] = useState(null)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  // Load all email settings
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/settings')
        if (res.ok) {
          const { settings: s } = await res.json()
          setSettings(s || {})
        }
      } catch (err) {
        console.error('Failed to load settings:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const isEnabled = useCallback((slug) => {
    const key = `email_${slug}_enabled`
    return settings[key] !== 'false'
  }, [settings])

  const getCustomSubject = useCallback((slug) => {
    return settings[`email_${slug}_subject`] || ''
  }, [settings])

  const getCustomBody = useCallback((slug) => {
    return settings[`email_${slug}_body`] || ''
  }, [settings])

  async function toggleEnabled(slug) {
    const key = `email_${slug}_enabled`
    const newValue = isEnabled(slug) ? 'false' : 'true'
    setSaving(slug)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newValue }),
      })
      if (res.ok) {
        setSettings((prev) => ({ ...prev, [key]: newValue }))
      }
    } catch (err) {
      console.error('Failed to toggle:', err)
    } finally {
      setSaving(null)
    }
  }

  async function saveCustomMessage(slug, subject, body) {
    setSaving(slug)
    try {
      const updates = {}
      updates[`email_${slug}_subject`] = subject
      updates[`email_${slug}_body`] = body
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        setSettings((prev) => ({
          ...prev,
          [`email_${slug}_subject`]: subject,
          [`email_${slug}_body`]: body,
        }))
        setEditSlug(null)
      }
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(null)
    }
  }

  async function openPreview(slug) {
    setPreviewSlug(slug)
    setPreviewLoading(true)
    setPreviewHtml('')
    try {
      const res = await fetch(`/api/admin/emails/preview?slug=${slug}`)
      if (res.ok) {
        const html = await res.text()
        setPreviewHtml(html)
      } else {
        setPreviewHtml('<p style="color:#888;padding:40px;text-align:center;">Failed to load preview</p>')
      }
    } catch {
      setPreviewHtml('<p style="color:#888;padding:40px;text-align:center;">Failed to load preview</p>')
    } finally {
      setPreviewLoading(false)
    }
  }

  const enabledCount = EMAIL_EVENTS.filter((e) => isEnabled(e.slug)).length

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="py-4 px-4">
              <div className="animate-pulse flex items-center gap-4">
                <div className="h-5 bg-card-border rounded w-48" />
                <div className="flex-1" />
                <div className="h-5 bg-card-border rounded w-12" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="py-4 px-4 text-center">
            <p className="text-2xl font-bold text-green-400">{enabledCount}</p>
            <p className="text-xs text-muted mt-1">Enabled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-4 text-center">
            <p className="text-2xl font-bold text-zinc-400">{EMAIL_EVENTS.length - enabledCount}</p>
            <p className="text-xs text-muted mt-1">Disabled</p>
          </CardContent>
        </Card>
      </div>

      {/* Email event cards */}
      <div className="space-y-2">
        {EMAIL_EVENTS.map((event) => {
          const enabled = isEnabled(event.slug)
          const hasCustom = getCustomSubject(event.slug) || getCustomBody(event.slug)

          return (
            <Card key={event.slug} className={cn(!enabled && 'opacity-60')}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{event.name}</p>
                      {hasCustom && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                          Customised
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-0.5">{event.description}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openPreview(event.slug)}
                      className="text-xs text-muted hover:text-foreground transition-colors px-2 py-1"
                      title="Preview"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => setEditSlug(event.slug)}
                      className="text-xs text-muted hover:text-foreground transition-colors px-2 py-1"
                      title="Edit message"
                    >
                      Edit
                    </button>
                    <Switch
                      checked={enabled}
                      onCheckedChange={() => toggleEnabled(event.slug)}
                      disabled={saving === event.slug}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Edit Dialog */}
      <EditEmailDialog
        slug={editSlug}
        event={EMAIL_EVENTS.find((e) => e.slug === editSlug)}
        customSubject={editSlug ? getCustomSubject(editSlug) : ''}
        customBody={editSlug ? getCustomBody(editSlug) : ''}
        saving={saving}
        onSave={saveCustomMessage}
        onClose={() => setEditSlug(null)}
      />

      {/* Preview Dialog */}
      <Dialog open={!!previewSlug} onOpenChange={() => setPreviewSlug(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-base">
              {EMAIL_EVENTS.find((e) => e.slug === previewSlug)?.name} — Preview
            </DialogTitle>
            <DialogDescription>
              Preview with sample data. Actual emails use real member and class information.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 overflow-auto" style={{ maxHeight: 'calc(85vh - 100px)' }}>
            {previewLoading ? (
              <div className="h-64 flex items-center justify-center text-muted text-sm">Loading preview...</div>
            ) : (
              <iframe
                srcDoc={previewHtml}
                className="w-full border border-card-border rounded-lg"
                style={{ height: '600px', background: '#0a0a0a' }}
                title="Email preview"
                sandbox=""
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Edit Email Dialog ──────────────────────────────────────────────────────

function EditEmailDialog({ slug, event, customSubject, customBody, saving, onSave, onClose }) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  useEffect(() => {
    if (slug) {
      setSubject(customSubject)
      setBody(customBody)
    }
  }, [slug, customSubject, customBody])

  if (!event) return null

  return (
    <Dialog open={!!slug} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Edit — {event.name}</DialogTitle>
          <DialogDescription>
            Customise the subject line and message body. Leave blank to use the default.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-subject">Subject Line</Label>
            <Input
              id="edit-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={event.defaultSubject}
            />
            <p className="text-xs text-muted">Leave blank to use default: {event.defaultSubject}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-body">Message Body</Label>
            <textarea
              id="edit-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className="w-full rounded-lg bg-background/50 border border-card-border/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/50 transition-colors focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/30 resize-y"
              placeholder="Leave blank to use the default message..."
            />
            <p className="text-xs text-muted">
              This replaces the greeting and main message. Detail tables (class info, dates) are preserved automatically.
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            {(subject || body) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => { setSubject(''); setBody('') }}
              >
                Reset to Default
              </Button>
            )}
            <Button
              onClick={() => onSave(slug, subject, body)}
              disabled={saving === slug}
            >
              {saving === slug ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Compose Tab ─────────────────────────────────────────────────────────────

function ComposeTab() {
  const [members, setMembers] = useState([])
  const [selectedEmail, setSelectedEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingMembers, setLoadingMembers] = useState(true)

  useEffect(() => {
    async function fetchMembers() {
      try {
        const res = await fetch('/api/admin/members')
        if (res.ok) {
          const data = await res.json()
          setMembers(data.members || [])
        }
      } catch (err) {
        console.error('Failed to load members:', err)
      } finally {
        setLoadingMembers(false)
      }
    }
    fetchMembers()
  }, [])

  async function handleSend(e) {
    e.preventDefault()
    if (!selectedEmail || !subject.trim() || !body.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all fields' })
      return
    }

    setSending(true)
    setMessage(null)

    try {
      const res = await fetch('/api/admin/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: selectedEmail, subject: subject.trim(), body: body.trim() }),
      })

      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: 'Email sent successfully!' })
        setSubject('')
        setBody('')
        setSelectedEmail('')
        setSearchQuery('')
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send email' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to send email. Please try again.' })
    } finally {
      setSending(false)
    }
  }

  const filteredMembers = searchQuery
    ? members.filter((m) =>
        (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.email || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : members

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Send Email</CardTitle>
        <CardDescription>Send a direct email to a member using the BOXX branded template</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSend} className="space-y-4">
          {/* Recipient */}
          <div className="space-y-1.5">
            <Label htmlFor="recipient">To</Label>
            {selectedEmail ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 rounded-lg bg-background/50 border border-card-border text-sm text-foreground">
                  {selectedEmail}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setSelectedEmail(''); setSearchQuery('') }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  id="recipient"
                  placeholder="Search members by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {loadingMembers ? (
                  <div className="text-xs text-muted py-2">Loading members...</div>
                ) : searchQuery && (
                  <div className="max-h-48 overflow-y-auto border border-card-border rounded-lg">
                    {filteredMembers.length === 0 ? (
                      <p className="text-xs text-muted p-3">No members found</p>
                    ) : (
                      filteredMembers.slice(0, 10).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => { setSelectedEmail(m.email); setSearchQuery('') }}
                          className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors border-b border-card-border/50 last:border-0"
                        >
                          <p className="text-sm text-foreground">{m.name || 'Unnamed'}</p>
                          <p className="text-xs text-muted">{m.email}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Email subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="body">Message</Label>
            <textarea
              id="body"
              placeholder="Write your message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
              rows={8}
              className="w-full rounded-lg bg-background/50 border border-card-border/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/50 transition-colors focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/30 resize-y"
            />
            <p className="text-xs text-muted text-right">{body.length}/5000</p>
          </div>

          {/* Feedback */}
          {message && (
            <p className={cn('text-sm', message.type === 'success' ? 'text-green-400' : 'text-red-400')}>
              {message.text}
            </p>
          )}

          <Button type="submit" disabled={sending || !selectedEmail || !subject.trim() || !body.trim()}>
            {sending ? 'Sending...' : 'Send Email'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
