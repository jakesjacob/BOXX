'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export default function AdminInstructorsPage() {
  const [instructors, setInstructors] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [dialog, setDialog] = useState(null) // 'create' | instructor object
  const [form, setForm] = useState({ name: '', bio: '', instagram_url: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  async function fetchInstructors() {
    try {
      const res = await fetch('/api/admin/instructors')
      if (res.ok) {
        const data = await res.json()
        setInstructors(data.instructors || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchInstructors() }, [])

  function openCreate() {
    setForm({ name: '', bio: '', instagram_url: '' })
    setDialog('create')
  }

  function openEdit(inst) {
    setForm({
      name: inst.name,
      bio: inst.bio || '',
      instagram_url: inst.instagram_url || '',
    })
    setDialog(inst)
  }

  async function handleSave() {
    setSubmitting(true)
    const isCreate = dialog === 'create'

    try {
      const res = await fetch('/api/admin/instructors', {
        method: isCreate ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(!isCreate && { id: dialog.id }),
          name: form.name,
          bio: form.bio || null,
          instagram_url: form.instagram_url || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ message: data.error || 'Failed to save', type: 'error' })
        return
      }
      setToast({ message: isCreate ? 'Instructor added' : 'Instructor updated', type: 'success' })
      setDialog(null)
      fetchInstructors()
    } catch (err) {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(inst) {
    try {
      const res = await fetch('/api/admin/instructors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inst.id, active: !inst.active }),
      })
      if (res.ok) {
        setToast({ message: inst.active ? 'Instructor deactivated' : 'Instructor activated', type: 'success' })
        fetchInstructors()
      }
    } catch (err) {
      setToast({ message: 'Failed to update', type: 'error' })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Instructors</h1>
        <Button onClick={openCreate}>+ Add Instructor</Button>
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

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-card border border-card-border rounded-lg animate-pulse" />
          ))}
        </div>
      ) : instructors.length === 0 ? (
        <div className="border border-card-border rounded-lg py-12 text-center">
          <p className="text-muted">No instructors yet.</p>
        </div>
      ) : (
        <div className="border border-card-border rounded-lg overflow-hidden">
          {instructors.map((inst, idx) => (
            <div
              key={inst.id}
              className={cn(
                'flex items-center gap-4 px-4 py-3',
                idx !== instructors.length - 1 && 'border-b border-card-border',
                !inst.active && 'opacity-50'
              )}
            >
              {/* Photo */}
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
                {inst.photo_url ? (
                  <img src={inst.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-accent text-sm font-medium">
                    {inst.name?.[0]?.toUpperCase() || '?'}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{inst.name}</p>
                  {!inst.active && (
                    <span className="text-[10px] font-medium text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">
                      Inactive
                    </span>
                  )}
                </div>
                {inst.bio && <p className="text-xs text-muted truncate mt-0.5">{inst.bio}</p>}
                {inst.instagram_url && (
                  <a href={inst.instagram_url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
                    Instagram
                  </a>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={inst.active}
                  onCheckedChange={() => handleToggleActive(inst)}
                />
                <Button variant="outline" className="text-xs h-7 px-2" onClick={() => openEdit(inst)}>
                  Edit
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog === 'create' ? 'Add Instructor' : 'Edit Instructor'}</DialogTitle>
            <DialogDescription>
              {dialog === 'create' ? 'Add a new instructor to your team.' : `Editing ${form.name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Bio</Label>
              <Input
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="Short bio..."
                className="mt-1"
              />
            </div>
            <div>
              <Label>Instagram URL</Label>
              <Input
                value={form.instagram_url}
                onChange={(e) => setForm((f) => ({ ...f, instagram_url: e.target.value }))}
                placeholder="https://instagram.com/..."
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting || !form.name}>
              {submitting ? 'Saving...' : dialog === 'create' ? 'Add Instructor' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
