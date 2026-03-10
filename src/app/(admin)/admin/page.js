'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import Link from 'next/link'

function toDateStr(d) {
  return d.toLocaleDateString('en-CA') // YYYY-MM-DD
}

function TrendIndicator({ current, previous, label }) {
  if (previous === 0 && current === 0) return null
  const diff = current - previous
  const pct = previous > 0 ? Math.round((diff / previous) * 100) : current > 0 ? 100 : 0
  const isUp = diff > 0
  const isFlat = diff === 0

  return (
    <span className={cn(
      'text-[10px] font-medium',
      isFlat ? 'text-muted' : isUp ? 'text-green-400' : 'text-red-400'
    )}>
      {isFlat ? '—' : isUp ? `+${pct}%` : `${pct}%`}
      {label && <span className="text-muted ml-0.5">vs last wk</span>}
    </span>
  )
}

export default function AdminDashboard() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedClass, setExpandedClass] = useState(null)
  const [dayOffset, setDayOffset] = useState(0)
  const [dayClasses, setDayClasses] = useState(null)
  const [dayLoading, setDayLoading] = useState(false)
  const [engagementTab, setEngagementTab] = useState('at-risk')
  const [sendingEmail, setSendingEmail] = useState(null)

  const selectedDate = new Date()
  selectedDate.setDate(selectedDate.getDate() + dayOffset)
  const isToday = dayOffset === 0

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/admin/dashboard')
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch (err) {
        console.error('Failed to fetch dashboard:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  useEffect(() => {
    if (dayOffset === 0) {
      setDayClasses(null)
      return
    }
    async function fetchDay() {
      setDayLoading(true)
      try {
        const res = await fetch(`/api/admin/dashboard?date=${toDateStr(selectedDate)}`)
        if (res.ok) {
          const json = await res.json()
          setDayClasses(json.todayClasses || [])
        }
      } catch (err) {
        console.error('Failed to fetch day classes:', err)
      } finally {
        setDayLoading(false)
      }
    }
    fetchDay()
  }, [dayOffset]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeClasses = dayClasses ?? data?.todayClasses ?? []

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-6">Dashboard</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-card border border-card-border rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-64 bg-card border border-card-border rounded-lg animate-pulse" />
          <div className="h-64 bg-card border border-card-border rounded-lg animate-pulse" />
        </div>
      </div>
    )
  }

  const stats = data?.stats || {}
  const trends = data?.trends || {}
  const recentSignups = data?.recentSignups || []
  const recentCancellations = data?.recentCancellations || []
  const attentionClasses = data?.attentionClasses || []
  const lowCreditMembers = data?.lowCreditMembers || []
  const topMembers = data?.engagement?.topMembers || []
  const atRiskMembers = data?.engagement?.atRiskMembers || []

  async function sendReminderEmail(member) {
    setSendingEmail(member.id)
    try {
      const subject = `We miss you at BOXX!`
      const body = `Hi ${member.name || 'there'},\n\nWe noticed it's been a while since your last session at BOXX${member.credits_remaining ? ` and you still have ${member.credits_remaining} credit${member.credits_remaining !== 1 ? 's' : ''} remaining` : ''}.\n\nWe'd love to see you back — come check out our upcoming classes and book your next session!\n\nSee you soon,\nThe BOXX Team`
      const res = await fetch('/api/admin/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: member.email, subject, body }),
      })
      if (!res.ok) throw new Error('Failed to send')
      alert(`Reminder sent to ${member.name || member.email}`)
    } catch {
      alert('Failed to send email. Please try again.')
    } finally {
      setSendingEmail(null)
    }
  }

  const statCards = [
    ...(isAdmin ? [{
      title: 'Revenue (Month)',
      value: `${(stats.revenueThisMonth || 0).toLocaleString()}`,
      prefix: '฿',
      icon: '💰',
    }] : []),
    {
      title: 'Total Members',
      value: stats.totalMembers,
      icon: '👥',
      href: '/admin/members',
      trend: trends.signups,
    },
    {
      title: 'Bookings (7d)',
      value: trends.bookings?.thisWeek || stats.todayBookings,
      icon: '📋',
      href: '/admin/bookings',
      trend: trends.bookings,
    },
    {
      title: 'Classes Today',
      value: activeClasses.length,
      icon: '📅',
      sub: `${activeClasses.filter((c) => c.status !== 'cancelled').length} active`,
    },
  ]

  const dayLabel = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' })

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((stat) => {
          const Inner = (
            <Card key={stat.title} className={cn(stat.href && 'hover:border-accent/30 transition-colors cursor-pointer')}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted font-medium uppercase tracking-wide">{stat.title}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {stat.prefix && <span className="text-lg text-muted font-normal">{stat.prefix}</span>}
                      {stat.value}
                    </p>
                    {stat.trend && (
                      <div className="mt-1">
                        <TrendIndicator current={stat.trend.thisWeek} previous={stat.trend.lastWeek} label />
                      </div>
                    )}
                    {stat.sub && <p className="text-xs text-muted mt-1">{stat.sub}</p>}
                  </div>
                  <span className="text-2xl">{stat.icon}</span>
                </div>
              </CardContent>
            </Card>
          )

          if (stat.href) {
            return <Link key={stat.title} href={stat.href}>{Inner}</Link>
          }
          return <div key={stat.title}>{Inner}</div>
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Day Classes */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-base">Classes</CardTitle>
              <Link href="/admin/schedule" className="text-xs text-accent hover:text-accent-dim transition-colors">
                View Schedule →
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setDayOffset((o) => o - 1); setExpandedClass(null) }}
                className="text-sm text-muted hover:text-foreground transition-colors px-3 py-2 min-w-[44px] min-h-[44px] flex items-center justify-center border border-card-border rounded"
              >
                ←
              </button>
              <div className="text-center flex items-center gap-2">
                <p className={cn('text-sm font-medium', isToday ? 'text-accent' : 'text-foreground')}>{dayLabel}</p>
                {!isToday && (
                  <button
                    onClick={() => { setDayOffset(0); setExpandedClass(null) }}
                    className="text-[10px] text-accent hover:text-accent-dim transition-colors px-2 py-1 min-h-[32px] border border-accent/30 rounded"
                  >
                    Today
                  </button>
                )}
              </div>
              <button
                onClick={() => { setDayOffset((o) => o + 1); setExpandedClass(null) }}
                className="text-sm text-muted hover:text-foreground transition-colors px-3 py-2 min-w-[44px] min-h-[44px] flex items-center justify-center border border-card-border rounded"
              >
                →
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {dayLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <div key={i} className="h-16 bg-card border border-card-border rounded-lg animate-pulse" />)}
              </div>
            ) : activeClasses.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No classes scheduled{isToday ? ' today' : ''}.</p>
            ) : (
              <div className="space-y-2">
                {activeClasses.map((cls) => {
                  const time = new Date(cls.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok' })
                  const endTime = new Date(cls.ends_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok' })
                  const isCancelled = cls.status === 'cancelled'
                  const isFull = cls.booked >= cls.capacity
                  const fillPct = cls.capacity > 0 ? Math.min((cls.booked / cls.capacity) * 100, 100) : 0
                  const isExpanded = expandedClass === cls.id
                  const roster = cls.roster || []
                  const waitlist = cls.waitlist || []

                  return (
                    <div key={cls.id} className="rounded-lg border border-card-border overflow-hidden">
                      <button
                        onClick={() => setExpandedClass(isExpanded ? null : cls.id)}
                        className={cn(
                          'w-full text-left px-3 py-2.5 transition-colors border-l-[3px]',
                          isCancelled ? 'opacity-50 border-l-red-500/40' : 'hover:bg-white/[0.04]',
                          !isCancelled && 'border-l-transparent',
                          isExpanded && !isCancelled && 'bg-white/[0.02]'
                        )}
                        style={!isCancelled ? { borderLeftColor: cls.class_types?.color || '#c8a750' } : undefined}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn('text-sm font-semibold truncate', isCancelled ? 'line-through text-muted' : 'text-foreground')}>
                                {cls.class_types?.name || 'Class'}
                              </span>
                              {isCancelled && (
                                <span className="text-[10px] font-medium text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded shrink-0">Cancelled</span>
                              )}
                            </div>
                            <p className="text-xs text-muted mt-0.5">{time} – {endTime} · {cls.instructors?.name || 'TBA'}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {!isCancelled && (
                              <span className={cn(
                                'text-sm font-semibold',
                                isFull ? 'text-red-400' : fillPct >= 75 ? 'text-amber-400' : 'text-green-400'
                              )}>
                                {cls.booked}/{cls.capacity}
                              </span>
                            )}
                            <svg className={cn('w-4 h-4 text-muted transition-transform', isExpanded && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                        {!isCancelled && (
                          <div className="mt-1.5">
                            <div className="h-1 bg-card-border rounded-full overflow-hidden">
                              <div
                                className={cn('h-full rounded-full', isFull ? 'bg-red-500' : fillPct >= 75 ? 'bg-amber-500' : 'bg-green-500')}
                                style={{ width: `${fillPct}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </button>

                      {isExpanded && !isCancelled && (
                        <div className="px-3 pb-3 border-t border-card-border bg-white/[0.01]">
                          {cls.notes && (
                            <p className="text-xs text-muted mt-2 italic">{cls.notes}</p>
                          )}
                          <div className="mt-3">
                            <p className="text-xs font-medium text-foreground mb-1.5">Attendees ({roster.length})</p>
                            {roster.length > 0 ? (
                              <div className="space-y-1">
                                {roster.map((m, i) => (
                                  <div key={m.id || i} className="flex items-center gap-2 py-1.5 px-2 rounded border border-card-border">
                                    <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center overflow-hidden shrink-0">
                                      {m.avatar_url ? (
                                        <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-accent text-[9px] font-bold">{(m.name || '?')[0]?.toUpperCase()}</span>
                                      )}
                                    </div>
                                    <span className="text-xs text-foreground truncate flex-1">{m.name || 'No name'}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[11px] text-muted">No bookings yet</p>
                            )}
                          </div>
                          {waitlist.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs font-medium text-foreground mb-1.5">Waitlist ({waitlist.length})</p>
                              <div className="space-y-1">
                                {waitlist.map((m, i) => (
                                  <div key={m.id || i} className="flex items-center gap-2 py-1">
                                    <span className="text-[9px] text-muted font-bold w-4 text-center shrink-0">#{m.position || i + 1}</span>
                                    <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center overflow-hidden shrink-0">
                                      {m.avatar_url ? (
                                        <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-accent text-[9px] font-bold">{(m.name || '?')[0]?.toUpperCase()}</span>
                                      )}
                                    </div>
                                    <span className="text-xs text-foreground truncate flex-1">{m.name || 'No name'}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <Link href="/admin/schedule" className="inline-block mt-3 text-[11px] text-accent hover:text-accent-dim transition-colors">
                            Edit in Schedule →
                          </Link>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Classes Needing Attention */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Needs Attention</CardTitle>
              <Link href="/admin/schedule" className="text-xs text-accent hover:text-accent-dim transition-colors">
                Schedule →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {attentionClasses.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">All upcoming classes look good.</p>
            ) : (
              <div className="space-y-2">
                {attentionClasses.map((cls) => {
                  const isFull = cls.booked >= cls.capacity
                  const isEmpty = cls.booked === 0
                  const isLow = cls.fill_pct <= 25 && !isEmpty
                  const date = new Date(cls.starts_at)
                  const dayStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' })
                  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok' })

                  return (
                    <div
                      key={cls.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg border border-card-border"
                      style={{ borderLeftWidth: 3, borderLeftColor: cls.color || '#c8a750' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{cls.class_name}</p>
                        <p className="text-xs text-muted">{dayStr} · {timeStr} · {cls.instructor}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn(
                          'text-xs font-semibold',
                          isFull ? 'text-red-400' : 'text-amber-400'
                        )}>
                          {cls.booked}/{cls.capacity}
                        </span>
                        {isFull && (
                          <span className="text-[10px] font-medium text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">FULL</span>
                        )}
                        {isEmpty && (
                          <span className="text-[10px] font-medium text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">EMPTY</span>
                        )}
                        {isLow && (
                          <span className="text-[10px] font-medium text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">LOW</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Signups */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Signups</CardTitle>
              <Link href="/admin/members" className="text-xs text-accent hover:text-accent-dim transition-colors">
                View All →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentSignups.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No signups in the last 7 days.</p>
            ) : (
              <div className="space-y-2">
                {recentSignups.map((user) => {
                  const joinDate = new Date(user.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'Asia/Bangkok',
                  })
                  return (
                    <div key={user.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-card-border">
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-accent text-xs font-medium">
                            {(user.name || user.email)?.[0]?.toUpperCase() || '?'}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{user.name || 'No name'}</p>
                        <p className="text-xs text-muted truncate">{user.email}</p>
                      </div>
                      <span className="text-xs text-muted shrink-0">{joinDate}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Cancellations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Cancellations</CardTitle>
              <Link href="/admin/bookings" className="text-xs text-accent hover:text-accent-dim transition-colors">
                Activity →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentCancellations.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No cancellations in the last 7 days.</p>
            ) : (
              <div className="space-y-2">
                {recentCancellations.map((booking) => {
                  const cancelDate = booking.cancelled_at
                    ? new Date(booking.cancelled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' })
                    : '—'
                  const className = booking.class_schedule?.class_types?.name || 'Class'
                  const memberName = booking.users?.name || booking.users?.email || 'Unknown'

                  return (
                    <div key={booking.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-card-border">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{memberName}</p>
                        <p className="text-xs text-muted truncate">{className} · {cancelDate}</p>
                      </div>
                      {booking.late_cancel && (
                        <span className="text-[10px] font-medium text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded shrink-0">Late</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Credit Alerts */}
        {lowCreditMembers.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Low Credit Alerts
                <span className="text-[10px] font-medium text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                  {lowCreditMembers.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {lowCreditMembers.map((uc) => {
                  const daysLeft = Math.ceil((new Date(uc.expires_at) - new Date()) / (1000 * 60 * 60 * 24))
                  const isExpiringSoon = daysLeft <= 5

                  return (
                    <div key={uc.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-card-border">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {uc.users?.name || uc.users?.email || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted truncate">
                          {uc.class_packs?.name} · {uc.credits_remaining} credit{uc.credits_remaining !== 1 ? 's' : ''} left
                        </p>
                      </div>
                      {isExpiringSoon && (
                        <span className="text-[10px] font-medium text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded shrink-0">
                          Expires in {daysLeft}d
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Member Engagement */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                Member Engagement
                {atRiskMembers.length > 0 && (
                  <span className="text-[10px] font-medium text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">
                    {atRiskMembers.length} at risk
                  </span>
                )}
              </CardTitle>
              <Link href="/admin/members" className="text-xs text-accent hover:text-accent-dim transition-colors">
                All Members →
              </Link>
            </div>
            <div className="flex gap-1 mt-2">
              {[
                { key: 'at-risk', label: 'At Risk' },
                { key: 'top', label: 'Top Members' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setEngagementTab(tab.key)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors min-h-[32px]',
                    engagementTab === tab.key
                      ? 'bg-accent/10 text-accent'
                      : 'text-muted hover:text-foreground'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {engagementTab === 'top' && (
              topMembers.length === 0 ? (
                <p className="text-sm text-muted py-4 text-center">No booking activity in the last 30 days.</p>
              ) : (
                <div className="space-y-2">
                  {topMembers.map((member, i) => (
                    <div key={member.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-card-border">
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                        i === 0 ? 'bg-amber-400/20 text-amber-400' : i === 1 ? 'bg-gray-300/20 text-gray-300' : i === 2 ? 'bg-orange-400/20 text-orange-400' : 'bg-card-border text-muted'
                      )}>
                        {i + 1}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-accent text-xs font-medium">
                            {(member.name || member.email)?.[0]?.toUpperCase() || '?'}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{member.name || 'No name'}</p>
                        <p className="text-xs text-muted truncate">{member.email}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-accent">{member.bookings_30d}</p>
                        <p className="text-[10px] text-muted">classes</p>
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-muted text-center pt-1">Last 30 days</p>
                </div>
              )
            )}

            {engagementTab === 'at-risk' && (
              atRiskMembers.length === 0 ? (
                <p className="text-sm text-muted py-4 text-center">All members with credits are active. Great!</p>
              ) : (
                <div className="space-y-2">
                  {atRiskMembers.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-card-border">
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-accent text-xs font-medium">
                            {(member.name || member.email)?.[0]?.toUpperCase() || '?'}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{member.name || 'No name'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {member.never_booked ? (
                            <span className="text-[10px] font-medium text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">Never booked</span>
                          ) : (
                            <span className="text-[10px] font-medium text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">
                              {member.days_inactive}d inactive
                            </span>
                          )}
                          <span className="text-[10px] text-muted">
                            {member.credits_remaining} credit{member.credits_remaining !== 1 ? 's' : ''} left
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => sendReminderEmail(member)}
                        disabled={sendingEmail === member.id}
                        className={cn(
                          'shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all min-h-[32px]',
                          sendingEmail === member.id
                            ? 'bg-muted/10 text-muted cursor-not-allowed'
                            : 'bg-accent/10 text-accent hover:bg-accent/20'
                        )}
                      >
                        {sendingEmail === member.id ? (
                          <>
                            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeLinecap="round" /></svg>
                            Sending
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            Remind
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                  <p className="text-[11px] text-muted text-center pt-1">Members with active credits but no bookings in 14+ days</p>
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { label: 'Add a Class', href: '/admin/schedule', icon: '📅' },
                { label: 'Manage Members', href: '/admin/members', icon: '👥' },
                { label: 'Class Types', href: '/admin/class-types', icon: '🏷️' },
                { label: 'Edit Packs', href: '/admin/packs', icon: '📦' },
                { label: 'View Activity', href: '/admin/bookings', icon: '📋' },
                { label: 'Manage Instructors', href: '/admin/instructors', icon: '🥊' },
                { label: 'Send Email', href: '/admin/emails', icon: '📧' },
                { label: 'Studio Settings', href: '/admin/settings', icon: '⚙️' },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-card-border text-sm text-muted hover:text-foreground hover:border-accent/30 transition-colors"
                >
                  <span>{action.icon}</span>
                  <span>{action.label}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
