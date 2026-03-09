'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

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
  const todayClasses = data?.todayClasses || []
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
      title: 'Revenue (This Month)',
      value: `฿${(stats.revenueThisMonth || 0).toLocaleString()}`,
      icon: '💰',
    },
  ]

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
        {/* Today's Classes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Today&apos;s Classes</CardTitle>
              <Link href="/admin/schedule" className="text-xs text-accent hover:text-accent-dim transition-colors">
                View Schedule →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {todayClasses.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No classes scheduled today.</p>
            ) : (
              <div className="space-y-2">
                {todayClasses.map((cls) => {
                  const time = new Date(cls.starts_at).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'Asia/Bangkok',
                  })
                  const isCancelled = cls.status === 'cancelled'
                  const isFull = cls.booked >= cls.capacity
                  const fillPct = cls.capacity > 0 ? Math.min((cls.booked / cls.capacity) * 100, 100) : 0

                  return (
                    <div
                      key={cls.id}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg border border-card-border',
                        isCancelled && 'opacity-50'
                      )}
                    >
                      {/* Color dot */}
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: cls.class_types?.color || '#c8a750' }}
                      />

                      {/* Class info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={cn('text-sm font-medium text-foreground truncate', isCancelled && 'line-through')}>
                            {cls.class_types?.name || 'Class'}
                          </p>
                          {isCancelled && (
                            <span className="text-[10px] font-medium text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded shrink-0">
                              Cancelled
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted">
                          {time} · {cls.instructors?.name || 'TBA'}
                        </p>
                      </div>

                      {/* Capacity indicator */}
                      {!isCancelled && (
                        <div className="text-right shrink-0">
                          <p className={cn(
                            'text-sm font-medium',
                            isFull ? 'text-red-400' : fillPct >= 75 ? 'text-amber-400' : 'text-green-400'
                          )}>
                            {cls.booked}/{cls.capacity}
                          </p>
                          <div className="w-12 h-1 bg-card-border rounded-full mt-1 overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                isFull ? 'bg-red-500' : fillPct >= 75 ? 'bg-amber-500' : 'bg-green-500'
                              )}
                              style={{ width: `${fillPct}%` }}
                            />
                          </div>
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
