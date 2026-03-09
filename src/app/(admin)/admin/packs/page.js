'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const emptyForm = {
  name: '',
  description: '',
  credits: '',
  validity_days: 30,
  price_thb: 0,
  is_membership: false,
  is_intro: false,
  badge_text: '',
  display_order: 0,
}

export default function AdminPacksPage() {
  const [packs, setPacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [dialog, setDialog] = useState(null) // 'create' | pack object for edit
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  async function fetchPacks() {
    try {
      const res = await fetch('/api/admin/packs')
      if (res.ok) {
        const data = await res.json()
        setPacks(data.packs || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPacks() }, [])

  function openCreate() {
    setForm(emptyForm)
    setDialog('create')
  }

  function openEdit(pack) {
    setForm({
      name: pack.name,
      description: pack.description || '',
      credits: pack.credits === null ? '' : pack.credits.toString(),
      validity_days: pack.validity_days,
      price_thb: pack.price_thb,
      is_membership: pack.is_membership,
      is_intro: pack.is_intro,
      badge_text: pack.badge_text || '',
      display_order: pack.display_order || 0,
    })
    setDialog(pack)
  }

  async function handleSave() {
    setSubmitting(true)
    const isCreate = dialog === 'create'
    const url = '/api/admin/packs'
    const method = isCreate ? 'POST' : 'PUT'

    const payload = {
      ...(!isCreate && { id: dialog.id }),
      name: form.name,
      description: form.description || null,
      credits: form.credits === '' ? null : parseInt(form.credits),
      validity_days: parseInt(form.validity_days),
      price_thb: parseInt(form.price_thb),
      is_membership: form.is_membership,
      is_intro: form.is_intro,
      badge_text: form.badge_text || null,
      display_order: parseInt(form.display_order) || 0,
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ message: data.error || 'Failed to save pack', type: 'error' })
        return
      }
      setToast({ message: isCreate ? 'Pack created' : 'Pack updated', type: 'success' })
      setDialog(null)
      fetchPacks()
    } catch (err) {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(pack) {
    try {
      const res = await fetch('/api/admin/packs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pack.id, active: !pack.active }),
      })
      if (res.ok) {
        setToast({ message: pack.active ? 'Pack deactivated' : 'Pack activated', type: 'success' })
        fetchPacks()
      }
    } catch (err) {
      setToast({ message: 'Failed to update', type: 'error' })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Class Packs</h1>
        <Button onClick={openCreate}>+ New Pack</Button>
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
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-card border border-card-border rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="border border-card-border rounded-lg overflow-hidden">
          {packs.map((pack, idx) => (
            <div
              key={pack.id}
              className={cn(
                'flex items-center gap-4 px-4 py-3',
                idx !== packs.length - 1 && 'border-b border-card-border',
                !pack.active && 'opacity-50'
              )}
            >
              {/* Order */}
              <span className="text-xs text-muted w-6 shrink-0 text-center">{pack.display_order}</span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{pack.name}</p>
                  {pack.badge_text && (
                    <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded shrink-0">
                      {pack.badge_text}
                    </span>
                  )}
                  {pack.is_intro && (
                    <span className="text-[10px] font-medium text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded shrink-0">
                      Intro
                    </span>
                  )}
                  {pack.is_membership && (
                    <span className="text-[10px] font-medium text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded shrink-0">
                      Membership
                    </span>
                  )}
                  {!pack.active && (
                    <span className="text-[10px] font-medium text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded shrink-0">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {pack.credits === null ? 'Unlimited' : `${pack.credits} credit${pack.credits !== 1 ? 's' : ''}`} · {pack.validity_days} days · ฿{pack.price_thb.toLocaleString()}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={pack.active}
                  onCheckedChange={() => handleToggleActive(pack)}
                />
                <Button variant="outline" className="text-xs h-7 px-2" onClick={() => openEdit(pack)}>
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
            <DialogTitle>{dialog === 'create' ? 'New Pack' : 'Edit Pack'}</DialogTitle>
            <DialogDescription>
              {dialog === 'create' ? 'Create a new class pack.' : `Editing "${form.name}"`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>Pack Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Credits (blank = unlimited)</Label>
                <Input
                  type="number"
                  value={form.credits}
                  onChange={(e) => setForm((f) => ({ ...f, credits: e.target.value }))}
                  placeholder="∞"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Validity (days)</Label>
                <Input
                  type="number"
                  value={form.validity_days}
                  onChange={(e) => setForm((f) => ({ ...f, validity_days: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Price (THB)</Label>
                <Input
                  type="number"
                  value={form.price_thb}
                  onChange={(e) => setForm((f) => ({ ...f, price_thb: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={form.display_order}
                  onChange={(e) => setForm((f) => ({ ...f, display_order: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Badge Text (optional)</Label>
              <Input
                value={form.badge_text}
                onChange={(e) => setForm((f) => ({ ...f, badge_text: e.target.value }))}
                placeholder="e.g. Best Value, Most Popular"
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_intro}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, is_intro: checked }))}
                />
                <Label>Intro Pack</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_membership}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, is_membership: checked }))}
                />
                <Label>Membership</Label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting || !form.name}>
              {submitting ? 'Saving...' : dialog === 'create' ? 'Create Pack' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
