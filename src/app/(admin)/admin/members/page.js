'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export default function AdminMembersPage() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [toast, setToast] = useState(null)

  // Grant credits dialog
  const [grantDialog, setGrantDialog] = useState(null) // member object
  const [packs, setPacks] = useState([])
  const [grantPackId, setGrantPackId] = useState('')
  const [grantNotes, setGrantNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    async function fetchMembers() {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: page.toString(), limit: '30' })
        if (search) params.set('search', search)

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
    }
    fetchMembers()
  }, [page, search])

  // Fetch packs for grant dialog
  useEffect(() => {
    fetch('/api/admin/packs')
      .then((res) => res.ok ? res.json() : { packs: [] })
      .then((data) => setPacks(data.packs || []))
      .catch(console.error)
  }, [])

  function handleSearch(e) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  function openGrantDialog(member) {
    setGrantDialog(member)
    setGrantPackId(packs[0]?.id || '')
    setGrantNotes('')
  }

  async function handleGrant() {
    if (!grantDialog || !grantPackId) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: grantDialog.id,
          packId: grantPackId,
          notes: grantNotes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ message: data.error || 'Failed to grant credits', type: 'error' })
        return
      }
      setToast({ message: `Credits granted to ${grantDialog.name || grantDialog.email}`, type: 'success' })
      setGrantDialog(null)
      // Refresh the list
      setSearch(search + '') // force re-fetch
    } catch (err) {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const totalPages = Math.ceil(total / 30)

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
          toast.type === 'error'
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : 'bg-green-500/10 border-green-500/20 text-green-400'
        )}>
          <span className="text-sm">{toast.message}</span>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <Input
          placeholder="Search by name or email..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-sm"
        />
        <Button type="submit" variant="outline">Search</Button>
        {search && (
          <Button variant="outline" onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }}>
            Clear
          </Button>
        )}
      </form>

      {/* Loading */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-card border border-card-border rounded-lg animate-pulse" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted">No members found.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="border border-card-border rounded-lg overflow-hidden">
            {/* Header */}
            <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_80px_80px_120px] gap-4 px-4 py-2 bg-card border-b border-card-border text-xs text-muted font-medium uppercase tracking-wide">
              <span>Member</span>
              <span>Email</span>
              <span>Credits</span>
              <span>Bookings</span>
              <span>Joined</span>
            </div>

            {members.map((member, idx) => {
              const joinDate = new Date(member.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'Asia/Bangkok',
              })

              return (
                <div
                  key={member.id}
                  className={cn(
                    'grid sm:grid-cols-[1fr_1fr_80px_80px_120px] gap-2 sm:gap-4 px-4 py-3 items-center',
                    idx !== members.length - 1 && 'border-b border-card-border'
                  )}
                >
                  {/* Member */}
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
                        <p className="text-sm font-medium text-foreground truncate">
                          {member.name || 'No name'}
                        </p>
                        {member.role === 'admin' && (
                          <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded shrink-0">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted truncate sm:hidden">{member.email}</p>
                    </div>
                  </div>

                  {/* Email */}
                  <p className="hidden sm:block text-sm text-muted truncate">{member.email}</p>

                  {/* Credits */}
                  <div>
                    <button
                      onClick={() => openGrantDialog(member)}
                      className="text-sm font-medium text-foreground hover:text-accent transition-colors"
                      title="Click to grant credits"
                    >
                      {member.activeCredits}
                    </button>
                  </div>

                  {/* Bookings */}
                  <span className="hidden sm:block text-sm text-muted">{member.totalBookings}</span>

                  {/* Joined */}
                  <span className="hidden sm:block text-xs text-muted">{joinDate}</span>
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

      {/* Grant Credits Dialog */}
      <Dialog open={!!grantDialog} onOpenChange={(open) => !open && setGrantDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Grant Credits</DialogTitle>
            <DialogDescription>
              Add a complimentary pack to {grantDialog?.name || grantDialog?.email}
            </DialogDescription>
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
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.credits || '∞'} credits, {p.validity_days}d)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input
                value={grantNotes}
                onChange={(e) => setGrantNotes(e.target.value)}
                placeholder="e.g. Comp for referral"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setGrantDialog(null)}>Cancel</Button>
            <Button onClick={handleGrant} disabled={submitting || !grantPackId}>
              {submitting ? 'Granting...' : 'Grant Credits'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
