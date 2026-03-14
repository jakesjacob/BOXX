'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/ThemeProvider'
import { getCurrencySymbol } from '@/lib/currency'
import { X, ExternalLink, Trash2, Tag, Check, ChevronDown, ChevronUp, Plus } from 'lucide-react'

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
  stripe_price_id: '',
}

function InlinePackForm({ form, setForm, onSave, onCancel, submitting, theme, cs }) {
  const [showMore, setShowMore] = useState(false)
  const [nameEl, setNameEl] = useState(null)

  useEffect(() => {
    nameEl?.focus()
  }, [nameEl])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (form.name && !submitting) onSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [form.name, submitting, onSave, onCancel])

  return (
    <div className="px-4 py-3 bg-card/50">
      {/* Primary fields row */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className="text-[11px] text-muted mb-1 block">Name</label>
          <Input
            ref={setNameEl}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Pack name"
            className="h-8 text-sm"
          />
        </div>
        <div className="w-24">
          <label className="text-[11px] text-muted mb-1 block">Credits</label>
          <Input
            type="number"
            value={form.credits}
            onChange={(e) => setForm((f) => ({ ...f, credits: e.target.value }))}
            placeholder="∞"
            className="h-8 text-sm"
          />
        </div>
        <div className="w-24">
          <label className="text-[11px] text-muted mb-1 block">Validity (days)</label>
          <Input
            type="number"
            value={form.validity_days}
            onChange={(e) => setForm((f) => ({ ...f, validity_days: e.target.value }))}
            className="h-8 text-sm"
          />
        </div>
        <div className="w-28">
          <label className="text-[11px] text-muted mb-1 block">Price ({theme?.currency || 'THB'})</label>
          <Input
            type="number"
            value={form.price_thb}
            onChange={(e) => setForm((f) => ({ ...f, price_thb: e.target.value }))}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={onSave}
            disabled={submitting || !form.name}
          >
            {submitting ? (
              'Saving...'
            ) : (
              <><Check className="w-3.5 h-3.5 mr-1" /> Save</>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs"
            onClick={onCancel}
            disabled={submitting}
          >
            <X className="w-3.5 h-3.5 mr-1" /> Cancel
          </Button>
        </div>
      </div>

      {/* More options toggle */}
      <button
        type="button"
        onClick={() => setShowMore(!showMore)}
        className="flex items-center gap-1 text-[11px] text-accent hover:text-accent-dim transition-colors mt-3"
      >
        {showMore ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {showMore ? 'Fewer options' : 'More options'}
      </button>

      {/* Expandable section */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-in-out',
          showMore ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="pt-3 pb-1 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[11px] text-muted mb-1 block">Description</label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                className="h-8 text-sm"
              />
            </div>
            <div className="w-24">
              <label className="text-[11px] text-muted mb-1 block">Display Order</label>
              <Input
                type="number"
                value={form.display_order}
                onChange={(e) => setForm((f) => ({ ...f, display_order: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="w-36">
              <label className="text-[11px] text-muted mb-1 block">Badge Text</label>
              <Input
                value={form.badge_text}
                onChange={(e) => setForm((f) => ({ ...f, badge_text: e.target.value }))}
                placeholder="e.g. Best Value"
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-muted mb-1 block">Stripe Product</label>
            <Input
              value={form.stripe_price_id}
              onChange={(e) => setForm((f) => ({ ...f, stripe_price_id: e.target.value }))}
              placeholder="Paste product ID, price ID, or Stripe URL"
              className="h-8 text-sm font-mono"
            />
            <p className="text-[10px] text-muted mt-1">
              Paste a Product ID (prod_...), Price ID (price_...), or product URL from Stripe Dashboard
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_intro}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, is_intro: checked }))}
              />
              <Label className="text-xs">Intro Pack</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_membership}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, is_membership: checked }))}
              />
              <Label className="text-xs">Membership</Label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminPacksPage() {
  const { theme } = useTheme()
  const cs = getCurrencySymbol(theme?.currency)
  const [packs, setPacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [editingId, setEditingId] = useState(null) // 'new' for create, pack.id for edit
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(null)
  const [fetchError, setFetchError] = useState(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  async function fetchPacks() {
    setFetchError(null)
    try {
      const res = await fetch('/api/admin/packs')
      if (res.ok) {
        const data = await res.json()
        setPacks(data.packs || [])
      } else {
        setFetchError('Failed to load packs')
      }
    } catch (err) {
      console.error(err)
      setFetchError('Unable to connect. Check your internet and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPacks() }, [])

  function startCreate() {
    setForm(emptyForm)
    setEditingId('new')
  }

  function startEdit(pack) {
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
      stripe_price_id: pack.stripe_price_id || '',
    })
    setEditingId(pack.id)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSave() {
    setSubmitting(true)
    const isCreate = editingId === 'new'
    const url = '/api/admin/packs'
    const method = isCreate ? 'POST' : 'PUT'

    const payload = {
      ...(!isCreate && { id: editingId }),
      name: form.name,
      description: form.description || null,
      credits: form.credits === '' ? null : parseInt(form.credits),
      validity_days: parseInt(form.validity_days),
      price_thb: parseInt(form.price_thb),
      is_membership: form.is_membership,
      is_intro: form.is_intro,
      badge_text: form.badge_text || null,
      display_order: parseInt(form.display_order) || 0,
      stripe_price_id: form.stripe_price_id || null,
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
      setEditingId(null)
      setForm(emptyForm)
      fetchPacks()
    } catch (err) {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(pack) {
    setDeleteDialog(null)
    try {
      const res = await fetch('/api/admin/packs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pack.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ message: data.error || 'Failed to delete', type: 'error' })
        return
      }
      setToast({ message: `"${pack.name}" deleted`, type: 'success' })
      fetchPacks()
    } catch {
      setToast({ message: 'Something went wrong', type: 'error' })
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
        <h1 className="text-2xl font-bold text-foreground">Products</h1>
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
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {fetchError && !loading ? (
        <div className="border border-card-border rounded-lg py-12 text-center">
          <p className="text-red-400 font-medium">{fetchError}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={fetchPacks}>Retry</Button>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-card border border-card-border rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="border border-card-border rounded-lg overflow-hidden">
          {packs.map((pack, idx) => {
            const isEditing = editingId === pack.id

            if (isEditing) {
              return (
                <div
                  key={pack.id}
                  className={cn(
                    idx !== packs.length - 1 && 'border-b border-card-border',
                    'border-l-2 border-l-accent'
                  )}
                >
                  <InlinePackForm
                    form={form}
                    setForm={setForm}
                    onSave={handleSave}
                    onCancel={cancelEdit}
                    submitting={submitting}
                    theme={theme}
                    cs={cs}
                  />
                </div>
              )
            }

            return (
              <div
                key={pack.id}
                className={cn(
                  'flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 px-4 py-3',
                  idx !== packs.length - 1 && 'border-b border-card-border',
                  !pack.active && 'opacity-50'
                )}
              >
                {/* Order */}
                <span className="text-xs text-muted w-6 shrink-0 text-center hidden sm:block">{pack.display_order}</span>

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
                    {pack.credits === null ? 'Unlimited' : `${pack.credits} credit${pack.credits !== 1 ? 's' : ''}`} · {pack.validity_days} days · {cs}{pack.price_thb.toLocaleString()}
                  </p>
                  {pack.stripe_price_id ? (
                    <a
                      href={pack.stripe_product_id
                        ? `https://dashboard.stripe.com/products/${pack.stripe_product_id}`
                        : `https://dashboard.stripe.com/search#query=${pack.stripe_price_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-green-400/70 hover:text-green-400 mt-0.5 font-mono inline-flex items-center gap-1"
                    >
                      Stripe Product Linked
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  ) : (
                    <p className="text-[10px] text-red-400/70 mt-0.5">No Stripe product linked</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={pack.active}
                    onCheckedChange={() => handleToggleActive(pack)}
                  />
                  <Button
                    variant="outline"
                    className="text-xs h-7 px-2"
                    onClick={() => startEdit(pack)}
                    disabled={editingId !== null}
                  >
                    Edit
                  </Button>
                  <button
                    onClick={() => setDeleteDialog(pack)}
                    className="text-muted hover:text-red-400 transition-colors p-1"
                    title="Delete pack"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}

          {/* Inline create form or Add button */}
          {editingId === 'new' ? (
            <div className={cn(
              packs.length > 0 && 'border-t border-card-border',
              'border-l-2 border-l-accent'
            )}>
              <InlinePackForm
                form={form}
                setForm={setForm}
                onSave={handleSave}
                onCancel={cancelEdit}
                submitting={submitting}
                theme={theme}
                cs={cs}
              />
            </div>
          ) : (
            <button
              onClick={startCreate}
              disabled={editingId !== null}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-4 py-3 text-sm text-muted',
                'border-t border-dashed border-card-border',
                'hover:text-accent hover:bg-card/50 transition-colors',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              <Plus className="w-4 h-4" />
              Add pack
            </button>
          )}
        </div>
      )}

      {/* Promo Codes Guide */}
      <div className="mt-8 border border-card-border rounded-lg bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-foreground">Promo Codes</h2>
        </div>
        <p className="text-sm text-muted mb-3">
          Promo codes are managed through your Stripe Dashboard. When a customer checks out, they can enter a promo code to get a discount.
        </p>
        <div className="space-y-2 text-sm text-muted">
          <div className="flex items-start gap-2">
            <span className="text-accent font-bold mt-0.5 shrink-0">1.</span>
            <span>Go to your <a href="https://dashboard.stripe.com/coupons" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Stripe Dashboard &rarr; Coupons</a></span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-accent font-bold mt-0.5 shrink-0">2.</span>
            <span>Click <strong className="text-foreground">&quot;+ New&quot;</strong> to create a coupon (e.g. 20% off, or a fixed amount off)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-accent font-bold mt-0.5 shrink-0">3.</span>
            <span>Under the coupon, click <strong className="text-foreground">&quot;Add promotion code&quot;</strong> to create a customer-facing code (e.g. <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded text-xs">WELCOME20</code>)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-accent font-bold mt-0.5 shrink-0">4.</span>
            <span>Set limits: max redemptions, first-time customers only, specific products, expiry date</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-accent font-bold mt-0.5 shrink-0">5.</span>
            <span>Share the code with your members — they&apos;ll see a <strong className="text-foreground">&quot;Add promotion code&quot;</strong> field on the checkout page</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-card-border">
          <p className="text-xs text-muted">
            All promo code usage, redemptions, and revenue impact are tracked automatically in your Stripe Dashboard under Coupons &rarr; Promotion Codes.
          </p>
        </div>
      </div>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent className="sm:max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Delete Pack</DialogTitle>
            <DialogDescription>
              Permanently delete &quot;{deleteDialog?.name}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => handleDelete(deleteDialog)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
