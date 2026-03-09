'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import Link from 'next/link'

function toDateStr(d) {
  return d.toLocaleDateString('en-CA') // YYYY-MM-DD
}

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedClass, setExpandedClass] = useState(null)
  const [dayOffset, setDayOffset] = useState(0)
  const [dayClasses, setDayClasses] = useState(null) // null = use data.todayClasses, array = fetched
  const [dayLoading, setDayLoading] = useState(false)

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

  // Fetch classes for non-today days
  useEffect(() => {
    if (dayOffset === 0) {
      setDayClasses(null) // use initial dashboard data
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
  const recentSignups = data?.recentSignups || []
  const lowCreditMembers = data?.lowCreditMembers || []

  const statCards = [
    {
      title: 'Total Members',
      value: stats.totalMembers,
      icon: '👥',
      href: '/admin/members',
    },
    {
      title: 'Active Credits',
      value: stats.activeCredits,
      icon: '🎫',
      sub: `${stats.activeCreditsRecords} active pack${stats.activeCreditsRecords !== 1 ? 's' : ''}`,
    },
    {
      title: "Today's Bookings",
      value: stats.todayBookings,
      icon: '📋',
      sub: `${stats.totalBookings} all time`,
      href: '/admin/bookings',
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
                    <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
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
        {/* Day Classes — expandable with attendance marking */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-base">Classes</CardTitle>
              <Link href="/admin/schedule" className="text-xs text-accent hover:text-accent-dim transition-colors">
                View Schedule →
              </Link>
            </div>
            {/* Day navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setDayOffset((o) => o - 1); setExpandedClass(null) }}
                className="text-sm text-muted hover:text-foreground transition-colors px-2 py-1 border border-card-border rounded"
              >
                ←
              </button>
              <div className="text-center flex items-center gap-2">
                <p className={cn('text-sm font-medium', isToday ? 'text-accent' : 'text-foreground')}>{dayLabel}</p>
                {!isToday && (
                  <button
                    onClick={() => { setDayOffset(0); setExpandedClass(null) }}
                    className="text-[10px] text-accent hover:text-accent-dim transition-colors px-2 py-0.5 border border-accent/30 rounded"
                  >
                    Today
                  </button>
                )}
              </div>
              <button
                onClick={() => { setDayOffset((o) => o + 1); setExpandedClass(null) }}
                className="text-sm text-muted hover:text-foreground transition-colors px-2 py-1 border border-card-border rounded"
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
                      {/* Clickable header */}
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

                      {/* Expanded content */}
                      {isExpanded && !isCancelled && (
                        <div className="px-3 pb-3 border-t border-card-border bg-white/[0.01]">
                          {cls.notes && (
                            <p className="text-xs text-muted mt-2 italic">{cls.notes}</p>
                          )}

                          {/* Attendees */}
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

                          {/* Waitlist */}
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

                          {/* Quick link */}
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
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-accent text-xs font-medium">
                            {(user.name || user.email)?.[0]?.toUpperCase() || '?'}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{user.name || 'No name'}</p>
                        <p className="text-xs text-muted truncate">{user.email}</p>
                      </div>

                      {/* Date */}
                      <span className="text-xs text-muted shrink-0">{joinDate}</span>
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

        {/* Quick Links */}
        <Card className={cn(lowCreditMembers.length > 0 ? '' : 'lg:col-span-2')}>
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
                { label: 'View Bookings', href: '/admin/bookings', icon: '📋' },
                { label: 'Manage Instructors', href: '/admin/instructors', icon: '🥊' },
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
