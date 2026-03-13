'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { CalendarDays, XCircle, UserPlus, Wrench, ClipboardList } from 'lucide-react'

const eventTypeConfig = {
  booking: { icon: CalendarDays, label: 'Booking', color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20' },
  cancellation: { icon: XCircle, label: 'Cancellation', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20' },
  signup: { icon: UserPlus, label: 'Signup', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
  admin: { icon: Wrench, label: 'Admin', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
}

function formatTime(ts) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok',
  })
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok',
  })
}

function groupByDate(events) {
  const groups = {}
  for (const event of events) {
    const dateKey = new Date(event.timestamp).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Bangkok',
    })
    if (!groups[dateKey]) groups[dateKey] = []
    groups[dateKey].push(event)
  }
  return groups
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [expandedId, setExpandedId] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const [toast, setToast] = useState(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true)
      setFetchError(null)
      try {
        const params = new URLSearchParams({ page: page.toString(), limit: '30' })
        if (typeFilter !== 'all') params.set('type', typeFilter)
        if (dateFrom) params.set('dateFrom', dateFrom)
        if (dateTo) params.set('dateTo', dateTo)
        if (search) params.set('search', search)
        if (sortBy) params.set('sort', sortBy)

        const res = await fetch(`/api/admin/events?${params}`)
        if (res.ok) {
          const data = await res.json()
          setEvents(data.events || [])
          setTotal(data.total || 0)
        } else {
          setFetchError('Failed to load activity. Please try again.')
        }
      } catch (err) {
        console.error('Failed to fetch events:', err)
        setFetchError('Unable to connect. Check your internet and try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchEvents()
  }, [page, typeFilter, dateFrom, dateTo, search, sortBy, retryKey])

  function handleSearch(e) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  async function handleExportCSV() {
    setExporting(true)
    try {
      const params = new URLSearchParams({ limit: '1000' })
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (search) params.set('search', search)
      if (sortBy) params.set('sort', sortBy)

      const res = await fetch(`/api/admin/events?${params}`)
      if (!res.ok) {
        setToast({ type: 'error', message: 'Export failed. Please try again.' })
        return
      }

      const data = await res.json()
      const rows = [['Date', 'Type', 'Event', 'Detail', 'Member', 'Email']]
      for (const evt of (data.events || [])) {
        rows.push([
          new Date(evt.timestamp).toISOString(),
          evt.type,
          evt.label,
          evt.detail || '',
          evt.user?.name || 'System',
          evt.user?.email || '',
        ])
      }

      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `activity-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setToast({ type: 'success', message: `Exported ${data.events?.length || 0} events` })
    } catch (err) {
      console.error('Export failed:', err)
      setToast({ type: 'error', message: 'Export failed. Please try again.' })
    } finally {
      setExporting(false)
    }
  }

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const totalPages = Math.ceil(total / 30)
  const grouped = groupByDate(events)
  const hasFilters = typeFilter !== 'all' || dateFrom || dateTo || search || sortBy !== 'newest'

  // Count by type for filter badges
  const typeCounts = {}
  for (const e of events) {
    typeCounts[e.type] = (typeCounts[e.type] || 0) + 1
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Activity</h1>
          <p className="text-sm text-muted mt-0.5">{total} events</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={exporting}>
          {exporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3 mb-6">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="Search by name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 sm:max-w-sm"
          />
          <Button type="submit" variant="outline" className="shrink-0">Search</Button>
          {search && (
            <Button variant="outline" className="shrink-0" onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }}>Clear</Button>
          )}
        </form>

        {/* Type filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all', label: 'All' },
            ...Object.entries(eventTypeConfig).map(([id, cfg]) => ({ id, label: cfg.label, icon: cfg.icon })),
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => { setTypeFilter(f.id); setPage(1) }}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                typeFilter === f.id
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'bg-card border border-card-border text-muted hover:text-foreground hover:border-card-border/80'
              )}
            >
              {f.icon && <f.icon className="w-3 h-3 mr-1 inline" />}
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2 sm:gap-3">
          <div>
            <label className="text-xs text-muted block mb-1">From</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="w-auto"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">To</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="w-auto"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Sort</label>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(1) }}
              className="rounded-lg bg-background/50 border border-card-border/60 px-3.5 py-2 text-sm text-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/30"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
          {hasFilters && (
            <Button
              variant="outline"
              className="text-xs"
              onClick={() => { setTypeFilter('all'); setDateFrom(''); setDateTo(''); setSearchInput(''); setSearch(''); setSortBy('newest'); setPage(1) }}
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={cn(
          'mb-4 px-4 py-3 rounded-lg text-sm font-medium border',
          toast.type === 'success' ? 'bg-green-400/10 text-green-400 border-green-400/20' : 'bg-red-400/10 text-red-400 border-red-400/20'
        )}>
          {toast.message}
        </div>
      )}

      {/* Fetch error */}
      {fetchError && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-400 font-medium">{fetchError}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setRetryKey(k => k + 1)}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {!fetchError && loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-card border border-card-border rounded-lg animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-3xl mb-3 text-muted"><ClipboardList className="w-8 h-8 mx-auto" /></p>
            <p className="text-foreground font-medium">No events found</p>
            <p className="text-sm text-muted mt-1">Try adjusting your filters</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Grouped events by date */}
          <div className="space-y-6">
            {Object.entries(grouped).map(([dateKey, dateEvents]) => (
              <div key={dateKey}>
                {/* Date header */}
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-sm font-medium text-muted whitespace-nowrap">{dateKey}</h3>
                  <div className="flex-1 h-px bg-card-border" />
                  <span className="text-xs text-muted">{dateEvents.length} events</span>
                </div>

                {/* Event cards */}
                <div className="space-y-2">
                  {dateEvents.map((event) => {
                    const config = eventTypeConfig[event.type] || eventTypeConfig.admin
                    const isExpanded = expandedId === event.id
                    const time = new Date(event.timestamp).toLocaleTimeString('en-US', {
                      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok',
                    })

                    return (
                      <div
                        key={event.id}
                        className={cn(
                          'rounded-lg border transition-colors cursor-pointer',
                          config.bg,
                          config.border,
                          isExpanded && 'ring-1 ring-white/10'
                        )}
                        onClick={() => setExpandedId(isExpanded ? null : event.id)}
                      >
                        {/* Main row */}
                        <div className="flex items-start gap-3 p-3 sm:p-4">
                          {/* Type icon */}
                          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', config.bg)}>
                            <config.icon className={cn('w-4 h-4', config.color)} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                {event.type === 'admin' && event.detail ? (
                                  <>
                                    <p className="text-sm font-medium text-foreground">{event.detail}</p>
                                    <p className="text-xs text-muted mt-0.5">{event.label}</p>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-sm font-medium text-foreground">{event.label}</p>
                                    {event.detail && (
                                      <p className="text-xs text-muted mt-0.5">{event.detail}</p>
                                    )}
                                  </>
                                )}
                              </div>
                              <span className="text-xs text-muted whitespace-nowrap shrink-0">{time}</span>
                            </div>

                            {/* User info inline */}
                            {event.user && (
                              <div className="flex items-center gap-2 mt-2">
                                <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
                                  {event.user.avatar_url ? (
                                    <Image src={event.user.avatar_url} alt="" width={20} height={20} className="object-cover rounded-full" unoptimized />
                                  ) : (
                                    <span className="text-accent text-[8px] font-medium">
                                      {(event.user.name || event.user.email)?.[0]?.toUpperCase() || '?'}
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-muted truncate">
                                  {event.type === 'admin' ? 'by ' : ''}{event.user.name || 'Unknown'} &middot; {event.user.email}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0 border-t border-white/5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs">
                              <div className="p-2 rounded bg-background/30">
                                <span className="text-muted">Event Type</span>
                                <p className={cn('font-medium capitalize mt-0.5', config.color)}>{event.type}</p>
                              </div>
                              <div className="p-2 rounded bg-background/30">
                                <span className="text-muted">Timestamp</span>
                                <p className="text-foreground mt-0.5">{formatTime(event.timestamp)}</p>
                              </div>
                              {event.meta?.classTime && (
                                <div className="p-2 rounded bg-background/30">
                                  <span className="text-muted">Class Time</span>
                                  <p className="text-foreground mt-0.5">{formatTime(event.meta.classTime)}</p>
                                </div>
                              )}
                              {event.meta?.lateCancel && (
                                <div className="p-2 rounded bg-background/30">
                                  <span className="text-muted">Late Cancel</span>
                                  <p className="text-red-400 mt-0.5">Yes — no credit refund</p>
                                </div>
                              )}
                              {event.meta?.creditReturned !== undefined && (
                                <div className="p-2 rounded bg-background/30">
                                  <span className="text-muted">Credit</span>
                                  <p className={cn('mt-0.5', event.meta.creditReturned ? 'text-green-400' : 'text-red-400')}>
                                    {event.meta.creditReturned ? 'Refunded' : 'Not refunded'}
                                  </p>
                                </div>
                              )}
                              {event.user && (
                                <div className="p-2 rounded bg-background/30 sm:col-span-2">
                                  <span className="text-muted">{event.type === 'admin' ? 'Action by' : 'Member'}</span>
                                  <p className="text-foreground mt-0.5">{event.user.name || 'Unknown'} ({event.user.email})</p>
                                </div>
                              )}
                              {/* Admin event meta details */}
                              {event.type === 'admin' && event.meta && (
                                <>
                                  {event.meta.memberName && (
                                    <div className="p-2 rounded bg-background/30">
                                      <span className="text-muted">Member</span>
                                      <p className="text-foreground mt-0.5">{event.meta.memberName}{event.meta.memberEmail ? ` (${event.meta.memberEmail})` : ''}</p>
                                    </div>
                                  )}
                                  {event.meta.className && (
                                    <div className="p-2 rounded bg-background/30">
                                      <span className="text-muted">Class</span>
                                      <p className="text-foreground mt-0.5">{event.meta.className}{event.meta.classDate ? ` — ${formatTime(event.meta.classDate)}` : ''}</p>
                                    </div>
                                  )}
                                  {event.meta.credits && (
                                    <div className="p-2 rounded bg-background/30">
                                      <span className="text-muted">Credits</span>
                                      <p className="text-foreground mt-0.5">{event.meta.credits} ({event.meta.packName || 'pack'})</p>
                                    </div>
                                  )}
                                  {event.meta.creditsRefunded > 0 && (
                                    <div className="p-2 rounded bg-background/30">
                                      <span className="text-muted">Credits Refunded</span>
                                      <p className="text-green-400 mt-0.5">{event.meta.creditsRefunded}</p>
                                    </div>
                                  )}
                                  {event.meta.classesCancelled > 0 && (
                                    <div className="p-2 rounded bg-background/30">
                                      <span className="text-muted">Classes Cancelled</span>
                                      <p className="text-red-400 mt-0.5">{event.meta.classesCancelled}</p>
                                    </div>
                                  )}
                                  {event.meta.to && (
                                    <div className="p-2 rounded bg-background/30 sm:col-span-2">
                                      <span className="text-muted">Sent To</span>
                                      <p className="text-foreground mt-0.5">{event.meta.to}{event.meta.subject ? ` — "${event.meta.subject}"` : ''}</p>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="text-xs"
              >
                Previous
              </Button>
              <span className="text-sm text-muted">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="text-xs"
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
