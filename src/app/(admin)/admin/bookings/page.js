'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [classTypeFilter, setClassTypeFilter] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [classTypes, setClassTypes] = useState([])

  // Fetch class types for filter dropdown
  useEffect(() => {
    fetch('/api/admin/schedule/options')
      .then((res) => res.ok ? res.json() : { classTypes: [] })
      .then((data) => setClassTypes(data.classTypes || []))
      .catch(console.error)
  }, [])

  useEffect(() => {
    async function fetchBookings() {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: page.toString(), limit: '30' })
        if (statusFilter !== 'all') params.set('status', statusFilter)
        if (dateFrom) params.set('dateFrom', dateFrom)
        if (dateTo) params.set('dateTo', dateTo)
        if (search) params.set('search', search)
        if (classTypeFilter) params.set('classType', classTypeFilter)
        if (sortBy) params.set('sort', sortBy)

        const res = await fetch(`/api/admin/bookings?${params}`)
        if (res.ok) {
          const data = await res.json()
          setBookings(data.bookings || [])
          setTotal(data.total || 0)
        }
      } catch (err) {
        console.error('Failed to fetch bookings:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchBookings()
  }, [page, statusFilter, dateFrom, dateTo, search, classTypeFilter, sortBy])

  function handleSearch(e) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const totalPages = Math.ceil(total / 30)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Bookings</h1>
        <span className="text-sm text-muted">{total} total</span>
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
            <label className="text-xs text-muted block mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="rounded-md border border-card-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">All</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Class Type</label>
            <select
              value={classTypeFilter}
              onChange={(e) => { setClassTypeFilter(e.target.value); setPage(1) }}
              className="rounded-md border border-card-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">All Classes</option>
              {classTypes.map((ct) => (
                <option key={ct.id} value={ct.id}>{ct.name}</option>
              ))}
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
              className="rounded-md border border-card-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
          {(statusFilter !== 'all' || dateFrom || dateTo || classTypeFilter || search || sortBy !== 'newest') && (
            <Button
              variant="outline"
              className="text-xs"
              onClick={() => { setStatusFilter('all'); setDateFrom(''); setDateTo(''); setClassTypeFilter(''); setSearchInput(''); setSearch(''); setSortBy('newest'); setPage(1) }}
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
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted">No bookings found.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Bookings list */}
          <div className="border border-card-border rounded-lg overflow-hidden">
            {/* Header */}
            <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_1fr_80px_100px] gap-4 px-4 py-2 bg-card border-b border-card-border text-xs text-muted font-medium uppercase tracking-wide">
              <span>Member</span>
              <span>Class</span>
              <span>Date & Time</span>
              <span>Status</span>
              <span>Booked</span>
            </div>

            {bookings.map((booking, idx) => {
              const cls = booking.class_schedule
              const classTime = cls ? new Date(cls.starts_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: 'Asia/Bangkok',
              }) : '—'
              const statusStyles = {
                confirmed: 'text-green-400 bg-green-400/10',
                cancelled: 'text-red-400 bg-red-400/10',
              }

              return (
                <div
                  key={booking.id}
                  className={cn(
                    'grid sm:grid-cols-[1fr_1fr_1fr_80px_100px] gap-2 sm:gap-4 px-4 py-3 items-center',
                    idx !== bookings.length - 1 && 'border-b border-card-border'
                  )}
                >
                  {/* Member */}
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {booking.users?.avatar_url ? (
                        <img src={booking.users.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-accent text-[10px] font-medium">
                          {(booking.users?.name || booking.users?.email)?.[0]?.toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {booking.users?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted truncate sm:hidden">
                        {cls?.class_types?.name} · {classTime}
                      </p>
                    </div>
                  </div>

                  {/* Class */}
                  <div className="hidden sm:flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cls?.class_types?.color || '#c8a750' }}
                    />
                    <span className="text-sm text-foreground truncate">
                      {cls?.class_types?.name || '—'}
                    </span>
                  </div>

                  {/* Date & Time */}
                  <span className="hidden sm:block text-sm text-muted">{classTime}</span>

                  {/* Status */}
                  <div>
                    <span className={cn(
                      'text-[10px] font-medium px-1.5 py-0.5 rounded',
                      statusStyles[booking.status] || 'text-muted bg-muted/10'
                    )}>
                      {booking.status}
                      {booking.late_cancel && ' (late)'}
                    </span>
                  </div>

                  {/* Booked date */}
                  <span className="hidden sm:block text-xs text-muted">
                    {new Date(booking.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      timeZone: 'Asia/Bangkok',
                    })}
                  </span>
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
