'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const eventTypeConfig = {
  booking: { icon: '📅', color: 'text-green-400 bg-green-400/10' },
  cancellation: { icon: '❌', color: 'text-red-400 bg-red-400/10' },
  signup: { icon: '👤', color: 'text-blue-400 bg-blue-400/10' },
  admin: { icon: '🔧', color: 'text-amber-400 bg-amber-400/10' },
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

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true)
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
        }
      } catch (err) {
        console.error('Failed to fetch events:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchEvents()
  }, [page, typeFilter, dateFrom, dateTo, search, sortBy])

  function handleSearch(e) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const totalPages = Math.ceil(total / 30)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Activity</h1>
        <span className="text-sm text-muted">{total} events</span>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3 mb-6">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="Search by member name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="max-w-sm"
          />
          <Button type="submit" variant="outline">Search</Button>
          {search && (
            <Button variant="outline" onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }}>Clear</Button>
          )}
        </form>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted block mb-1">Event Type</label>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
              className="rounded-lg bg-background/50 border border-card-border/60 px-3.5 py-2 text-sm text-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/30"
            >
              <option value="all">All Events</option>
              <option value="booking">Bookings</option>
              <option value="cancellation">Cancellations</option>
              <option value="signup">Signups</option>
              <option value="admin">Admin Actions</option>
            </select>
          </div>
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
          {(typeFilter !== 'all' || dateFrom || dateTo || search || sortBy !== 'newest') && (
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

      {/* Loading */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-card border border-card-border rounded-lg animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted">No events found.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Events list */}
          <div className="border border-card-border rounded-lg overflow-hidden">
            {/* Header */}
            <div className="hidden sm:grid sm:grid-cols-[40px_1fr_1fr_100px_100px] gap-4 px-4 py-2 bg-card border-b border-card-border text-xs text-muted font-medium uppercase tracking-wide">
              <span></span>
              <span>Event</span>
              <span>Member</span>
              <span>Type</span>
              <span>When</span>
            </div>

            {events.map((event, idx) => {
              const config = eventTypeConfig[event.type] || eventTypeConfig.admin
              const time = new Date(event.timestamp).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: 'Asia/Bangkok',
              })

              return (
                <div
                  key={event.id}
                  className={cn(
                    'grid sm:grid-cols-[40px_1fr_1fr_100px_100px] gap-2 sm:gap-4 px-4 py-3 items-center',
                    idx !== events.length - 1 && 'border-b border-card-border'
                  )}
                >
                  {/* Icon */}
                  <div className="hidden sm:flex items-center justify-center">
                    <span className="text-base">{config.icon}</span>
                  </div>

                  {/* Event description */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {event.label}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {event.detail}
                      {event.meta?.classTime && (
                        <> &middot; {new Date(event.meta.classTime).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok'
                        })}</>
                      )}
                    </p>
                  </div>

                  {/* Member */}
                  <div className="hidden sm:flex items-center gap-2">
                    {event.user ? (
                      <>
                        <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
                          {event.user.avatar_url ? (
                            <img src={event.user.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-accent text-[10px] font-medium">
                              {(event.user.name || event.user.email)?.[0]?.toUpperCase() || '?'}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">{event.user.name || 'Unknown'}</p>
                          <p className="text-xs text-muted truncate">{event.user.email}</p>
                        </div>
                      </>
                    ) : (
                      <span className="text-sm text-muted">System</span>
                    )}
                  </div>

                  {/* Type badge */}
                  <div>
                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded capitalize', config.color)}>
                      {event.type}
                    </span>
                  </div>

                  {/* Timestamp */}
                  <span className="text-xs text-muted">{time}</span>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
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
