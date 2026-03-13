'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { X, Upload, Trash2, ImageIcon } from 'lucide-react'
import Image from 'next/image'

const COLOR_OPTIONS = [
  { label: 'Gold', value: '#c8a750' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Teal', value: '#14b8a6' },
]

export default function ClassTypesPage() {
  const [classTypes, setClassTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [addDialog, setAddDialog] = useState(false)
  const [editDialog, setEditDialog] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', duration_mins: 60, color: '#c8a750', icon: '', is_private: false, image_url: null })
  const [imageFile, setImageFile] = useState(null) // pending upload
  const [imagePreview, setImagePreview] = useState(null) // local preview URL
  const [uploadingImage, setUploadingImage] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(null)
  const [fetchError, setFetchError] = useState(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  async function fetchClassTypes() {
    setFetchError(null)
    try {
      const res = await fetch('/api/admin/class-types')
      if (res.ok) {
        const data = await res.json()
        setClassTypes(data.classTypes || [])
      } else {
        setFetchError('Failed to load class types')
      }
    } catch (err) {
      console.error('Failed to fetch class types:', err)
      setFetchError('Unable to connect. Check your internet and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchClassTypes() }, [])

  function openAdd() {
    setForm({ name: '', description: '', duration_mins: 60, color: '#c8a750', icon: '', is_private: false, image_url: null })
    setImageFile(null)
    setImagePreview(null)
    setAddDialog(true)
  }

  function openEdit(ct) {
    setForm({
      name: ct.name,
      description: ct.description || '',
      duration_mins: ct.duration_mins || 60,
      color: ct.color || '#c8a750',
      icon: ct.icon || '',
      is_private: ct.is_private || false,
      image_url: ct.image_url || null,
    })
    setImageFile(null)
    setImagePreview(null)
    setEditDialog(ct)
  }

  async function handleCreate() {
    if (!form.name.trim()) { setToast({ message: 'Name is required', type: 'error' }); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/class-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          duration_mins: form.duration_mins,
          color: form.color,
          icon: form.icon || undefined,
          is_private: form.is_private,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setToast({ message: data.error || 'Failed to create', type: 'error' }); return }
      // Upload image if selected
      if (imageFile && data.classType?.id) {
        await uploadClassImage(data.classType.id, imageFile)
      }
      setToast({ message: `"${data.classType.name}" created`, type: 'success' })
      setAddDialog(false)
      setImageFile(null)
      setImagePreview(null)
      fetchClassTypes()
    } catch {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  async function uploadClassImage(classTypeId, file) {
    const fd = new FormData()
    fd.append('image', file)
    fd.append('classTypeId', classTypeId)
    try {
      const res = await fetch('/api/admin/class-types/image', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json()
        setToast({ message: data.error || 'Image upload failed', type: 'error' })
      }
    } catch {
      setToast({ message: 'Image upload failed', type: 'error' })
    }
  }

  async function deleteClassImage(classTypeId) {
    try {
      const res = await fetch('/api/admin/class-types/image', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classTypeId }),
      })
      if (res.ok) {
        setForm((f) => ({ ...f, image_url: null }))
        setToast({ message: 'Image removed', type: 'success' })
        fetchClassTypes()
      }
    } catch {
      setToast({ message: 'Failed to remove image', type: 'error' })
    }
  }

  async function handleUpdate() {
    if (!editDialog || !form.name.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/class-types', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editDialog.id,
          name: form.name,
          description: form.description || null,
          duration_mins: form.duration_mins,
          color: form.color,
          icon: form.icon || null,
          is_private: form.is_private,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setToast({ message: data.error || 'Failed to update', type: 'error' }); return }
      // Upload new image if selected
      if (imageFile) {
        await uploadClassImage(editDialog.id, imageFile)
      }
      setToast({ message: `"${data.classType.name}" updated`, type: 'success' })
      setEditDialog(null)
      setImageFile(null)
      setImagePreview(null)
      fetchClassTypes()
    } catch {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(ct) {
    setDeleteDialog(null)
    try {
      const res = await fetch('/api/admin/class-types', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ct.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ message: data.error || 'Failed to delete', type: 'error' })
        return
      }
      setToast({ message: `"${ct.name}" deleted`, type: 'success' })
      fetchClassTypes()
    } catch {
      setToast({ message: 'Something went wrong', type: 'error' })
    }
  }

  async function toggleActive(ct) {
    try {
      const res = await fetch('/api/admin/class-types', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ct.id, active: !ct.active }),
      })
      if (res.ok) {
        setToast({ message: `"${ct.name}" ${ct.active ? 'deactivated' : 'activated'}`, type: 'success' })
        fetchClassTypes()
      }
    } catch {
      setToast({ message: 'Something went wrong', type: 'error' })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Events</h1>
        <Button onClick={openAdd}>+ New Event</Button>
      </div>

      {toast && (
        <div className={cn('mb-6 px-4 py-3 rounded-lg border flex items-center justify-between', toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400')}>
          <span className="text-sm">{toast.message}</span>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {fetchError && !loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-400 font-medium">{fetchError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={fetchClassTypes}>Retry</Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-card border border-card-border rounded-lg animate-pulse" />)}
        </div>
      ) : classTypes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted text-sm">No class types yet. Create your first one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classTypes.map((ct) => (
            <button
              key={ct.id}
              onClick={() => openEdit(ct)}
              className={cn(
                'text-left rounded-lg border border-card-border bg-card hover:bg-white/[0.04] transition-colors overflow-hidden group',
                !ct.active && 'opacity-50'
              )}
            >
              {/* Image or gradient header */}
              <div className="relative h-24 overflow-hidden" style={{ backgroundColor: ct.color ? `${ct.color}15` : '#c8a75015' }}>
                {ct.image_url ? (
                  <Image src={ct.image_url} alt={ct.name} fill className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${ct.color || '#c8a750'}25` }}>
                      {ct.icon ? (
                        <span className="text-lg">{ct.icon}</span>
                      ) : (
                        <ImageIcon className="w-5 h-5" style={{ color: ct.color || '#c8a750' }} />
                      )}
                    </div>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent" />
              </div>
              <div className="p-3 pt-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {ct.icon && <span className="text-base">{ct.icon}</span>}
                      <h3 className="text-sm font-semibold text-foreground truncate">{ct.name}</h3>
                    </div>
                    {ct.description && (
                      <p className="text-xs text-muted mt-1 line-clamp-2">{ct.description}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {ct.is_private && (
                      <Badge className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20">Private</Badge>
                    )}
                    {!ct.active && (
                      <Badge variant="outline" className="text-[10px]">Inactive</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                  <span>{ct.duration_mins} min</span>
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: ct.color || '#c8a750' }} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={addDialog} onOpenChange={(open) => !open && setAddDialog(false)}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>New Class Type</DialogTitle>
            <DialogDescription>Create a new type of class that can be scheduled.</DialogDescription>
          </DialogHeader>
          <ClassTypeForm form={form} setForm={setForm} imagePreview={imagePreview} onImageSelect={(file) => {
            setImageFile(file)
            setImagePreview(file ? URL.createObjectURL(file) : null)
          }} />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAddDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting}>{submitting ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent className="sm:max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Delete Class Type</DialogTitle>
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

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Edit Class Type</DialogTitle>
            <DialogDescription>Update {editDialog?.name}</DialogDescription>
          </DialogHeader>
          <ClassTypeForm form={form} setForm={setForm} imagePreview={imagePreview} onImageSelect={(file) => {
            setImageFile(file)
            setImagePreview(file ? URL.createObjectURL(file) : null)
          }} onImageDelete={editDialog?.image_url ? () => deleteClassImage(editDialog.id) : null} />
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editDialog && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className={editDialog.active ? 'text-red-400 border-red-400/30 hover:bg-red-400/10' : 'text-green-400 border-green-400/30 hover:bg-green-400/10'}
                  onClick={() => { toggleActive(editDialog); setEditDialog(null) }}
                >
                  {editDialog.active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  variant="outline"
                  className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                  onClick={() => { setEditDialog(null); setDeleteDialog(editDialog) }}
                >
                  Delete
                </Button>
              </div>
            )}
            <div className="flex gap-2 sm:ml-auto">
              <Button variant="outline" onClick={() => setEditDialog(null)}>Cancel</Button>
              <Button onClick={handleUpdate} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ClassTypeForm({ form, setForm, imagePreview, onImageSelect, onImageDelete }) {
  const displayImage = imagePreview || form.image_url

  return (
    <div className="space-y-4 py-2">
      {/* Image upload */}
      <div>
        <Label>Image (optional)</Label>
        <div className="mt-1.5">
          {displayImage ? (
            <div className="relative rounded-lg overflow-hidden h-32 bg-card border border-card-border group">
              <Image src={displayImage} alt="Preview" fill className="object-cover" sizes="400px" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <label className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-white" />
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) onImageSelect(f)
                  }} />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    onImageSelect(null)
                    if (onImageDelete) onImageDelete()
                  }}
                  className="w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-24 rounded-lg border-2 border-dashed border-card-border/60 hover:border-accent/30 bg-background/30 cursor-pointer transition-colors">
              <Upload className="w-5 h-5 text-muted mb-1" />
              <span className="text-xs text-muted">Click to upload image</span>
              <span className="text-[10px] text-muted/60">JPEG, PNG, WebP — max 5MB</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onImageSelect(f)
              }} />
            </label>
          )}
        </div>
      </div>
      <div>
        <Label htmlFor="ct-name">Name</Label>
        <Input id="ct-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Boxing Fundamentals" className="mt-1" />
      </div>
      <div>
        <Label htmlFor="ct-desc">Description (optional)</Label>
        <textarea
          id="ct-desc"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Brief description of this class type"
          rows={2}
          className="mt-1 w-full rounded-lg bg-background/50 border border-card-border/60 px-3.5 py-2 text-sm text-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/30 resize-none"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="ct-duration">Duration (mins)</Label>
          <Input id="ct-duration" type="number" min={1} max={300} value={form.duration_mins} onChange={(e) => setForm((f) => ({ ...f, duration_mins: parseInt(e.target.value) || 60 }))} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="ct-icon">Icon (optional)</Label>
          <Input id="ct-icon" value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} placeholder="e.g. 🥊" className="mt-1" />
        </div>
      </div>
      <div>
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, color: c.value }))}
              className={cn(
                'w-8 h-8 rounded-full border-2 transition-all',
                form.color === c.value ? 'border-foreground scale-110' : 'border-transparent hover:border-card-border'
              )}
              style={{ backgroundColor: c.value }}
              title={c.label}
            />
          ))}
        </div>
      </div>
      <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-card-border">
        <input
          type="checkbox"
          checked={form.is_private}
          onChange={(e) => setForm((f) => ({ ...f, is_private: e.target.checked }))}
          className="w-4 h-4 rounded border-card-border bg-card accent-accent"
        />
        <div>
          <span className="text-sm text-foreground">Private class type</span>
          <p className="text-xs text-muted">Private classes won&apos;t appear on the public schedule. Only admin can add members.</p>
        </div>
      </label>
    </div>
  )
}
