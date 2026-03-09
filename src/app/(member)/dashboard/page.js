'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-40 bg-card border border-card-border rounded-lg animate-pulse" />
      <div className="h-64 bg-card border border-card-border rounded-lg animate-pulse" />
      <div className="h-96 bg-card border border-card-border rounded-lg animate-pulse" />
    </div>
  )
}

function DashboardContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const sharedClassId = searchParams.get('class')
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(tabParam === 'bookings' ? 'bookings' : 'classes')
  const [scheduleView, setScheduleView] = useState('calendar') // persists across tab switches
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  if (loading) return <DashboardSkeleton />
  if (error) return <p className="text-red-400">{error}</p>
  if (!data) return null

  return (
    <div className="space-y-6">
      <ProfileSection user={data.user} credits={data.credits} onUpdate={fetchDashboard} />

      {/* Tab switcher */}
      <div className="flex bg-card border border-card-border rounded p-0.5">
        <button
          onClick={() => setActiveTab('classes')}
          className={cn(
            'flex-1 px-4 py-2 rounded text-sm font-medium transition-colors',
            activeTab === 'classes' ? 'bg-accent/10 text-accent' : 'text-muted hover:text-foreground'
          )}
        >
          Book Classes
        </button>
        <button
          onClick={() => setActiveTab('bookings')}
          className={cn(
            'flex-1 px-4 py-2 rounded text-sm font-medium transition-colors',
            activeTab === 'bookings' ? 'bg-accent/10 text-accent' : 'text-muted hover:text-foreground'
          )}
        >
          My Bookings
          {data.upcomingBookings?.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold">
              {data.upcomingBookings.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'classes' && (
        <ScheduleSection credits={data.credits} onUpdate={fetchDashboard} sharedClassId={sharedClassId} view={scheduleView} onViewChange={setScheduleView} />
      )}
      {activeTab === 'bookings' && (
        <BookingsSection
          upcoming={data.upcomingBookings}
          past={data.pastBookings}
          onUpdate={fetchDashboard}
        />
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   PROFILE SECTION
   ───────────────────────────────────────────────────────── */
function ProfileSection({ user, credits, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    show_in_roster: user?.show_in_roster ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setEditing(false)
        onUpdate()
      }
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        onUpdate()
      } else {
        const data = await res.json()
        alert(data.error || 'Upload failed')
      }
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div
              className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              {user?.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.name || 'Avatar'}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl font-bold text-accent">
                  {(user?.name || 'U').charAt(0).toUpperCase()}
                </span>
              )}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-bold text-foreground truncate">{user?.name || 'Member'}</h2>
              <button
                onClick={() => setEditing(!editing)}
                className="text-muted hover:text-accent transition-colors shrink-0"
                title="Edit profile"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-muted">{user?.email}</p>
            {user?.bio && <p className="text-xs text-muted/70 mt-1">{user.bio}</p>}
          </div>

          {/* Buy Packs CTA */}
          <Button size="sm" asChild className="shrink-0">
            <Link href="/buy-classes">Buy Packs</Link>
          </Button>
        </div>

        {/* Active packs */}
        {credits.length > 0 ? (
          <div className="grid gap-3 mt-5 sm:grid-cols-2 lg:grid-cols-3">
            {credits.map((c) => {
              const daysLeft = Math.ceil((new Date(c.expires_at) - Date.now()) / (1000 * 60 * 60 * 24))
              const isUnlimited = c.credits_remaining === null
              const usedCredits = isUnlimited ? null : (c.credits_total - c.credits_remaining)
              const percentUsed = isUnlimited ? 0 : c.credits_total > 0 ? (usedCredits / c.credits_total) * 100 : 0
              const isLow = !isUnlimited && c.credits_remaining <= 1
              const isExpiringSoon = daysLeft <= 5

              return (
                <div
                  key={c.id}
                  className={cn(
                    'rounded-lg border p-4 space-y-3',
                    isExpiringSoon ? 'border-red-500/30 bg-red-500/5' : 'border-card-border bg-background'
                  )}
                >
                  {/* Pack name + badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{c.class_packs?.name}</p>
                      {c.class_packs?.is_membership && (
                        <Badge variant="default" className="text-[10px] mt-1">Subscription</Badge>
                      )}
                    </div>
                    {isExpiringSoon && (
                      <Badge variant="destructive" className="text-[10px] shrink-0">Expiring</Badge>
                    )}
                  </div>

                  {/* Credits display */}
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-accent">
                        {isUnlimited ? '∞' : c.credits_remaining}
                      </span>
                      {!isUnlimited && (
                        <span className="text-sm text-muted">/ {c.credits_total}</span>
                      )}
                      <span className="text-xs text-muted ml-0.5">
                        {isUnlimited ? 'unlimited' : `credit${c.credits_remaining !== 1 ? 's' : ''} left`}
                      </span>
                    </div>

                    {/* Progress bar (finite packs only) */}
                    {!isUnlimited && (
                      <div className="mt-2 h-1.5 rounded-full bg-card-border overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            isLow ? 'bg-red-500' : 'bg-accent'
                          )}
                          style={{ width: `${Math.max(100 - percentUsed, 0)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Expiry */}
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>
                      {daysLeft > 0
                        ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`
                        : 'Expires today'}
                    </span>
                    <span>
                      {new Date(c.expires_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'Asia/Bangkok',
                      })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="mt-5 p-4 rounded-lg border border-card-border bg-background text-center">
            <p className="text-sm text-muted">No active packs. Purchase a class pack below to start booking.</p>
          </div>
        )}

        {/* Edit form */}
        <AnimatePresence>
          {editing && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-card-border space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bio">Bio ({form.bio.length}/120)</Label>
                  <Input
                    id="bio"
                    value={form.bio}
                    maxLength={120}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    placeholder="A short bio shown on class rosters"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={form.show_in_roster}
                    onCheckedChange={(checked) => setForm({ ...form, show_in_roster: checked })}
                  />
                  <Label>Show me in class rosters</Label>
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleSave} disabled={saving} size="sm">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}

/* ─────────────────────────────────────────────────────────
   SHARED HELPERS — class images + colors
   ───────────────────────────────────────────────────────── */
const classImageMap = {
  beginner: '/images/studio/class-boxing.webp',
  intermediate: '/images/studio/class-action.webp',
  train: '/images/studio/class-train.webp',
  juniors: '/images/studio/class-juniors.webp',
}

function getClassImage(cls) {
  const icon = cls.class_types?.icon?.toLowerCase() || ''
  if (classImageMap[icon]) return classImageMap[icon]
  const name = (cls.class_types?.name || '').toLowerCase()
  if (name.includes('beginner')) return classImageMap.beginner
  if (name.includes('inter')) return classImageMap.intermediate
  if (name.includes('train')) return classImageMap.train
  if (name.includes('junior')) return classImageMap.juniors
  return classImageMap.beginner
}

function getClassColor(cls) {
  if (cls.class_types?.color) return cls.class_types.color
  const icon = cls.class_types?.icon?.toLowerCase() || ''
  const name = (cls.class_types?.name || '').toLowerCase()
  if (icon === 'beginner' || name.includes('beginner')) return '#8b5cf6'
  if (icon === 'intermediate' || name.includes('inter')) return '#e74c3c'
  if (icon === 'train' || name.includes('train')) return '#3498db'
  if (icon === 'juniors' || name.includes('junior')) return '#2ecc71'
  return '#c8a750'
}

/* ─────────────────────────────────────────────────────────
   SCHEDULE SECTION — calendar + list views, week navigation
   ───────────────────────────────────────────────────────── */
function getWeekStart(offset = 0) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offset * 7)
  return d
}

function ScheduleSection({ credits, onUpdate, sharedClassId, view, onViewChange }) {
  const router = useRouter()
  const setView = onViewChange
  const [weekOffset, setWeekOffset] = useState(0) // 0 = this week, 1 = next, etc.
  const [schedule, setSchedule] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)
  const [shared, setShared] = useState(false)
  const [sharedResolved, setSharedResolved] = useState(!sharedClassId)

  const maxWeeks = 4 // 1 month in advance

  const totalCredits = credits.reduce((sum, c) => {
    if (c.credits_remaining === null) return Infinity
    return sum + (c.credits_remaining || 0)
  }, 0)

  // Resolve shared class deep link — find the right week
  useEffect(() => {
    if (!sharedClassId) return
    async function resolveSharedClass() {
      try {
        const res = await fetch(`/api/schedule/lookup?id=${sharedClassId}`)
        if (!res.ok) { setSharedResolved(true); return }
        const data = await res.json()
        const classDate = new Date(data.starts_at)
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const diffDays = Math.floor((classDate - todayStart) / (1000 * 60 * 60 * 24))
        const targetWeek = Math.max(0, Math.min(maxWeeks, Math.floor(diffDays / 7)))
        setWeekOffset(targetWeek)
        setSharedResolved(true)
      } catch {
        setSharedResolved(true)
      }
    }
    resolveSharedClass()
  }, [sharedClassId])

  // Fetch schedule for current week
  useEffect(() => {
    if (!sharedResolved) return
    async function fetchSchedule() {
      setLoading(true)
      if (!sharedClassId) setExpandedId(null)
      setSelectedDay(null)
      try {
        const start = getWeekStart(weekOffset)
        const end = new Date(start)
        end.setDate(end.getDate() + 7)
        const res = await fetch(`/api/schedule?start=${start.toISOString()}&end=${end.toISOString()}`)
        if (res.ok) {
          const data = await res.json()
          setSchedule(data.schedule || [])
          // Auto-expand shared class if present
          if (sharedClassId) {
            const found = (data.schedule || []).find(c => c.id === sharedClassId)
            if (found) {
              setExpandedId(sharedClassId)
              // Clean up the URL param
              router.replace('/dashboard', { scroll: false })
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch schedule:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchSchedule()
  }, [weekOffset, sharedResolved])

  // Lock body scroll when mobile overlay is open
  useEffect(() => {
    if (expandedId && view === 'calendar') {
      const isMobile = window.matchMedia('(max-width: 767px)').matches
      if (isMobile) {
        const scrollY = window.scrollY
        document.body.style.position = 'fixed'
        document.body.style.top = `-${scrollY}px`
        document.body.style.left = '0'
        document.body.style.right = '0'
        document.body.style.overflow = 'hidden'
        return () => {
          document.body.style.position = ''
          document.body.style.top = ''
          document.body.style.left = ''
          document.body.style.right = ''
          document.body.style.overflow = ''
          // Restore scroll position instantly without smooth scrolling
          document.documentElement.style.scrollBehavior = 'auto'
          window.scrollTo(0, scrollY)
          // Restore smooth scrolling on next frame
          requestAnimationFrame(() => {
            document.documentElement.style.scrollBehavior = ''
          })
        }
      }
    }
  }, [expandedId, view])

  async function handleShare(classId) {
    const url = `${window.location.origin}/dashboard?class=${classId}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Check out this class at BOXX', url })
        return
      } catch { /* user cancelled share dialog */ }
    }
    await navigator.clipboard.writeText(url)
    setShared(classId)
    setTimeout(() => setShared(false), 2000)
  }

  // Group classes by day key
  const days = {}
  schedule.forEach((cls) => {
    const d = new Date(cls.starts_at)
    const day = d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Bangkok',
    })
    if (!days[day]) days[day] = []
    days[day].push(cls)
  })
  const dayKeys = Object.keys(days)

  // Build 7-day grid for calendar
  const calendarDays = []
  const weekStart = getWeekStart(weekOffset)
  const today = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    const key = d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Bangkok',
    })
    calendarDays.push({
      key,
      date: d,
      weekday: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Bangkok' }),
      dayNum: d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'Asia/Bangkok' }),
      classes: days[key] || [],
    })
  }

  // Week label
  const weekStartLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' })
  const weekEndDate = new Date(weekStart)
  weekEndDate.setDate(weekEndDate.getDate() + 6)
  const weekEndLabel = weekEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' })

  useEffect(() => {
    if (dayKeys.length > 0 && !selectedDay) {
      setSelectedDay(dayKeys[0])
    }
  }, [dayKeys.length, weekOffset])

  async function handleBook(classId) {
    setConfirming(classId)
    try {
      const res = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classScheduleId: classId }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Booking failed')
        return
      }
      // Re-fetch both schedule and dashboard data
      setWeekOffset((w) => { /* trigger re-fetch */ return w })
      onUpdate()
      setExpandedId(null)
      // Force schedule re-fetch
      const start = getWeekStart(weekOffset)
      const end = new Date(start)
      end.setDate(end.getDate() + 7)
      const refetch = await fetch(`/api/schedule?start=${start.toISOString()}&end=${end.toISOString()}`)
      if (refetch.ok) {
        const d = await refetch.json()
        setSchedule(d.schedule || [])
      }
    } catch (err) {
      alert('Something went wrong. Please try again.')
    } finally {
      setConfirming(null)
    }
  }

  async function handleCancelBooking(bookingId, startsAt) {
    const hoursUntil = (new Date(startsAt) - Date.now()) / (1000 * 60 * 60)
    const isLate = hoursUntil <= 24
    const message = isLate
      ? 'Less than 24 hours before class. Your credit will NOT be returned. Cancel anyway?'
      : 'Cancel this booking? Your credit will be returned.'
    if (!confirm(message)) return

    setCancelling(bookingId)
    try {
      const res = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Cancel failed')
        return
      }
      setExpandedId(null)
      onUpdate()
      // Re-fetch schedule
      const start = getWeekStart(weekOffset)
      const end = new Date(start)
      end.setDate(end.getDate() + 7)
      const refetch = await fetch(`/api/schedule?start=${start.toISOString()}&end=${end.toISOString()}`)
      if (refetch.ok) {
        const d = await refetch.json()
        setSchedule(d.schedule || [])
      }
    } catch (err) {
      alert('Something went wrong.')
    } finally {
      setCancelling(null)
    }
  }

  // Shared class card renderer (used by both views)
  function renderClassCard(cls, compact = false) {
    const isExpanded = expandedId === cls.id
    const startTime = new Date(cls.starts_at).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Bangkok',
    })
    const endTime = new Date(cls.ends_at).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Bangkok',
    })
    const classImage = getClassImage(cls)
    const classColor = getClassColor(cls)

    const isCancelled = cls.status === 'cancelled'

    if (compact) {
      // Calendar cell card
      return (
        <button
          key={cls.id}
          onClick={(e) => {
            e.stopPropagation()
            if (!isCancelled) setExpandedId(isExpanded ? null : cls.id)
          }}
          className={cn(
            'w-full text-left rounded overflow-hidden transition-colors border relative',
            isCancelled
              ? 'border-red-500/20 bg-red-500/5 opacity-50 cursor-default'
              : cls.is_booked
                ? 'border-green-600/30 bg-green-600/8'
                : cls.spots_left <= 0
                  ? 'border-red-500/10 bg-card'
                  : 'border-card-border bg-card hover:border-accent/30',
            isExpanded && !isCancelled && 'ring-1 ring-accent/40'
          )}
          style={{ borderLeftWidth: '3px', borderLeftColor: isCancelled ? '#ef4444' : classColor }}
        >
          <div className="px-2.5 py-2">
            <div className="flex items-center gap-1.5">
              <span className={cn('font-bold text-[13px] truncate', isCancelled ? 'text-muted line-through' : 'text-foreground')}>{cls.class_types?.name || 'Class'}</span>
              {isCancelled && <span className="text-red-400 text-[9px] font-semibold uppercase">Cancelled</span>}
              {!isCancelled && cls.is_booked && <span className="text-green-400 text-[11px] font-bold">✓</span>}
            </div>
            <div className="text-[12px] text-muted mt-0.5 font-medium">
              {startTime}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className={cn('text-[10px] font-medium', cls.spots_left <= 1 ? 'text-red-400' : 'text-foreground/60')}>
                {cls.booked_count}/{cls.capacity}
              </span>
              {cls.roster?.length > 0 && (
                <div className="flex -space-x-1.5">
                  {cls.roster.slice(0, 3).map((m, i) => (
                    <div key={m.id || i} className="w-4 h-4 rounded-full bg-accent/20 border border-card flex items-center justify-center overflow-hidden">
                      {m.avatar_url ? (
                        <Image src={m.avatar_url} alt="" width={16} height={16} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[6px] font-bold text-accent">{(m.name || '?').charAt(0)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </button>
      )
    }

    // Full list card — larger with blended image from right + color left border
    return (
      <Card
        key={cls.id}
        className={cn(
          'transition-colors overflow-hidden relative',
          isCancelled
            ? 'opacity-50 cursor-default'
            : 'cursor-pointer',
          !isCancelled && (isExpanded ? 'ring-1 ring-accent/30' : 'hover:border-accent/20')
        )}
        style={{ borderLeftWidth: '4px', borderLeftColor: isCancelled ? '#ef4444' : classColor }}
        onClick={() => !isCancelled && setExpandedId(isExpanded ? null : cls.id)}
      >
        {/* Blended image from right side */}
        <div className="absolute top-0 right-0 bottom-0 w-1/3 sm:w-2/5">
          <Image
            src={classImage}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 33vw, 40vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-card via-card/70 to-card/40" />
        </div>

        <CardContent className="p-5 relative">
          {/* Collapsed */}
          <div className="flex items-center gap-4">
            {/* Left group: day + time + info + status + roster */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="shrink-0 w-10 text-center">
                <div className="text-xs font-bold text-accent uppercase">{new Date(cls.starts_at).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Bangkok' })}</div>
                <div className="text-[10px] text-muted">{new Date(cls.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' })}</div>
              </div>
              <div className="shrink-0 w-14 text-center">
                <div className="text-sm font-bold text-foreground">{startTime}</div>
                <div className="text-[10px] text-muted">{cls.class_types?.duration_mins || 55}min</div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={cn('font-bold tracking-tight truncate', isCancelled ? 'text-muted line-through' : 'text-foreground')}>
                    {cls.class_types?.name || 'Class'}
                  </h3>
                  {isCancelled ? (
                    <Badge variant="destructive" className="text-[10px] shrink-0">Cancelled</Badge>
                  ) : cls.is_booked ? (
                    <Badge variant="success" className="text-[10px] shrink-0">Booked</Badge>
                  ) : cls.waitlist_position ? (
                    <Badge variant="outline" className="text-[10px] shrink-0">Waitlist #{cls.waitlist_position}</Badge>
                  ) : cls.spots_left <= 0 ? (
                    <Badge variant="destructive" className="text-[10px] shrink-0">Full</Badge>
                  ) : (
                    <span className={cn('text-[10px] font-medium shrink-0', cls.spots_left <= 2 ? 'text-red-400' : 'text-foreground/50')}>
                      {cls.booked_count}/{cls.capacity}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted">{cls.instructors?.name || 'TBA'}</p>
                  {cls.roster?.length > 0 && (
                    <div className="hidden sm:flex -space-x-1.5">
                      {cls.roster.slice(0, 4).map((m, i) => (
                        <div key={m.id || i} className="w-5 h-5 rounded-full bg-accent/20 border border-card flex items-center justify-center overflow-hidden" title={m.name}>
                          {m.avatar_url ? (
                            <Image src={m.avatar_url} alt={m.name || ''} width={20} height={20} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[7px] font-bold text-accent">{(m.name || '?').charAt(0)}</span>
                          )}
                        </div>
                      ))}
                      {cls.roster.length > 4 && (
                        <div className="w-5 h-5 rounded-full bg-card-border border border-card flex items-center justify-center">
                          <span className="text-[7px] text-muted">+{cls.roster.length - 4}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: chevron only */}
            <svg className={cn('w-5 h-5 text-foreground/40 transition-transform shrink-0 z-10', isExpanded && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Expanded */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {renderExpandedContent(cls, startTime, endTime)}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    )
  }

  function renderExpandedContent(cls, startTime, endTime) {
    return (
      <div className="mt-4 pt-4 border-t border-card-border space-y-4">
        <div className="max-w-[50%] space-y-4">
          {cls.class_types?.description && (
            <p className="text-sm text-muted leading-relaxed">{cls.class_types.description}</p>
          )}

          {cls.roster?.length > 0 && (
            <div>
              <p className="text-xs text-muted mb-2">Who&apos;s coming ({cls.booked_count}/{cls.capacity})</p>
              <div className="flex flex-wrap gap-2">
                {cls.roster.map((m, i) => (
                  <div key={m.id || i} className="flex items-center gap-1.5 bg-background rounded-full px-2 py-1">
                    <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden">
                      {m.avatar_url ? (
                        <Image src={m.avatar_url} alt={m.name || ''} width={20} height={20} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[8px] font-bold text-accent">{(m.name || '?').charAt(0)}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-foreground">{m.name?.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => handleShare(cls.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
              shared === cls.id
                ? 'bg-green-500/15 text-green-400 scale-105'
                : 'bg-accent/10 text-accent hover:bg-accent/20 hover:scale-105 active:scale-95'
            )}
            title="Share this class"
          >
            {shared === cls.id ? (
              <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Link copied!</>
            ) : (
              <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.63 8.37m5.96 6a14.926 14.926 0 01-5.84 2.58m0 0a6 6 0 01-7.38-5.84h4.8" /></svg>Share</>
            )}
          </button>
          {cls.is_booked ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted">
                {(new Date(cls.starts_at) - Date.now()) / 36e5 <= 24 ? 'Credit will not be returned' : 'Free cancellation'}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCancelBooking(cls.booking_id, cls.starts_at)}
                disabled={cancelling === cls.booking_id}
                className="text-red-400 border-red-400/30 hover:bg-red-400/10 hover:text-red-300"
              >
                {cancelling === cls.booking_id ? 'Cancelling...' : 'Cancel'}
              </Button>
            </div>
          ) : cls.spots_left <= 0 ? (
            <Button size="sm" variant="outline" disabled>Class Full</Button>
          ) : totalCredits <= 0 ? (
            <Button size="sm" variant="outline" asChild>
              <Link href="/buy-classes">Buy Packs</Link>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted">{cls.credits_cost} credit</span>
              <Button size="sm" onClick={() => handleBook(cls.id)} disabled={confirming === cls.id}>
                {confirming === cls.id ? 'Booking...' : 'Book This Class'}
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header: title + week nav + view toggle */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-foreground">Classes</h2>

        {/* Week navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
            disabled={weekOffset === 0}
            className={cn(
              'w-7 h-7 flex items-center justify-center rounded border border-card-border transition-colors',
              weekOffset === 0 ? 'opacity-30 cursor-not-allowed' : 'text-muted hover:text-foreground hover:border-accent/30'
            )}
            title="Previous week"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={() => setWeekOffset(0)}
            className={cn(
              'px-3 py-1 rounded text-xs font-medium transition-colors min-w-[120px] text-center',
              weekOffset === 0 ? 'bg-accent/10 text-accent' : 'bg-card border border-card-border text-foreground hover:border-accent/30'
            )}
          >
            {weekOffset === 0 ? 'This Week' : `${weekStartLabel} – ${weekEndLabel}`}
          </button>

          <button
            onClick={() => setWeekOffset(Math.min(maxWeeks, weekOffset + 1))}
            disabled={weekOffset >= maxWeeks}
            className={cn(
              'w-7 h-7 flex items-center justify-center rounded border border-card-border transition-colors',
              weekOffset >= maxWeeks ? 'opacity-30 cursor-not-allowed' : 'text-muted hover:text-foreground hover:border-accent/30'
            )}
            title="Next week"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* View toggle */}
        <div className="flex bg-card border border-card-border rounded p-0.5">
          <button
            onClick={() => { setExpandedId(null); setView('calendar') }}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium transition-colors',
              view === 'calendar' ? 'bg-accent/10 text-accent' : 'text-muted hover:text-foreground'
            )}
            title="Calendar view"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={() => { setExpandedId(null); setView('list') }}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium transition-colors',
              view === 'list' ? 'bg-accent/10 text-accent' : 'text-muted hover:text-foreground'
            )}
            title="List view"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-card border border-card-border rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && schedule.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted">No classes scheduled this week.</p>
            {weekOffset < maxWeeks && (
              <button
                onClick={() => setWeekOffset(weekOffset + 1)}
                className="text-xs text-accent hover:underline mt-2 inline-block"
              >
                Check next week →
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── CALENDAR VIEW ── */}
      {!loading && schedule.length > 0 && view === 'calendar' && (
        <div>
          <div className="overflow-x-auto -mx-1 px-1 pb-2 relative">
          {/* 7-column calendar grid — scrollable on mobile */}
          <div className="grid grid-cols-7 gap-1.5 md:gap-2 items-start" style={{ minWidth: '840px' }}>
            {calendarDays.map((day) => {
              const isToday = day.date.toDateString() === today.toDateString()
              return (
                <div key={day.key}>
                  {/* Day header */}
                  <div className={cn(
                    'text-center py-2 rounded-t border border-card-border',
                    isToday ? 'bg-accent/15 border-accent/30' : 'bg-card'
                  )}>
                    <div className={cn('text-[10px] uppercase tracking-wider', isToday ? 'text-accent/80' : 'text-foreground/50')}>{day.weekday}</div>
                    <div className={cn('text-base font-bold mt-0.5', isToday ? 'text-accent' : 'text-foreground')}>
                      {day.dayNum}
                    </div>
                  </div>
                  {/* Classes */}
                  <div className={cn(
                    'border border-t-0 border-card-border rounded-b p-1.5 space-y-1.5',
                    isToday ? 'bg-accent/5 border-accent/20' : 'bg-background'
                  )}>
                    {day.classes.length > 0 ? (
                      day.classes.map((cls) => renderClassCard(cls, true))
                    ) : (
                      <div className="flex items-center justify-center py-4">
                        <span className="text-[10px] text-muted/40">No classes</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          </div>

          {/* Expanded detail panel — overlay on mobile, below calendar on desktop */}
          <AnimatePresence>
            {expandedId && (
              <>
                {/* Mobile overlay backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="md:hidden fixed inset-0 bg-background/60 backdrop-blur-[2px] z-40"
                  onClick={() => setExpandedId(null)}
                />
                <motion.div
                  initial={{ opacity: 0, y: '100%' }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                  drag={typeof window !== 'undefined' && window.innerWidth < 768 ? 'y' : false}
                  dragConstraints={{ top: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(_, info) => {
                    if (info.offset.y > 100 || info.velocity.y > 500) {
                      setExpandedId(null)
                    }
                  }}
                  className="md:relative md:z-auto fixed inset-x-0 bottom-0 z-50 md:static max-h-[85vh] md:max-h-none overflow-y-auto"
                >
                {(() => {
                  const cls = schedule.find((c) => c.id === expandedId)
                  if (!cls) return null
                  const startTime = new Date(cls.starts_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' })
                  const endTime = new Date(cls.ends_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' })
                  const classImage = getClassImage(cls)
                  const classColor = getClassColor(cls)
                  return (
                    <Card
                      className="md:mt-3 ring-1 ring-accent/30 overflow-hidden relative rounded-t-2xl md:rounded-lg"
                      style={{ borderLeftWidth: '4px', borderLeftColor: classColor }}
                    >
                      {/* Drag handle for mobile */}
                      <div className="md:hidden flex justify-center pt-3 pb-1">
                        <div className="w-10 h-1 rounded-full bg-foreground/20" />
                      </div>

                      {/* Blended image from right side */}
                      <div className="absolute top-0 right-0 bottom-0 w-1/3 sm:w-2/5">
                        <Image src={classImage} alt="" fill className="object-cover" sizes="(max-width: 640px) 33vw, 40vw" />
                        <div className="absolute inset-0 bg-gradient-to-r from-card via-card/70 to-card/40" />
                      </div>

                      <CardContent className="p-5 pb-10 md:pb-5 relative">
                        {/* Header row */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="shrink-0 w-10 text-center">
                              <div className="text-xs font-bold text-accent uppercase">{new Date(cls.starts_at).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Bangkok' })}</div>
                              <div className="text-[10px] text-muted">{new Date(cls.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' })}</div>
                            </div>
                            <div className="shrink-0 w-14 text-center">
                              <div className="text-sm font-bold text-foreground">{startTime}</div>
                              <div className="text-[10px] text-muted">{cls.class_types?.duration_mins || 55}min</div>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-foreground tracking-tight truncate">{cls.class_types?.name || 'Class'}</h3>
                                {cls.is_booked ? (
                                  <Badge variant="success" className="text-[10px] shrink-0">Booked</Badge>
                                ) : cls.waitlist_position ? (
                                  <Badge variant="outline" className="text-[10px] shrink-0">Waitlist #{cls.waitlist_position}</Badge>
                                ) : cls.spots_left <= 0 ? (
                                  <Badge variant="destructive" className="text-[10px] shrink-0">Full</Badge>
                                ) : (
                                  <span className={cn('text-[10px] font-medium shrink-0', cls.spots_left <= 2 ? 'text-red-400' : 'text-foreground/50')}>
                                    {cls.booked_count}/{cls.capacity}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted mt-0.5">{cls.instructors?.name || 'TBA'}</p>
                            </div>
                          </div>
                          <button onClick={() => setExpandedId(null)} className="text-muted hover:text-foreground transition-colors shrink-0 z-10">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        {/* Expanded details */}
                        {renderExpandedContent(cls, startTime, endTime)}
                      </CardContent>
                    </Card>
                  )
                })()}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {!loading && schedule.length > 0 && view === 'list' && (
        <>
          {/* Day pills */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {dayKeys.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                  selectedDay === day
                    ? 'bg-accent text-background'
                    : 'bg-card border border-card-border text-muted hover:text-foreground'
                )}
              >
                {day}
                <span className="ml-1 text-[10px] opacity-70">({days[day].length})</span>
              </button>
            ))}
          </div>

          {/* Class cards */}
          <div className="space-y-2">
            {selectedDay && days[selectedDay]?.map((cls) => renderClassCard(cls, false))}
          </div>
        </>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   BOOKINGS SECTION
   ───────────────────────────────────────────────────────── */
function BookingsSection({ upcoming, past, onUpdate }) {
  const [showPast, setShowPast] = useState(false)
  const [cancelling, setCancelling] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [shared, setShared] = useState(false)

  async function handleShare(classScheduleId) {
    const url = `${window.location.origin}/dashboard?class=${classScheduleId}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Check out this class at BOXX', url })
        return
      } catch { /* user cancelled */ }
    }
    await navigator.clipboard.writeText(url)
    setShared(classScheduleId)
    setTimeout(() => setShared(false), 2000)
  }

  async function handleCancel(bookingId, isLate) {
    const message = isLate
      ? 'Less than 24 hours before class. Your credit will NOT be returned. Cancel anyway?'
      : 'Cancel this booking? Your credit will be returned.'

    if (!confirm(message)) return

    setCancelling(bookingId)
    try {
      const res = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Cancel failed')
        return
      }
      setExpandedId(null)
      onUpdate()
    } catch (err) {
      alert('Something went wrong.')
    } finally {
      setCancelling(null)
    }
  }

  function renderBookingCard(b, { isUpcoming = false } = {}) {
    const cls = b.class_schedule
    if (!cls) return null

    const isExpanded = expandedId === b.id
    const startTime = new Date(cls.starts_at).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Bangkok',
    })
    const endTime = new Date(cls.ends_at).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Bangkok',
    })
    const dateStr = new Date(cls.starts_at).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Bangkok',
    })
    const classImage = getClassImage(cls)
    const classColor = getClassColor(cls)
    const hoursUntil = isUpcoming ? (new Date(cls.starts_at) - Date.now()) / (1000 * 60 * 60) : 0
    const isLate = hoursUntil <= 24

    const isClassCancelled = cls.status === 'cancelled'
    const statusColors = {
      attended: 'success',
      cancelled: 'destructive',
      no_show: 'destructive',
      confirmed: 'secondary',
    }

    return (
      <Card
        key={b.id}
        className={cn(
          'cursor-pointer transition-colors overflow-hidden relative',
          !isUpcoming && 'opacity-60',
          isExpanded ? 'ring-1 ring-accent/30' : 'hover:border-accent/20'
        )}
        style={{ borderLeftWidth: '4px', borderLeftColor: classColor }}
        onClick={() => setExpandedId(isExpanded ? null : b.id)}
      >
        {/* Blended image from right */}
        <div className="absolute top-0 right-0 bottom-0 w-1/3 sm:w-2/5">
          <Image src={classImage} alt="" fill className="object-cover" sizes="(max-width: 640px) 33vw, 40vw" />
          <div className="absolute inset-0 bg-gradient-to-r from-card via-card/70 to-card/40" />
        </div>

        <CardContent className="p-5 relative">
          {/* Collapsed row */}
          <div className="flex items-center gap-4">
            <div className="shrink-0 w-10 text-center">
              <div className="text-xs font-bold text-accent uppercase">{new Date(cls.starts_at).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Bangkok' })}</div>
              <div className="text-[10px] text-muted">{new Date(cls.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' })}</div>
            </div>
            <div className="shrink-0 w-14 text-center">
              <div className="text-sm font-bold text-foreground">{startTime}</div>
              <div className="text-[10px] text-muted">{cls.class_types?.duration_mins || 55}min</div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-foreground tracking-tight">
                {cls.class_types?.name || 'Class'}
              </h3>
              <p className="text-xs text-muted mt-0.5">{cls.instructors?.name || 'TBA'}</p>
              {!isUpcoming && (
                <div className="mt-1">
                  {isClassCancelled ? (
                    <Badge variant="destructive" className="text-[10px]">Class Cancelled</Badge>
                  ) : (
                    <Badge variant={statusColors[b.status] || 'secondary'} className="text-[10px] capitalize">
                      {b.status}{b.late_cancel ? ' (late)' : ''}
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <svg className={cn('w-5 h-5 text-foreground/40 transition-transform shrink-0 z-10', isExpanded && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Expanded content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mt-4 pt-4 border-t border-card-border space-y-4">
                  {isClassCancelled && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded bg-red-500/10 border border-red-500/20">
                      <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      <span className="text-xs text-red-400">This class was cancelled by the studio{b.credit_returned ? ' — your credit has been returned' : ''}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-4">
                    {cls.instructors?.photo_url && (
                      <Image src={cls.instructors.photo_url} alt={cls.instructors.name} width={48} height={48} className="w-12 h-12 rounded-full object-cover" />
                    )}
                    <div>
                      <p className="text-sm text-foreground font-medium">{startTime} – {endTime}</p>
                      <p className="text-xs text-muted mt-0.5">with {cls.instructors?.name || 'TBA'}</p>
                      {cls.class_types?.description && (
                        <p className="text-xs text-muted/70 mt-2">{cls.class_types.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => handleShare(cls.id)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                        shared === cls.id
                          ? 'bg-green-500/15 text-green-400 scale-105'
                          : 'bg-accent/10 text-accent hover:bg-accent/20 hover:scale-105 active:scale-95'
                      )}
                      title="Share this class"
                    >
                      {shared === cls.id ? (
                        <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Link copied!</>
                      ) : (
                        <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.63 8.37m5.96 6a14.926 14.926 0 01-5.84 2.58m0 0a6 6 0 01-7.38-5.84h4.8" /></svg>Share</>
                      )}
                    </button>
                    {isUpcoming && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted">
                          {isLate ? 'Credit will not be returned' : 'Free cancellation'}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCancel(b.id, isLate)}
                          disabled={cancelling === b.id}
                          className="text-red-400 border-red-400/30 hover:bg-red-400/10 hover:text-red-300"
                        >
                          {cancelling === b.id ? 'Cancelling...' : 'Cancel'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-foreground mb-4">My Bookings</h2>

      {upcoming.length === 0 && past.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted">No bookings yet. Book a class above to get started!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {upcoming.map((b) => renderBookingCard(b, { isUpcoming: true }))}

          {past.length > 0 && (
            <>
              <button
                onClick={() => setShowPast(!showPast)}
                className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors py-2"
              >
                <svg
                  className={cn('w-3 h-3 transition-transform', showPast && 'rotate-180')}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                Past bookings ({past.length})
              </button>

              <AnimatePresence>
                {showPast && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-2"
                  >
                    {past.map((b) => renderBookingCard(b, { isUpcoming: false }))}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      )}
    </div>
  )
}
