'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Plus, Clock, MapPin, User, Trash2, RefreshCw } from 'lucide-react'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const selectClass = 'mt-1.5 w-full rounded-md bg-background border border-card-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent'

export default function AdminAvailabilityPage() {
  const [availability, setAvailability] = useState([])
  const [instructors, setInstructors] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [toast, setToast] = useState(null)

  // Filter
  const [filterInstructor, setFilterInstructor] = useState('')

  // Dialog
  const [dialog, setDialog] = useState(null) // 'create' | availability object
  const [form, setForm] = useState({
    instructorId: '', locationId: '', zoneId: '', dayOfWeek: 1,
    startTime: '09:00', endTime: '17:00', sessionDuration: 60,
    concurrentSlots: 1, creditsCost: 1,
  })
  const [submitting, setSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  async function fetchData() {
    setFetchError(null)
    try {
      const params = filterInstructor ? `?instructorId=${filterInstructor}` : ''
      const [availRes, optionsRes] = await Promise.all([
        fetch(`/api/admin/availability${params}`),
        fetch('/api/admin/schedule/options'),
      ])
      if (availRes.ok) {
        const data = await availRes.json()
        setAvailability(data.availability || [])
      } else {
        setFetchError('Failed to load availability')
      }
      if (optionsRes.ok) {
        const data = await optionsRes.json()
        setInstructors(data.instructors || [])
        setLocations(data.locations || [])
      }
    } catch {
      setFetchError('Unable to connect. Check your internet and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [filterInstructor])

  function openCreate() {
    setForm({
      instructorId: instructors[0]?.id || '', locationId: '', zoneId: '', dayOfWeek: 1,
      startTime: '09:00', endTime: '17:00', sessionDuration: 60,
      concurrentSlots: 1, creditsCost: 1,
    })
    setDialog('create')
  }

  function openEdit(avail) {
    setForm({
      instructorId: avail.instructor_id,
      locationId: avail.location_id || '',
      zoneId: avail.zone_id || '',
      dayOfWeek: avail.day_of_week,
      startTime: avail.start_time?.slice(0, 5) || '09:00',
      endTime: avail.end_time?.slice(0, 5) || '17:00',
      sessionDuration: avail.session_duration,
      concurrentSlots: avail.concurrent_slots,
      creditsCost: avail.credits_cost,
    })
    setDialog(avail)
  }

  async function handleSave() {
    if (!form.instructorId) return
    // Client-side time validation
    if (form.endTime <= form.startTime) {
      setToast({ message: 'End time must be after start time', type: 'error' })
      return
    }
    const [sh, sm] = form.startTime.split(':').map(Number)
    const [eh, em] = form.endTime.split(':').map(Number)
    const windowMins = (eh * 60 + em) - (sh * 60 + sm)
    if (form.sessionDuration > windowMins) {
      setToast({ message: `Session duration (${form.sessionDuration}min) exceeds the time window (${windowMins}min)`, type: 'error' })
      return
    }
    setSubmitting(true)
    try {
      const isCreate = dialog === 'create'
      const payload = {
        instructorId: form.instructorId,
        locationId: form.locationId || null,
        zoneId: form.zoneId || null,
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        sessionDuration: form.sessionDuration,
        concurrentSlots: form.concurrentSlots,
        creditsCost: form.creditsCost,
      }
      const res = await fetch('/api/admin/availability', {
        method: isCreate ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isCreate ? payload : { id: dialog.id, ...payload }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ message: data.error || 'Failed to save', type: 'error' })
        return
      }
      setToast({ message: isCreate ? 'Availability created' : 'Availability updated', type: 'success' })
      setDialog(null)
      fetchData()
    } catch {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const [deleting, setDeleting] = useState(false)

  async function handleDelete(id) {
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/availability', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const data = await res.json()
        setToast({ message: data.error || 'Failed to delete', type: 'error' })
        return
      }
      setToast({ message: 'Availability window deleted', type: 'success' })
      setDeleteConfirm(null)
      fetchData()
    } catch {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  async function handleToggleActive(avail) {
    const res = await fetch('/api/admin/availability', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: avail.id, isActive: !avail.is_active }),
    })
    if (!res.ok) {
      const data = await res.json()
      setToast({ message: data.error || 'Failed to update', type: 'error' })
      return
    }
    fetchData()
  }

  // Get zones for a location
  const getZones = (locationId) => {
    const loc = locations.find((l) => l.id === locationId)
    return (loc?.zones || []).filter((z) => z.is_active)
  }

  // Group by instructor for display
  const byInstructor = {}
  availability.forEach((a) => {
    const key = a.instructor_id
    if (!byInstructor[key]) byInstructor[key] = { instructor: a.instructors, windows: [] }
    byInstructor[key].windows.push(a)
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Appointment Availability</h1>
          <p className="text-sm text-muted mt-1">Set when instructors are available for 1:1 appointments</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Availability
        </Button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={cn(
          'px-4 py-3 rounded-lg text-sm',
          toast.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'
        )}>
          {toast.message}
        </div>
      )}

      {/* Filter */}
      {instructors.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setFilterInstructor('')} className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap', !filterInstructor ? 'bg-accent text-background' : 'bg-card border border-card-border text-muted hover:text-foreground')}>All</button>
          {instructors.map((inst) => (
            <button key={inst.id} onClick={() => setFilterInstructor(inst.id)} className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap', filterInstructor === inst.id ? 'bg-accent text-background' : 'bg-card border border-card-border text-muted hover:text-foreground')}>{inst.name}</button>
          ))}
        </div>
      )}

      {/* Error */}
      {fetchError && (
        <div className="bg-card border border-card-border rounded-lg p-8 text-center">
          <p className="text-red-400 mb-4">{fetchError}</p>
          <Button variant="outline" onClick={fetchData} className="gap-2"><RefreshCw className="w-4 h-4" /> Retry</Button>
        </div>
      )}

      {/* Loading */}
      {loading && !fetchError && (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="bg-card border border-card-border rounded-lg p-5 animate-pulse"><div className="h-5 w-48 bg-card-border rounded" /></div>)}
        </div>
      )}

      {/* Empty */}
      {!loading && !fetchError && availability.length === 0 && (
        <div className="bg-card border border-card-border rounded-lg p-12 text-center">
          <Clock className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-foreground font-medium mb-1">No availability windows</p>
          <p className="text-sm text-muted mb-4">Add recurring availability for instructors so members can book appointments</p>
          <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Add Availability</Button>
        </div>
      )}

      {/* Availability list grouped by instructor */}
      {!loading && !fetchError && Object.entries(byInstructor).map(([instrId, { instructor, windows }]) => (
        <div key={instrId} className="bg-card border border-card-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-card-border/50 flex items-center gap-2">
            <User className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-foreground">{instructor?.name || 'Instructor'}</h3>
            <span className="text-xs text-muted">({windows.length} window{windows.length !== 1 ? 's' : ''})</span>
          </div>

          {/* Weekly grid visualization */}
          <div className="p-4">
            <div className="grid grid-cols-7 gap-1 mb-3">
              {SHORT_DAYS.map((day) => (
                <div key={day} className="text-center text-[10px] text-muted font-medium">{day}</div>
              ))}
              {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
                const dayWindows = windows.filter((w) => w.day_of_week === dow && w.is_active)
                return (
                  <div key={dow} className={cn('text-center py-1.5 rounded text-[10px]', dayWindows.length > 0 ? 'bg-accent/15 text-accent font-medium' : 'bg-background text-muted/30')}>
                    {dayWindows.length > 0 ? `${dayWindows.length}` : '-'}
                  </div>
                )
              })}
            </div>

            {/* Window details */}
            <div className="space-y-2">
              {windows.map((w) => (
                <div key={w.id} className={cn('flex items-center justify-between py-2 px-3 rounded-md border', w.is_active ? 'bg-background/50 border-card-border/50' : 'bg-background/30 border-card-border/30 opacity-50')}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-semibold text-accent w-8">{SHORT_DAYS[w.day_of_week]}</span>
                    <span className="text-sm text-foreground">{w.start_time?.slice(0, 5)} - {w.end_time?.slice(0, 5)}</span>
                    <span className="text-xs text-muted">{w.session_duration}min</span>
                    {w.concurrent_slots > 1 && <span className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded">{w.concurrent_slots} concurrent</span>}
                    {w.credits_cost === 0 && <span className="text-[10px] px-1.5 py-0.5 bg-green-500/15 text-green-400 rounded">Free</span>}
                    {w.credits_cost > 1 && <span className="text-[10px] text-muted/60">{w.credits_cost} credits</span>}
                    {w.locations?.name && (
                      <span className="text-[10px] text-muted/60 flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" />{w.locations.name}
                        {w.zones?.name && <span> &middot; {w.zones.name}</span>}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={w.is_active} onCheckedChange={() => handleToggleActive(w)} />
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(w)}>Edit</Button>
                    <button onClick={() => setDeleteConfirm(w.id)} className="text-red-400/50 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* Create/Edit Dialog */}
      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === 'create' ? 'Add Availability Window' : 'Edit Availability Window'}</DialogTitle>
            <DialogDescription>Set a recurring weekly availability window for an instructor</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Instructor *</Label>
              <select value={form.instructorId} onChange={(e) => setForm((f) => ({ ...f, instructorId: e.target.value }))} className={selectClass} disabled={dialog !== 'create'}>
                <option value="">Select instructor</option>
                {instructors.map((inst) => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Day of Week *</Label>
              <select value={form.dayOfWeek} onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: parseInt(e.target.value) }))} className={selectClass}>
                {DAY_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Time</Label>
                <Input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} className="mt-1.5" />
              </div>
              <div>
                <Label>End Time</Label>
                <Input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} className="mt-1.5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Session Duration (min)</Label>
                <Input type="number" min={15} max={480} step={15} value={form.sessionDuration} onChange={(e) => setForm((f) => ({ ...f, sessionDuration: parseInt(e.target.value) || 60 }))} className="mt-1.5" />
              </div>
              <div>
                <Label>Concurrent Slots</Label>
                <Input type="number" min={1} max={100} value={form.concurrentSlots} onChange={(e) => setForm((f) => ({ ...f, concurrentSlots: parseInt(e.target.value) || 1 }))} className="mt-1.5" />
                <p className="text-[10px] text-muted/50 mt-1">e.g. 10 masseuses = 10 concurrent</p>
              </div>
            </div>
            <div>
              <Label>Credits Cost</Label>
              <Input type="number" min={0} max={10} value={form.creditsCost} onChange={(e) => setForm((f) => ({ ...f, creditsCost: parseInt(e.target.value) || 0 }))} className="mt-1.5 w-24" />
              <p className="text-[10px] text-muted/50 mt-1">0 = free appointment</p>
            </div>
            {locations.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Location</Label>
                  <select value={form.locationId} onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value, zoneId: '' }))} className={selectClass}>
                    <option value="">No location</option>
                    {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Zone</Label>
                  <select value={form.zoneId} onChange={(e) => setForm((f) => ({ ...f, zoneId: e.target.value }))} className={selectClass} disabled={!getZones(form.locationId).length}>
                    <option value="">None</option>
                    {getZones(form.locationId).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting || !form.instructorId}>
              {submitting ? 'Saving...' : dialog === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Availability Window</DialogTitle>
            <DialogDescription>This will remove this recurring availability. Existing appointments will not be affected.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleDelete(deleteConfirm)} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
