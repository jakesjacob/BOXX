'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { X, Check, Plus, ChevronDown, ChevronRight, MapPin, Layers, User } from 'lucide-react'

// ─── Shared mock data & helpers ────────────────────────────────
const MOCK_INSTRUCTORS = [
  { id: '1', name: 'Sarah Chen', bio: 'Yoga & Pilates specialist, 8 years experience', active: true, photo_url: null },
  { id: '2', name: 'Mike Torres', bio: 'Boxing coach, former amateur champion', active: true, photo_url: null },
  { id: '3', name: 'Aisha Patel', bio: 'HIIT and strength training', active: false, photo_url: null },
]

const MOCK_LOCATIONS = [
  {
    id: '1', name: 'Main Studio', address: '123 Sukhumvit Rd', city: 'Bangkok', country: 'Thailand',
    is_active: true, zones: [
      { id: 'z1', name: 'Ring A', capacity: 12, is_active: true },
      { id: 'z2', name: 'Studio 2', capacity: 20, is_active: true },
    ],
  },
  {
    id: '2', name: 'Thonglor Branch', address: '55 Thonglor Soi 10', city: 'Bangkok', country: 'Thailand',
    is_active: true, zones: [],
  },
]

function Avatar({ name }) {
  return (
    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
      <span className="text-accent text-sm font-medium">{name?.[0]?.toUpperCase() || '?'}</span>
    </div>
  )
}

function Toast({ toast, onDismiss }) {
  if (!toast) return null
  return (
    <div className={cn(
      'fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 px-4 py-3 rounded-lg border flex items-center gap-3 shadow-lg backdrop-blur-sm sm:max-w-sm transition-all',
      toast.type === 'error'
        ? 'bg-red-500/10 border-red-500/20 text-red-400'
        : 'bg-green-500/10 border-green-500/20 text-green-400'
    )}>
      <span className="text-sm flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100 shrink-0"><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PATTERN A: Dialog (Current)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function PatternDialog() {
  const [items, setItems] = useState(MOCK_INSTRUCTORS)
  const [dialog, setDialog] = useState(null)
  const [form, setForm] = useState({ name: '', bio: '' })
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  function openCreate() {
    setForm({ name: '', bio: '' })
    setDialog('create')
  }

  function openEdit(item) {
    setForm({ name: item.name, bio: item.bio || '' })
    setDialog(item)
  }

  function handleSave() {
    if (!form.name.trim()) return
    if (dialog === 'create') {
      setItems((prev) => [...prev, { id: Date.now().toString(), name: form.name, bio: form.bio, active: true, photo_url: null }])
      setToast({ message: 'Instructor added', type: 'success' })
    } else {
      setItems((prev) => prev.map((i) => i.id === dialog.id ? { ...i, name: form.name, bio: form.bio } : i))
      setToast({ message: 'Instructor updated', type: 'success' })
    }
    setDialog(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Instructors</h3>
          <p className="text-xs text-muted mt-0.5">Manage your team</p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add
        </Button>
      </div>

      <div className="space-y-2">
        {items.map((inst) => (
          <button
            key={inst.id}
            onClick={() => openEdit(inst)}
            className={cn(
              'w-full text-left border border-card-border rounded-lg p-3 transition-colors hover:bg-white/[0.03]',
              !inst.active && 'opacity-50'
            )}
          >
            <div className="flex items-center gap-3">
              <Avatar name={inst.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{inst.name}</p>
                {inst.bio && <p className="text-xs text-muted truncate mt-0.5">{inst.bio}</p>}
              </div>
              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                <Switch
                  checked={inst.active}
                  onCheckedChange={() => setItems((prev) => prev.map((i) => i.id === inst.id ? { ...i, active: !i.active } : i))}
                />
              </div>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{dialog === 'create' ? 'Add Instructor' : 'Edit Instructor'}</DialogTitle>
            <DialogDescription>
              {dialog === 'create' ? 'Add a new instructor to your team.' : `Editing ${form.name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1" autoFocus />
            </div>
            <div>
              <Label>Bio</Label>
              <Input value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} placeholder="Short bio..." className="mt-1" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>
              {dialog === 'create' ? 'Add Instructor' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PATTERN B: Inline Row Creation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function PatternInline() {
  const [items, setItems] = useState(MOCK_INSTRUCTORS)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null) // id of item being edited
  const [form, setForm] = useState({ name: '', bio: '' })
  const [toast, setToast] = useState(null)
  const nameRef = useRef(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (adding && nameRef.current) {
      nameRef.current.focus()
    }
  }, [adding])

  function startAdd() {
    setEditing(null)
    setForm({ name: '', bio: '' })
    setAdding(true)
  }

  function startEdit(item) {
    setAdding(false)
    setForm({ name: item.name, bio: item.bio || '' })
    setEditing(item.id)
  }

  function cancelAll() {
    setAdding(false)
    setEditing(null)
    setForm({ name: '', bio: '' })
  }

  function handleSaveNew() {
    if (!form.name.trim()) return
    setItems((prev) => [...prev, { id: Date.now().toString(), name: form.name, bio: form.bio, active: true, photo_url: null }])
    setToast({ message: 'Instructor added', type: 'success' })
    setForm({ name: '', bio: '' })
    setAdding(false)
  }

  function handleSaveEdit() {
    if (!form.name.trim()) return
    setItems((prev) => prev.map((i) => i.id === editing ? { ...i, name: form.name, bio: form.bio } : i))
    setToast({ message: 'Instructor updated', type: 'success' })
    setEditing(null)
  }

  function handleKeyDown(e, mode) {
    if (e.key === 'Enter' && form.name.trim()) {
      mode === 'add' ? handleSaveNew() : handleSaveEdit()
    }
    if (e.key === 'Escape') cancelAll()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Instructors</h3>
          <p className="text-xs text-muted mt-0.5">Manage your team</p>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((inst) => (
          editing === inst.id ? (
            // ─── Inline edit row ───
            <div key={inst.id} className="border border-accent/30 rounded-lg p-3 bg-accent/[0.03] transition-all">
              <div className="flex items-center gap-3">
                <Avatar name={form.name || inst.name} />
                <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-2">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    onKeyDown={(e) => handleKeyDown(e, 'edit')}
                    placeholder="Name"
                    className="flex-1"
                    autoFocus
                  />
                  <Input
                    value={form.bio}
                    onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                    onKeyDown={(e) => handleKeyDown(e, 'edit')}
                    placeholder="Bio (optional)"
                    className="flex-1"
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={handleSaveEdit}
                    disabled={!form.name.trim()}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-green-400 hover:bg-green-400/10 transition-colors disabled:opacity-30"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelAll}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:bg-white/5 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-muted mt-2 ml-[52px]">Enter to save · Esc to cancel</p>
            </div>
          ) : (
            // ─── Normal row ───
            <button
              key={inst.id}
              onClick={() => startEdit(inst)}
              className={cn(
                'w-full text-left border border-card-border rounded-lg p-3 transition-colors hover:bg-white/[0.03]',
                !inst.active && 'opacity-50'
              )}
            >
              <div className="flex items-center gap-3">
                <Avatar name={inst.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{inst.name}</p>
                  {inst.bio && <p className="text-xs text-muted truncate mt-0.5">{inst.bio}</p>}
                </div>
                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={inst.active}
                    onCheckedChange={() => setItems((prev) => prev.map((i) => i.id === inst.id ? { ...i, active: !i.active } : i))}
                  />
                </div>
              </div>
            </button>
          )
        ))}

        {/* ─── Inline add row ─── */}
        {adding ? (
          <div className="border border-dashed border-accent/40 rounded-lg p-3 bg-accent/[0.02] transition-all animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-dashed border-accent/30 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-accent/50" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-2">
                <Input
                  ref={nameRef}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  onKeyDown={(e) => handleKeyDown(e, 'add')}
                  placeholder="Instructor name"
                  className="flex-1"
                />
                <Input
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  onKeyDown={(e) => handleKeyDown(e, 'add')}
                  placeholder="Bio (optional)"
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={handleSaveNew}
                  disabled={!form.name.trim()}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-green-400 hover:bg-green-400/10 transition-colors disabled:opacity-30"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={cancelAll}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:bg-white/5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-muted mt-2 ml-[52px]">Enter to save · Esc to cancel</p>
          </div>
        ) : (
          <button
            onClick={startAdd}
            className="w-full border border-dashed border-card-border rounded-lg p-3 text-sm text-muted hover:text-foreground hover:border-accent/30 hover:bg-accent/[0.02] transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Add instructor
          </button>
        )}
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PATTERN C: Expandable Panel (bottom of list)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function PatternPanel() {
  const [items, setItems] = useState(MOCK_INSTRUCTORS)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelMode, setPanelMode] = useState('create') // 'create' | item id
  const [form, setForm] = useState({ name: '', bio: '' })
  const [toast, setToast] = useState(null)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (panelOpen && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [panelOpen])

  function openCreate() {
    setForm({ name: '', bio: '' })
    setPanelMode('create')
    setPanelOpen(true)
  }

  function openEdit(item) {
    setForm({ name: item.name, bio: item.bio || '' })
    setPanelMode(item.id)
    setPanelOpen(true)
  }

  function handleSave() {
    if (!form.name.trim()) return
    if (panelMode === 'create') {
      setItems((prev) => [...prev, { id: Date.now().toString(), name: form.name, bio: form.bio, active: true, photo_url: null }])
      setToast({ message: 'Instructor added', type: 'success' })
    } else {
      setItems((prev) => prev.map((i) => i.id === panelMode ? { ...i, name: form.name, bio: form.bio } : i))
      setToast({ message: 'Instructor updated', type: 'success' })
    }
    setPanelOpen(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Instructors</h3>
          <p className="text-xs text-muted mt-0.5">Manage your team</p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5" disabled={panelOpen && panelMode === 'create'}>
          <Plus className="w-3.5 h-3.5" /> Add
        </Button>
      </div>

      <div className="space-y-2">
        {items.map((inst) => (
          <button
            key={inst.id}
            onClick={() => openEdit(inst)}
            className={cn(
              'w-full text-left border rounded-lg p-3 transition-all',
              panelOpen && panelMode === inst.id
                ? 'border-accent/30 bg-accent/[0.03]'
                : 'border-card-border hover:bg-white/[0.03]',
              !inst.active && 'opacity-50'
            )}
          >
            <div className="flex items-center gap-3">
              <Avatar name={inst.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{inst.name}</p>
                {inst.bio && <p className="text-xs text-muted truncate mt-0.5">{inst.bio}</p>}
              </div>
              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                <Switch
                  checked={inst.active}
                  onCheckedChange={() => setItems((prev) => prev.map((i) => i.id === inst.id ? { ...i, active: !i.active } : i))}
                />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Expandable panel */}
      <div
        ref={panelRef}
        className={cn(
          'overflow-hidden transition-all duration-300 ease-out',
          panelOpen ? 'max-h-[500px] opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'
        )}
      >
        <div className="border border-accent/20 rounded-lg bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-foreground">
              {panelMode === 'create' ? 'New Instructor' : 'Edit Instructor'}
            </h4>
            <button onClick={() => setPanelOpen(false)} className="text-muted hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Instructor name"
                className="mt-1"
                autoFocus={panelOpen}
              />
            </div>
            <div>
              <Label className="text-xs">Bio</Label>
              <Input
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="Short bio..."
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-card-border">
            <Button variant="outline" size="sm" onClick={() => setPanelOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!form.name.trim()}>
              {panelMode === 'create' ? 'Add Instructor' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PATTERN D: Inline Row for Locations (complex entity)
// Shows how inline works with more fields + nested zones
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function PatternInlineLocations() {
  const [locations, setLocations] = useState(MOCK_LOCATIONS)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', city: '' })
  const [expanded, setExpanded] = useState(new Set())
  const [addingZone, setAddingZone] = useState(null) // location id
  const [zoneForm, setZoneForm] = useState({ name: '', capacity: '' })
  const [toast, setToast] = useState(null)
  const nameRef = useRef(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (adding && nameRef.current) nameRef.current.focus()
  }, [adding])

  function handleAddLocation() {
    if (!form.name.trim()) return
    const newLoc = {
      id: Date.now().toString(),
      name: form.name,
      address: form.address,
      city: form.city,
      country: '',
      is_active: true,
      zones: [],
    }
    setLocations((prev) => [...prev, newLoc])
    setToast({ message: 'Location created', type: 'success' })
    setForm({ name: '', address: '', city: '' })
    setAdding(false)
  }

  function handleAddZone(locId) {
    if (!zoneForm.name.trim()) return
    setLocations((prev) => prev.map((loc) => {
      if (loc.id !== locId) return loc
      return {
        ...loc,
        zones: [...loc.zones, {
          id: Date.now().toString(),
          name: zoneForm.name,
          capacity: zoneForm.capacity ? parseInt(zoneForm.capacity) : null,
          is_active: true,
        }],
      }
    }))
    setToast({ message: 'Zone added', type: 'success' })
    setZoneForm({ name: '', capacity: '' })
    setAddingZone(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Locations</h3>
          <p className="text-xs text-muted mt-0.5">With inline zone creation</p>
        </div>
      </div>

      <div className="space-y-3">
        {locations.map((loc) => {
          const isExpanded = expanded.has(loc.id)
          return (
            <div key={loc.id} className="bg-card border border-card-border rounded-lg overflow-hidden">
              <div className="p-3 flex items-start gap-3">
                <button
                  onClick={() => setExpanded((prev) => {
                    const next = new Set(prev)
                    next.has(loc.id) ? next.delete(loc.id) : next.add(loc.id)
                    return next
                  })}
                  className="mt-0.5 text-muted hover:text-foreground transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-accent shrink-0" />
                    <h4 className="font-semibold text-foreground text-sm truncate">{loc.name}</h4>
                  </div>
                  {(loc.address || loc.city) && (
                    <p className="text-xs text-muted mt-0.5 ml-6">{[loc.address, loc.city].filter(Boolean).join(', ')}</p>
                  )}
                </div>
                <Switch checked={loc.is_active} onCheckedChange={() => {
                  setLocations((prev) => prev.map((l) => l.id === loc.id ? { ...l, is_active: !l.is_active } : l))
                }} />
              </div>

              {isExpanded && (
                <div className="border-t border-card-border bg-background/30 px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between ml-7">
                    <div className="flex items-center gap-2 text-sm text-muted">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Zones</span>
                    </div>
                  </div>

                  {loc.zones.map((zone) => (
                    <div key={zone.id} className="ml-7 flex items-center justify-between py-2 px-3 rounded-md bg-card/50 border border-card-border/50">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground">{zone.name}</span>
                        <span className="text-[10px] text-muted px-1.5 py-0.5 bg-card-border/50 rounded">
                          {zone.capacity == null ? 'Unlimited' : `Cap: ${zone.capacity}`}
                        </span>
                      </div>
                      <Switch checked={zone.is_active} onCheckedChange={() => {
                        setLocations((prev) => prev.map((l) => {
                          if (l.id !== loc.id) return l
                          return { ...l, zones: l.zones.map((z) => z.id === zone.id ? { ...z, is_active: !z.is_active } : z) }
                        }))
                      }} />
                    </div>
                  ))}

                  {/* Inline zone add */}
                  {addingZone === loc.id ? (
                    <div className="ml-7 border border-dashed border-accent/30 rounded-md p-2.5 bg-accent/[0.02]">
                      <div className="flex items-center gap-2">
                        <Input
                          value={zoneForm.name}
                          onChange={(e) => setZoneForm((f) => ({ ...f, name: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && zoneForm.name.trim()) handleAddZone(loc.id)
                            if (e.key === 'Escape') setAddingZone(null)
                          }}
                          placeholder="Zone name"
                          className="flex-1 h-8 text-sm"
                          autoFocus
                        />
                        <Input
                          value={zoneForm.capacity}
                          onChange={(e) => setZoneForm((f) => ({ ...f, capacity: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && zoneForm.name.trim()) handleAddZone(loc.id)
                            if (e.key === 'Escape') setAddingZone(null)
                          }}
                          placeholder="Capacity"
                          type="number"
                          className="w-20 h-8 text-sm"
                        />
                        <button onClick={() => handleAddZone(loc.id)} disabled={!zoneForm.name.trim()} className="w-7 h-7 rounded flex items-center justify-center text-green-400 hover:bg-green-400/10 disabled:opacity-30">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setAddingZone(null)} className="w-7 h-7 rounded flex items-center justify-center text-muted hover:bg-white/5">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setZoneForm({ name: '', capacity: '' }); setAddingZone(loc.id) }}
                      className="ml-7 w-[calc(100%-1.75rem)] border border-dashed border-card-border rounded-md py-1.5 text-xs text-muted hover:text-foreground hover:border-accent/30 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3 h-3" /> Add zone
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Inline location add */}
        {adding ? (
          <div className="border border-dashed border-accent/40 rounded-lg p-3 bg-accent/[0.02] animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg border border-dashed border-accent/30 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-4 h-4 text-accent/50" />
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  ref={nameRef}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && form.name.trim()) handleAddLocation()
                    if (e.key === 'Escape') setAdding(false)
                  }}
                  placeholder="Location name"
                />
                <div className="flex gap-2">
                  <Input
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && form.name.trim()) handleAddLocation()
                      if (e.key === 'Escape') setAdding(false)
                    }}
                    placeholder="Address"
                    className="flex-1"
                  />
                  <Input
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && form.name.trim()) handleAddLocation()
                      if (e.key === 'Escape') setAdding(false)
                    }}
                    placeholder="City"
                    className="w-32"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={handleAddLocation} disabled={!form.name.trim()} className="w-8 h-8 rounded-md flex items-center justify-center text-green-400 hover:bg-green-400/10 disabled:opacity-30">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setAdding(false)} className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:bg-white/5">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-muted mt-2 ml-[52px]">Enter to save · Esc to cancel</p>
          </div>
        ) : (
          <button
            onClick={() => { setForm({ name: '', address: '', city: '' }); setAdding(true) }}
            className="w-full border border-dashed border-card-border rounded-lg p-3 text-sm text-muted hover:text-foreground hover:border-accent/30 hover:bg-accent/[0.02] transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" /> Add location
          </button>
        )}
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN PAGE: Tabbed comparison
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const TABS = [
  { id: 'dialog', label: 'A: Dialog (Current)', desc: 'Modal overlay — current pattern across all admin pages' },
  { id: 'inline', label: 'B: Inline Row', desc: 'Form appears as a row in the list — no context switch' },
  { id: 'panel', label: 'C: Expand Panel', desc: 'Form slides open below the list — stays in context' },
  { id: 'inline-complex', label: 'D: Inline (Locations)', desc: 'Inline pattern with a complex entity + nested zones' },
]

export default function UXTestPage() {
  const [activeTab, setActiveTab] = useState('dialog')

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">UX Pattern Comparison</h1>
        <p className="text-sm text-muted mt-1">
          Testing different creation patterns for admin entities. Each tab shows the same data with a different interaction model.
        </p>
      </div>

      {/* Analysis card */}
      <div className="bg-card border border-card-border rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold text-accent mb-3">Pattern Analysis</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="space-y-1.5">
            <p className="font-medium text-foreground">A: Dialog (Current)</p>
            <div className="space-y-1 text-muted">
              <p className="text-green-400/80">+ Familiar modal pattern</p>
              <p className="text-green-400/80">+ Works for any form complexity</p>
              <p className="text-green-400/80">+ Clear focus boundary</p>
              <p className="text-red-400/80">- Context switch (overlay blocks list)</p>
              <p className="text-red-400/80">- Extra clicks to open/close</p>
              <p className="text-red-400/80">- Can't compare while editing</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="font-medium text-foreground">B: Inline Row</p>
            <div className="space-y-1 text-muted">
              <p className="text-green-400/80">+ Zero context switch</p>
              <p className="text-green-400/80">+ Fastest for simple entities</p>
              <p className="text-green-400/80">+ Keyboard-first (Enter/Esc)</p>
              <p className="text-green-400/80">+ Can see other items while adding</p>
              <p className="text-red-400/80">- Struggles with many fields</p>
              <p className="text-red-400/80">- Can feel cramped on mobile</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="font-medium text-foreground">C: Expand Panel</p>
            <div className="space-y-1 text-muted">
              <p className="text-green-400/80">+ Stays in context (no overlay)</p>
              <p className="text-green-400/80">+ Room for more fields</p>
              <p className="text-green-400/80">+ Smooth animation</p>
              <p className="text-green-400/80">+ Highlights selected item</p>
              <p className="text-red-400/80">- Pushes content down</p>
              <p className="text-red-400/80">- Less discoverable than dialog</p>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-card-border">
          <p className="text-xs text-accent font-medium mb-1">Recommendation</p>
          <p className="text-xs text-muted">
            <strong className="text-foreground">Use inline (B) for simple entities</strong> (instructors, zones — 2-3 fields) and
            <strong className="text-foreground"> expand panel (C) for complex ones</strong> (locations, packs, class types — 5+ fields).
            This hybrid approach gives the fastest UX where possible while still accommodating richer forms.
            Reserve dialogs only for destructive confirmations (delete) or truly separate workflows (image upload, Stripe setup).
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
              activeTab === tab.id
                ? 'bg-accent/10 text-accent border border-accent/20'
                : 'text-muted hover:text-foreground hover:bg-white/5 border border-transparent'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab description */}
      <p className="text-xs text-muted mb-4 px-1">
        {TABS.find((t) => t.id === activeTab)?.desc}
      </p>

      {/* Tab content */}
      <div className="bg-card/30 border border-card-border rounded-xl p-4 sm:p-6">
        {activeTab === 'dialog' && <PatternDialog />}
        {activeTab === 'inline' && <PatternInline />}
        {activeTab === 'panel' && <PatternPanel />}
        {activeTab === 'inline-complex' && <PatternInlineLocations />}
      </div>

      {/* UX research notes */}
      <div className="mt-8 bg-card border border-card-border rounded-lg p-4 space-y-4">
        <h2 className="text-sm font-semibold text-accent">UX Research Notes</h2>

        <div className="space-y-3 text-xs text-muted">
          <div>
            <p className="text-foreground font-medium mb-1">Why inline beats dialogs for admin tools</p>
            <p>
              Admin users perform repetitive CRUD operations. Every dialog open/close is ~2 seconds of cognitive overhead.
              Inline creation keeps users in flow state — they see the list, add to it, and continue.
              Tools like Linear, Notion, and Airtable all favor inline creation for exactly this reason.
            </p>
          </div>

          <div>
            <p className="text-foreground font-medium mb-1">The &quot;complexity threshold&quot;</p>
            <p>
              Inline works best for 1-3 fields. Beyond that, the row gets too wide or too tall, and the advantage over a panel/dialog diminishes.
              The sweet spot: use inline for &quot;quick add&quot; (name + 1-2 optional fields), then let users click to expand/edit full details after creation.
            </p>
          </div>

          <div>
            <p className="text-foreground font-medium mb-1">Keyboard-first design</p>
            <p>
              Power users expect Enter to save and Escape to cancel. Tab between fields. These micro-interactions compound —
              an admin adding 5 instructors saves ~30 seconds compared to clicking through 5 dialog open/fill/close cycles.
            </p>
          </div>

          <div>
            <p className="text-foreground font-medium mb-1">Progressive disclosure for complex entities</p>
            <p>
              For locations (7+ fields): create inline with just the name, then expand the card to add address, timezone, buffer time, zones, etc.
              This two-step approach (&quot;quick create → rich edit&quot;) is used by Stripe Dashboard, GitHub Issues, and most modern SaaS admin tools.
            </p>
          </div>

          <div>
            <p className="text-foreground font-medium mb-1">When to keep dialogs</p>
            <p>
              Destructive actions (delete confirmations), multi-step wizards (Stripe setup), and media uploads (image cropping)
              still benefit from modal focus. The goal isn&apos;t to remove all dialogs — it&apos;s to use the right pattern for the right interaction.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
