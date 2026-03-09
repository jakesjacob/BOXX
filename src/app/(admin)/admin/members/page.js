'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export default function AdminMembersPage() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [creditsFilter, setCreditsFilter] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [toast, setToast] = useState(null)

  // Detail view
  const [selectedMember, setSelectedMember] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Edit dialog
  const [editDialog, setEditDialog] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', role: 'member' })
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  // Grant credits dialog
  const [grantDialog, setGrantDialog] = useState(false)
  const [packs, setPacks] = useState([])
  const [grantPackId, setGrantPackId] = useState('')
  const [grantNotes, setGrantNotes] = useState('')
  const [grantSubmitting, setGrantSubmitting] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '30' })
      if (search) params.set('search', search)
      if (roleFilter) params.set('role', roleFilter)
      if (creditsFilter) params.set('hasCredits', creditsFilter)
      if (sortBy) params.set('sort', sortBy)
      const res = await fetch(`/api/admin/members?${params}`)
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members || [])
        setTotal(data.total || 0)
      }
    } catch (err) {
      console.error('Failed to fetch members:', err)
    } finally {
      setLoading(false)
    }
  }, [page, search, roleFilter, creditsFilter, sortBy])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  // Fetch packs for grant dialog
  useEffect(() => {
    fetch('/api/admin/packs')
      .then((res) => res.ok ? res.json() : { packs: [] })
      .then((data) => setPacks(data.packs || []))
      .catch(console.error)
  }, [])

  // Fetch member detail
  async function openDetail(member) {
    setSelectedMember(member)
    setDetailLoading(true)
    setDetail(null)
    try {
      const res = await fetch(`/api/admin/members/${member.id}`)
      if (res.ok) {
        const data = await res.json()
        setDetail(data)
      }
    } catch (err) {
      console.error('Failed to fetch member detail:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  function openEditDialog() {
    if (!detail) return
    setEditForm({
      name: detail.member.name || '',
      email: detail.member.email || '',
      phone: detail.member.phone || '',
      role: detail.member.role || 'member',
    })
    setEditDialog(true)
  }

  async function handleEdit() {
    setEditSubmitting(true)
    try {
      const res = await fetch(`/api/admin/members/${selectedMember.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ message: data.error || 'Failed to update', type: 'error' })
        return
      }
      setToast({ message: 'Member updated', type: 'success' })
      setEditDialog(false)
      openDetail(selectedMember) // refresh detail
      fetchMembers() // refresh list
    } catch {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setEditSubmitting(false)
    }
  }

  async function handleDelete() {
    setDeleteSubmitting(true)
    try {
      const res = await fetch(`/api/admin/members/${selectedMember.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setToast({ message: data.error || 'Failed to deactivate', type: 'error' })
        return
      }
      setToast({ message: 'Member deactivated', type: 'success' })
      setDeleteDialog(false)
      setSelectedMember(null)
      setDetail(null)
      fetchMembers()
    } catch {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setDeleteSubmitting(false)
    }
  }

  async function handleGrant() {
    if (!grantPackId) return
    setGrantSubmitting(true)
    try {
      const res = await fetch('/api/admin/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedMember.id,
          packId: grantPackId,
          notes: grantNotes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ message: data.error || 'Failed to grant credits', type: 'error' })
        return
      }
      setToast({ message: 'Credits granted', type: 'success' })
      setGrantDialog(false)
      openDetail(selectedMember) // refresh
    } catch {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setGrantSubmitting(false)
    }
  }

  async function handleBookingAction(bookingId, action, refundCredit) {
    try {
      const res = await fetch('/api/admin/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, action, refundCredit }),
      })
      if (!res.ok) {
        const data = await res.json()
        setToast({ message: data.error || 'Action failed', type: 'error' })
        return
      }
      setToast({ message: 'Booking cancelled', type: 'success' })
      openDetail(selectedMember) // refresh
    } catch {
      setToast({ message: 'Something went wrong', type: 'error' })
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const totalPages = Math.ceil(total / 30)

  // ─── DETAIL VIEW ───
  if (selectedMember) {
    return (
      <div>
        <button
          onClick={() => { setSelectedMember(null); setDetail(null) }}
          className="flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Members
        </button>

        {/* Toast */}
        {toast && (
          <div className={cn(
            'mb-4 px-4 py-3 rounded-lg border flex items-center justify-between',
            toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'
          )}>
            <span className="text-sm">{toast.message}</span>
            <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {detailLoading ? (
          <div className="space-y-4">
            <div className="h-32 bg-card border border-card-border rounded-lg animate-pulse" />
            <div className="h-64 bg-card border border-card-border rounded-lg animate-pulse" />
          </div>
        ) : detail ? (
          <div className="space-y-6">
            {/* Profile header */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center overflow-hidden shrink-0">
                      {detail.member.avatar_url ? (
                        <img src={detail.member.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-accent text-xl font-bold">
                          {(detail.member.name || detail.member.email)?.[0]?.toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-foreground">{detail.member.name || 'No name'}</h2>
                        <Badge variant={detail.member.role === 'admin' ? 'default' : 'outline'} className="text-[10px]">
                          {detail.member.role}
                        </Badge>
                        {detail.member.google_id && (
                          <span className="text-[10px] text-muted bg-card-border px-1.5 py-0.5 rounded">Google</span>
                        )}
                      </div>
                      <p className="text-sm text-muted">{detail.member.email}</p>
                      {detail.member.phone && <p className="text-xs text-muted mt-0.5">{detail.member.phone}</p>}
                      <p className="text-xs text-muted mt-1">
                        Joined {new Date(detail.member.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Bangkok' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={openEditDialog}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => { setGrantDialog(true); setGrantPackId(packs[0]?.id || ''); setGrantNotes('') }}>
                      Grant Credits
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                      onClick={() => setDeleteDialog(true)}
                    >
                      Deactivate
                    </Button>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6 pt-4 border-t border-card-border">
                  {[
                    { label: 'Active Credits', value: detail.stats.activeCredits },
                    { label: 'Total Bookings', value: detail.stats.totalBookings },
                    { label: 'Cancelled', value: detail.stats.cancelledBookings },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <p className="text-xs text-muted">{stat.label}</p>
                      <p className="text-lg font-bold text-foreground">{stat.value}</p>
                    </div>
                  ))}
                </div>
                {detail.stats.lastVisit && (
                  <p className="text-xs text-muted mt-3">
                    Last visit: {new Date(detail.stats.lastVisit).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' })}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Credits */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-foreground mb-4">Credit History ({detail.credits.length})</h3>
                {detail.credits.length === 0 ? (
                  <p className="text-sm text-muted">No credits</p>
                ) : (
                  <div className="space-y-2">
                    {detail.credits.map((c) => {
                      const isActive = c.status === 'active' && new Date(c.expires_at) > new Date()
                      const isComp = c.stripe_payment_id?.startsWith('admin_grant')
                      return (
                        <div key={c.id} className={cn('flex items-center justify-between p-3 rounded-lg border', isActive ? 'border-card-border' : 'border-card-border/50 opacity-50')}>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{c.class_packs?.name || 'Pack'}</span>
                              {isComp && <Badge variant="outline" className="text-[10px]">Comp</Badge>}
                            </div>
                            <p className="text-xs text-muted">
                              {c.credits_remaining ?? '∞'} / {c.credits_total ?? '∞'} remaining · expires {new Date(c.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' })}
                            </p>
                          </div>
                          <span className="text-xs text-muted">
                            {new Date(c.purchased_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Bangkok' })}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bookings */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-foreground mb-4">Booking History ({detail.bookings.length})</h3>
                {detail.bookings.length === 0 ? (
                  <p className="text-sm text-muted">No bookings</p>
                ) : (
                  <div className="space-y-2">
                    {detail.bookings.map((b) => {
                      const cls = b.class_schedule
                      const isUpcoming = cls && new Date(cls.starts_at) > new Date()
                      const statusColor = b.status === 'confirmed' ? 'text-green-400' : 'text-red-400'

                      return (
                        <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-card-border">
                          <div className="flex items-center gap-3">
                            {cls?.class_types?.color && (
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cls.class_types.color }} />
                            )}
                            <div>
                              <span className="text-sm font-medium text-foreground">{cls?.class_types?.name || 'Class'}</span>
                              <p className="text-xs text-muted">
                                {cls ? new Date(cls.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' }) : '—'}
                                {cls?.instructors?.name && ` · ${cls.instructors.name}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn('text-xs font-medium capitalize', statusColor)}>{b.status}</span>
                            {b.status === 'confirmed' && isUpcoming && (
                              <button
                                onClick={() => handleBookingAction(b.id, 'cancel', true)}
                                className="text-[10px] px-2 py-1 rounded border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Waitlist */}
            {detail.waitlist.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-bold text-foreground mb-4">Waitlist ({detail.waitlist.length})</h3>
                  <div className="space-y-2">
                    {detail.waitlist.map((w) => (
                      <div key={w.id} className="flex items-center justify-between p-3 rounded-lg border border-card-border">
                        <div>
                          <span className="text-sm font-medium text-foreground">{w.class_schedule?.class_types?.name || 'Class'}</span>
                          <p className="text-xs text-muted">
                            Position #{w.position} · {w.class_schedule ? new Date(w.class_schedule.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' }) : '—'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card><CardContent className="py-12 text-center"><p className="text-muted">Failed to load member details.</p></CardContent></Card>
        )}

        {/* Edit Dialog */}
        <Dialog open={editDialog} onOpenChange={(open) => !open && setEditDialog(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Member</DialogTitle>
              <DialogDescription>Update {selectedMember?.name || 'member'}&apos;s profile</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Name</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Role</Label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="mt-1 w-full rounded-md border border-card-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
              <Button onClick={handleEdit} disabled={editSubmitting}>{editSubmitting ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Deactivate Member</DialogTitle>
              <DialogDescription>
                This will cancel all bookings, void credits, remove from waitlists, and anonymize the account. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDeleteDialog(false)}>Keep Member</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={deleteSubmitting}>
                {deleteSubmitting ? 'Deactivating...' : 'Deactivate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Grant Credits Dialog */}
        <Dialog open={grantDialog} onOpenChange={(open) => !open && setGrantDialog(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Grant Credits</DialogTitle>
              <DialogDescription>Add a complimentary pack to {selectedMember?.name || selectedMember?.email}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Pack</Label>
                <select
                  value={grantPackId}
                  onChange={(e) => setGrantPackId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-card-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {packs.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.credits || '∞'} credits, {p.validity_days}d)</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Input value={grantNotes} onChange={(e) => setGrantNotes(e.target.value)} placeholder="e.g. Comp for referral" className="mt-1" />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setGrantDialog(false)}>Cancel</Button>
              <Button onClick={handleGrant} disabled={grantSubmitting || !grantPackId}>{grantSubmitting ? 'Granting...' : 'Grant Credits'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ─── LIST VIEW ───
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Members</h1>
        <span className="text-sm text-muted">{total} total</span>
      </div>

      {/* Toast */}
      {toast && (
        <div className={cn(
          'mb-6 px-4 py-3 rounded-lg border flex items-center justify-between',
          toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'
        )}>
          <span className="text-sm">{toast.message}</span>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="space-y-3 mb-6">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="Search by name or email..."
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
            <label className="text-xs text-muted block mb-1">Role</label>
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
              className="rounded-md border border-card-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">All Roles</option>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Credits</label>
            <select
              value={creditsFilter}
              onChange={(e) => { setCreditsFilter(e.target.value); setPage(1) }}
              className="rounded-md border border-card-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">All</option>
              <option value="yes">Has Credits</option>
              <option value="no">No Credits</option>
            </select>
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
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
              <option value="most_credits">Most Credits</option>
              <option value="most_bookings">Most Bookings</option>
            </select>
          </div>
          {(roleFilter || creditsFilter || sortBy !== 'newest') && (
            <Button
              variant="outline"
              className="text-xs"
              onClick={() => { setRoleFilter(''); setCreditsFilter(''); setSortBy('newest'); setPage(1) }}
            >
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-card border border-card-border rounded-lg animate-pulse" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted">No members found.</p></CardContent></Card>
      ) : (
        <>
          <div className="border border-card-border rounded-lg overflow-hidden">
            <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_80px_80px_120px] gap-4 px-4 py-2 bg-card border-b border-card-border text-xs text-muted font-medium uppercase tracking-wide">
              <span>Member</span>
              <span>Email</span>
              <span>Credits</span>
              <span>Bookings</span>
              <span>Joined</span>
            </div>

            {members.map((member, idx) => (
              <button
                key={member.id}
                onClick={() => openDetail(member)}
                className={cn(
                  'w-full text-left grid sm:grid-cols-[1fr_1fr_80px_80px_120px] gap-2 sm:gap-4 px-4 py-3 items-center hover:bg-white/[0.02] transition-colors',
                  idx !== members.length - 1 && 'border-b border-card-border'
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-accent text-xs font-medium">
                        {(member.name || member.email)?.[0]?.toUpperCase() || '?'}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground truncate">{member.name || 'No name'}</p>
                      {member.role === 'admin' && (
                        <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded shrink-0">Admin</span>
                      )}
                    </div>
                    <p className="text-xs text-muted truncate sm:hidden">{member.email}</p>
                  </div>
                </div>
                <p className="hidden sm:block text-sm text-muted truncate">{member.email}</p>
                <span className="text-sm font-medium text-foreground">{member.activeCredits}</span>
                <span className="hidden sm:block text-sm text-muted">{member.totalBookings}</span>
                <span className="hidden sm:block text-xs text-muted">
                  {new Date(member.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Bangkok' })}
                </span>
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="text-xs">Previous</Button>
              <span className="text-sm text-muted">Page {page} of {totalPages}</span>
              <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="text-xs">Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
