'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/ThemeProvider'
import { getCurrencySymbol } from '@/lib/currency'

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtCurrency(v, symbol = '$') {
  return symbol + Number(v || 0).toLocaleString('en-US')
}

function fmtNumber(v) {
  return Number(v || 0).toLocaleString('en-US')
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ChangeBadge({ value }) {
  if (value === 0 || value === undefined || value === null) return null
  const positive = value > 0
  return (
    <span
      className={cn(
        'text-xs px-1.5 py-0.5 rounded font-medium ml-2 inline-block',
        positive ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'
      )}
    >
      {positive ? '+' : ''}{value}%
    </span>
  )
}

function SectionHeader({ children }) {
  return (
    <h3 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
      {children}
    </h3>
  )
}

// ─── Skeleton Loader ────────────────────────────────────────────────────────

function SkeletonCard({ className }) {
  return (
    <Card className={cn('bg-card border border-card-border rounded-lg', className)}>
      <CardContent className="p-5">
        <div className="h-3 w-20 bg-white/[0.06] rounded animate-pulse mb-3" />
        <div className="h-7 w-28 bg-white/[0.08] rounded animate-pulse mb-2" />
        <div className="h-3 w-16 bg-white/[0.04] rounded animate-pulse" />
      </CardContent>
    </Card>
  )
}

const SKELETON_HEIGHTS = [45, 72, 33, 88, 55, 67, 28, 80, 42, 63, 95, 38, 75, 50]

function SkeletonChart() {
  return (
    <Card className="bg-card border border-card-border rounded-lg">
      <CardContent className="p-5">
        <div className="h-3 w-32 bg-white/[0.06] rounded animate-pulse mb-4" />
        <div className="flex items-end gap-1 h-[120px]">
          {SKELETON_HEIGHTS.map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-white/[0.06] rounded-t-sm animate-pulse"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function SkeletonTable() {
  return (
    <Card className="bg-card border border-card-border rounded-lg">
      <CardContent className="p-5">
        <div className="h-3 w-24 bg-white/[0.06] rounded animate-pulse mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex justify-between py-2">
            <div className="h-3 w-32 bg-white/[0.05] rounded animate-pulse" />
            <div className="h-3 w-12 bg-white/[0.05] rounded animate-pulse" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ─── Bar Chart ──────────────────────────────────────────────────────────────

function BarChart({ data, valueKey, label, barColor = 'bg-accent/80', hoverColor = 'hover:bg-accent' }) {
  const maxVal = Math.max(...data.map(d => d[valueKey] || 0), 1)
  const BAR_HEIGHT = 120

  return (
    <Card className="bg-card border border-card-border rounded-lg">
      <CardContent className="p-5">
        <SectionHeader>{label}</SectionHeader>
        {data.length === 0 ? (
          <p className="text-sm text-muted py-8 text-center">No data for this period.</p>
        ) : (
          <div>
            <div className="flex items-end gap-[2px]" style={{ height: BAR_HEIGHT }}>
              {data.map((d, i) => {
                const h = maxVal > 0 ? (d[valueKey] / maxVal) * BAR_HEIGHT : 0
                return (
                  <div key={i} className="flex-1 flex flex-col justify-end h-full group relative">
                    <div
                      className={cn('w-full rounded-t-sm transition-colors', barColor, hoverColor)}
                      style={{ height: Math.max(h, d[valueKey] > 0 ? 2 : 0) }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                      <div className="bg-background border border-card-border rounded px-2 py-1 text-xs text-foreground whitespace-nowrap shadow-lg">
                        {fmtDate(d.date)}: {d[valueKey]}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Date labels — every 7th day */}
            <div className="flex gap-[2px] mt-1.5">
              {data.map((d, i) => (
                <div key={i} className="flex-1 text-center">
                  {i % 7 === 0 ? (
                    <span className="text-[10px] text-muted">{fmtDate(d.date)}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Device Breakdown ───────────────────────────────────────────────────────

function DeviceBreakdown({ data }) {
  const total = (data.mobile || 0) + (data.desktop || 0) + (data.tablet || 0)
  if (total === 0) {
    return (
      <Card className="bg-card border border-card-border rounded-lg">
        <CardContent className="p-5">
          <SectionHeader>Device Breakdown</SectionHeader>
          <p className="text-sm text-muted py-4 text-center">No device data yet.</p>
        </CardContent>
      </Card>
    )
  }

  const segments = [
    { label: 'Desktop', value: data.desktop, color: 'bg-accent' },
    { label: 'Mobile', value: data.mobile, color: 'bg-accent/60' },
    { label: 'Tablet', value: data.tablet, color: 'bg-accent/30' },
  ].filter(s => s.value > 0)

  return (
    <Card className="bg-card border border-card-border rounded-lg">
      <CardContent className="p-5">
        <SectionHeader>Device Breakdown</SectionHeader>
        {/* Stacked horizontal bar */}
        <div className="flex w-full h-6 rounded overflow-hidden mb-3">
          {segments.map((s, i) => (
            <div
              key={i}
              className={cn('h-full transition-all', s.color)}
              style={{ width: `${(s.value / total) * 100}%` }}
            />
          ))}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {segments.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 text-sm">
              <div className={cn('w-2.5 h-2.5 rounded-sm', s.color)} />
              <span className="text-muted">{s.label}</span>
              <span className="text-foreground font-medium">{Math.round((s.value / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const { theme } = useTheme()
  const cs = getCurrencySymbol(theme?.currency)
  const [range, setRange] = useState('30d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/admin/analytics?range=${range}`)
        if (!res.ok) throw new Error('Failed to fetch analytics')
        const json = await res.json()
        setData(json)
      } catch (err) {
        console.error('Analytics fetch error:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchAnalytics()
  }, [range])

  const ranges = ['7d', '30d', '90d']

  // ─── Loading State ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 bg-white/[0.08] rounded animate-pulse" />
          <div className="flex gap-1 bg-white/[0.04] rounded-full p-1">
            {ranges.map(r => (
              <div key={r} className="h-7 w-12 bg-white/[0.06] rounded-full animate-pulse" />
            ))}
          </div>
        </div>
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonChart />
          <SkeletonChart />
        </div>
        {/* Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SkeletonTable />
          <SkeletonTable />
          <SkeletonTable />
        </div>
      </div>
    )
  }

  // ─── Error State ────────────────────────────────────────────────

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Card className="bg-card border border-card-border rounded-lg">
          <CardContent className="p-8 text-center">
            <p className="text-red-400 text-sm mb-2">Failed to load analytics</p>
            <p className="text-muted text-xs">{error}</p>
            <button
              onClick={() => setRange(range)}
              className="mt-4 text-xs text-accent hover:text-accent-dim underline"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Empty State ────────────────────────────────────────────────

  const web = data?.web || {}
  const biz = data?.business || {}

  const hasAnyData =
    (web.pageViews?.current || 0) > 0 ||
    (biz.totalMembers || 0) > 0 ||
    (biz.totalBookings?.current || 0) > 0 ||
    (biz.revenue?.current || 0) > 0

  if (!hasAnyData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <RangeSelector ranges={ranges} active={range} onChange={setRange} />
        </div>
        <Card className="bg-card border border-card-border rounded-lg">
          <CardContent className="p-12 text-center">
            <div className="text-4xl mb-4 opacity-30">--</div>
            <p className="text-foreground font-medium mb-1">No analytics data yet</p>
            <p className="text-muted text-sm max-w-md mx-auto">
              Analytics data will appear as your studio receives visitors and bookings.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Data Views ─────────────────────────────────────────────────

  const trafficSources = [
    ...(web.topReferrers || []).map(r => ({ source: r.domain, views: r.views })),
    ...(web.utmSources || []).map(u => ({ source: u.source, views: u.views })),
  ].sort((a, b) => b.views - a.views)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <RangeSelector ranges={ranges} active={range} onChange={setRange} />
      </div>

      {/* ── Row 1: Stat Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Page Views"
          value={fmtNumber(web.pageViews?.current)}
          change={web.pageViews?.change}
        />
        <StatCard
          label="Total Members"
          value={fmtNumber(biz.totalMembers)}
        />
        <StatCard
          label="Bookings"
          value={fmtNumber(biz.totalBookings?.current)}
          change={biz.totalBookings?.change}
        />
        <StatCard
          label="Revenue"
          value={fmtCurrency(biz.revenue?.current, cs)}
          change={biz.revenue?.change}
        />
      </div>

      {/* ── Row 2: Charts ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarChart
          data={web.viewsByDay || []}
          valueKey="views"
          label="Page Views Over Time"
          barColor="bg-accent/80"
          hoverColor="hover:bg-accent"
        />
        <BarChart
          data={biz.bookingsByDay || []}
          valueKey="count"
          label="Bookings Over Time"
          barColor="bg-blue-500/70"
          hoverColor="hover:bg-blue-500"
        />
      </div>

      {/* ── Row 3: Top Pages / Traffic / Devices ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Pages */}
        <Card className="bg-card border border-card-border rounded-lg">
          <CardContent className="p-5">
            <SectionHeader>Top Pages</SectionHeader>
            {(web.topPages || []).length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No page data yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted text-left">
                    <th className="pb-2 font-medium">Path</th>
                    <th className="pb-2 font-medium text-right">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {(web.topPages || []).map((p, i) => (
                    <tr key={i} className={cn(
                      'hover:bg-white/[0.02] transition-colors',
                      i % 2 === 1 && 'bg-white/[0.01]'
                    )}>
                      <td className="py-1.5 text-foreground truncate max-w-[180px]" title={p.path}>
                        {p.path}
                      </td>
                      <td className="py-1.5 text-right text-muted tabular-nums">
                        {fmtNumber(p.views)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Traffic Sources */}
        <Card className="bg-card border border-card-border rounded-lg">
          <CardContent className="p-5">
            <SectionHeader>Traffic Sources</SectionHeader>
            {trafficSources.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center leading-relaxed">
                No traffic data yet &mdash; analytics will appear as visitors arrive.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted text-left">
                    <th className="pb-2 font-medium">Source</th>
                    <th className="pb-2 font-medium text-right">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {trafficSources.slice(0, 10).map((s, i) => (
                    <tr key={i} className={cn(
                      'hover:bg-white/[0.02] transition-colors',
                      i % 2 === 1 && 'bg-white/[0.01]'
                    )}>
                      <td className="py-1.5 text-foreground truncate max-w-[180px]" title={s.source}>
                        {s.source}
                      </td>
                      <td className="py-1.5 text-right text-muted tabular-nums">
                        {fmtNumber(s.views)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Device Breakdown */}
        <DeviceBreakdown data={web.deviceBreakdown || { mobile: 0, desktop: 0, tablet: 0 }} />
      </div>

      {/* ── Row 4: Class Performance / Pack Sales ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Class Performance */}
        <Card className="bg-card border border-card-border rounded-lg">
          <CardContent className="p-5">
            <SectionHeader>Class Performance</SectionHeader>
            {(biz.classPerformance || []).length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No class data for this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted text-left">
                    <th className="pb-2 font-medium">Class</th>
                    <th className="pb-2 font-medium text-right">Bookings</th>
                    <th className="pb-2 font-medium text-right w-[100px]">Fill Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(biz.classPerformance || []).map((c, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-1.5 text-foreground">{c.name}</td>
                      <td className="py-1.5 text-right text-muted tabular-nums">{c.bookings}</td>
                      <td className="py-1.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full transition-all"
                              style={{ width: `${Math.min(c.avgFillRate, 100)}%` }}
                            />
                          </div>
                          <span className="text-muted tabular-nums text-xs w-8 text-right">{c.avgFillRate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Pack Sales */}
        <Card className="bg-card border border-card-border rounded-lg">
          <CardContent className="p-5">
            <SectionHeader>Pack Sales</SectionHeader>
            {(biz.packSales || []).length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No pack sales for this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted text-left">
                    <th className="pb-2 font-medium">Pack</th>
                    <th className="pb-2 font-medium text-right">Sold</th>
                    <th className="pb-2 font-medium text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(biz.packSales || []).map((p, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-1.5 text-foreground">{p.name}</td>
                      <td className="py-1.5 text-right text-muted tabular-nums">{p.count}</td>
                      <td className="py-1.5 text-right text-foreground tabular-nums">{fmtCurrency(p.revenue, cs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 5: Instructor Stats ────────────────────────────── */}
      <Card className="bg-card border border-card-border rounded-lg">
        <CardContent className="p-5">
          <SectionHeader>Instructor Stats</SectionHeader>
          {(biz.instructorStats || []).length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">No instructor data for this period.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {(biz.instructorStats || []).map((inst, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-card-border hover:bg-white/[0.04] transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                    <span className="text-accent font-semibold text-sm">
                      {inst.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{inst.name}</p>
                    <p className="text-xs text-muted">
                      {inst.classesTaught} {inst.classesTaught === 1 ? 'class' : 'classes'} &middot; {inst.totalBookings} {inst.totalBookings === 1 ? 'booking' : 'bookings'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Row 6: Active Members ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-card border border-card-border rounded-lg">
          <CardContent className="p-5">
            <SectionHeader>Active Members</SectionHeader>
            <p className="text-2xl font-bold text-foreground">{fmtNumber(biz.activeMembers)}</p>
            <p className="text-sm text-muted mt-1">
              {biz.activeMembers === 1 ? '1 active member' : `${fmtNumber(biz.activeMembers)} active members`} in this period
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-card-border rounded-lg">
          <CardContent className="p-5">
            <SectionHeader>New Members</SectionHeader>
            <div className="flex items-baseline">
              <p className="text-2xl font-bold text-foreground">{fmtNumber(biz.newMembers?.current)}</p>
              <ChangeBadge value={biz.newMembers?.change} />
            </div>
            <p className="text-sm text-muted mt-1">
              {biz.newMembers?.current === 1 ? '1 new member' : `${fmtNumber(biz.newMembers?.current)} new members`} joined
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function RangeSelector({ ranges, active, onChange }) {
  return (
    <div className="flex gap-1 bg-white/[0.04] rounded-full p-1">
      {ranges.map(r => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-full transition-all',
            r === active
              ? 'bg-accent text-background shadow-sm'
              : 'text-muted hover:text-foreground'
          )}
        >
          {r}
        </button>
      ))}
    </div>
  )
}

function StatCard({ label, value, change }) {
  return (
    <Card className="bg-card border border-card-border rounded-lg">
      <CardContent className="p-5">
        <p className="text-sm font-medium text-muted uppercase tracking-wide mb-1">{label}</p>
        <div className="flex items-baseline">
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <ChangeBadge value={change} />
        </div>
      </CardContent>
    </Card>
  )
}
