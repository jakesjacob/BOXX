'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function AdminSchedulePage() {
  const [classes, setClasses] = useState([])
  const [classTypes, setClassTypes] = useState([])
  const [instructors, setInstructors] = useState([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [toast, setToast] = useState(null)

  // Dialog states
  const [addDialog, setAddDialog] = useState(false)
  const [editDialog, setEditDialog] = useState(null)
  const [cancelDialog, setCancelDialog] = useState(null)
  const [rosterDialog, setRosterDialog] = useState(null)
  const [notifyDialog, setNotifyDialog] = useState(null) // { classId, message }
  const [submitting, setSubmitting] = useState(false)

  // Form state for add/edit (recurring fields included)
  const [form, setForm] = useState({
    classTypeId: '', instructorId: '', date: '', startTime: '07:00', endTime: '07:55', capacity: 6, notes: '',
    recurring: false, days: [], weeks: 4, everyWeek: false,
  })

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const getWeekRange = useCallback(() => {
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7)
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)
    return { start: startOfWeek, end: endOfWeek }
  }, [weekOffset])

  const fetchClasses = useCallback(async () => {
    const { start, end } = getWeekRange()
    try {
      const res = await fetch(`/api/admin/schedule?start=${start.toISOString()}&end=${end.toISOString()}`)
      if (res.ok) {
        const data = await res.json()
        setClasses(data.classes || [])
      }
    } catch (err) {
      console.error('Failed to fetch schedule:', err)
    } finally {
      setLoading(false)
    }
  }, [getWeekRange])

  useEffect(() => {
    fetch('/api/admin/schedule/options')
      .then((res) => res.ok ? res.json() : { classTypes: [], instructors: [] })
      .then((data) => { setClassTypes(data.classTypes || []); setInstructors(data.instructors || []) })
      .catch(console.error)
  }, [])

  useEffect(() => { setLoading(true); fetchClasses() }, [fetchClasses])

  const { start: weekStart } = getWeekRange()
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d
  })
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const classesByDay = {}
  classes.forEach((cls) => {
    const dateKey = new Date(cls.starts_at).toISOString().split('T')[0]
    if (!classesByDay[dateKey]) classesByDay[dateKey] = []
    classesByDay[dateKey].push(cls)
  })

  function openAddDialog(date) {
    const d = date ? new Date(date + 'T00:00:00') : new Date()
    const dayOfWeek = d.getDay()
    setForm({
      classTypeId: classTypes[0]?.id || '', instructorId: instructors[0]?.id || '',
      date: date || new Date().toISOString().split('T')[0],
      startTime: '07:00', endTime: '07:55', capacity: 6, notes: '',
      recurring: false, days: [dayOfWeek], weeks: 4, everyWeek: false,
    })
    setAddDialog(true)
  }

  function openEditDialog(cls) {
    const startsAt = new Date(cls.starts_at)
    const endsAt = new Date(cls.ends_at)
    const dayOfWeek = startsAt.getDay()
    setForm({
      classTypeId: cls.class_type_id, instructorId: cls.instructor_id,
      date: startsAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }),
      startTime: startsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }),
      endTime: endsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }),
      capacity: cls.capacity, notes: cls.notes || '',
      recurring: false, days: [dayOfWeek], weeks: 4, everyWeek: false,
    })
    setEditDialog(cls)
  }

  function buildDatetime(date, time) {
    return new Date(`${date}T${time}:00+07:00`).toISOString()
  }

  async function handleCreate() {
    setSubmitting(true)
    try {
      if (form.recurring && form.days.length > 0) {
        // Recurring: use the recurring endpoint
        const weeks = form.everyWeek ? 52 : form.weeks
        const res = await fetch('/api/admin/schedule/recurring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classTypeId: form.classTypeId, instructorId: form.instructorId,
            startTime: form.startTime, endTime: form.endTime,
            capacity: form.capacity, notes: form.notes || undefined,
            days: form.days, weeks, startDate: form.date,
          }),
        })
        const data = await res.json()
        if (!res.ok) { setToast({ message: data.error || 'Failed to create', type: 'error' }); return }
        setToast({ message: `Created ${data.created} classes`, type: 'success' })
      } else {
        // Single class
        const res = await fetch('/api/admin/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classTypeId: form.classTypeId, instructorId: form.instructorId,
            startsAt: buildDatetime(form.date, form.startTime), endsAt: buildDatetime(form.date, form.endTime),
            capacity: form.capacity, notes: form.notes || null,
          }),
        })
        const data = await res.json()
        if (!res.ok) { setToast({ message: data.error || 'Failed to create class', type: 'error' }); return }
        setToast({ message: 'Class created', type: 'success' })
      }
      setAddDialog(false); fetchClasses()
    } catch { setToast({ message: 'Something went wrong', type: 'error' }) }
    finally { setSubmitting(false) }
  }

  async function handleUpdate() {
    if (!editDialog) return
    setSubmitting(true)
    try {
      // First update the existing class
      const res = await fetch('/api/admin/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editDialog.id, classTypeId: form.classTypeId, instructorId: form.instructorId,
          startsAt: buildDatetime(form.date, form.startTime), endsAt: buildDatetime(form.date, form.endTime),
          capacity: form.capacity, notes: form.notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setToast({ message: data.error || 'Failed to update', type: 'error' }); return }

      // If recurring is enabled, create future copies starting from the next occurrence
      if (form.recurring && form.days.length > 0) {
        const weeks = form.everyWeek ? 52 : form.weeks
        // Start from the day after the current class date so we don't duplicate
        const nextDate = new Date(form.date + 'T00:00:00+07:00')
        nextDate.setDate(nextDate.getDate() + 1)
        const recurRes = await fetch('/api/admin/schedule/recurring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classTypeId: form.classTypeId, instructorId: form.instructorId,
            startTime: form.startTime, endTime: form.endTime,
            capacity: form.capacity, notes: form.notes || undefined,
            days: form.days, weeks, startDate: nextDate.toLocaleDateString('en-CA'),
          }),
        })
        const recurData = await recurRes.json()
        if (recurRes.ok) {
          setToast({ message: `Class updated + ${recurData.created} recurring classes created`, type: 'success' })
        } else {
          setToast({ message: `Class updated but recurring failed: ${recurData.error}`, type: 'error' })
        }
      } else {
        setToast({ message: 'Class updated', type: 'success' })
      }

      // If the class has bookings, offer to notify members
      const bookedCount = editDialog.booked_count || 0
      const savedClassId = editDialog.id
      setEditDialog(null)
      fetchClasses()
      if (bookedCount > 0) {
        setNotifyDialog({ classId: savedClassId, count: bookedCount })
      }
    } catch { setToast({ message: 'Something went wrong', type: 'error' }) }
    finally { setSubmitting(false) }
  }

  async function handleNotifyMembers() {
    if (!notifyDialog) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/schedule/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: notifyDialog.classId }),
      })
      if (res.ok) {
        setToast({ message: 'Notification sent to members', type: 'success' })
      } else {
        setToast({ message: 'Email not configured yet — notification skipped', type: 'error' })
      }
    } catch {
      setToast({ message: 'Email not configured yet — notification skipped', type: 'error' })
    } finally {
      setNotifyDialog(null)
      setSubmitting(false)
    }
  }

  async function handleCancel() {
    if (!cancelDialog) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/schedule/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: cancelDialog.id }),
      })
      const data = await res.json()
      if (!res.ok) { setToast({ message: data.error || 'Failed to cancel', type: 'error' }); return }
      setToast({ message: `Cancelled. ${data.bookingsCancelled} booking(s), ${data.creditsRefunded} credit(s) refunded.`, type: 'success' })
      setCancelDialog(null); fetchClasses()
    } catch { setToast({ message: 'Something went wrong', type: 'error' }) }
    finally { setSubmitting(false) }
  }

  const weekLabel = (() => {
    const s = weekDays[0], e = weekDays[6]
    const sM = s.toLocaleDateString('en-US', { month: 'short' })
    const eM = e.toLocaleDateString('en-US', { month: 'short' })
    return sM === eM ? `${sM} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}` : `${sM} ${s.getDate()} – ${eM} ${e.getDate()}, ${e.getFullYear()}`
  })()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
        <Button onClick={() => openAddDialog()}>+ Add Class</Button>
      </div>

      {toast && (
        <div className={cn('mb-6 px-4 py-3 rounded-lg border flex items-center justify-between', toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400')}>
          <span className="text-sm">{toast.message}</span>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setWeekOffset((o) => o - 1)} className="text-sm text-muted hover:text-foreground transition-colors px-3 py-1.5 border border-card-border rounded">← Prev</button>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">{weekLabel}</p>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} className="text-xs text-accent hover:text-accent-dim transition-colors">Today</button>
          )}
        </div>
        <button onClick={() => setWeekOffset((o) => o + 1)} className="text-sm text-muted hover:text-foreground transition-colors px-3 py-1.5 border border-card-border rounded">Next →</button>
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-3">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className="h-48 bg-card border border-card-border rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map((day) => {
            const dateKey = day.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
            const dayClasses = classesByDay[dateKey] || []
            const isToday = day.toDateString() === today.toDateString()
            const isPast = day < today

            return (
              <div key={dateKey} className={cn('border border-card-border rounded-lg overflow-hidden min-h-[200px]', isToday ? 'border-accent/40 shadow-[0_0_12px_rgba(200,167,80,0.08)]' : '', isPast ? 'opacity-50' : '')}>
                <div className={cn('px-3 py-2 text-center border-b border-card-border', isToday ? 'bg-accent/10' : 'bg-card')}>
                  <p className="text-xs text-muted uppercase tracking-wide">{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                  <p className={cn('text-lg font-bold', isToday ? 'text-accent' : 'text-foreground')}>{day.getDate()}</p>
                </div>
                <div className="p-1.5 space-y-1.5">
                  {dayClasses.map((cls) => {
                    const time = new Date(cls.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok' })
                    const endTime = new Date(cls.ends_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok' })
                    const isCancelled = cls.status === 'cancelled'
                    const isFull = cls.booked_count >= cls.capacity
                    const isPrivate = cls.is_private || cls.class_types?.is_private
                    const fillPct = cls.capacity > 0 ? Math.min((cls.booked_count / cls.capacity) * 100, 100) : 0

                    return (
                      <button
                        key={cls.id}
                        onClick={() => isCancelled ? null : openEditDialog(cls)}
                        className={cn(
                          'w-full text-left px-2.5 py-2 rounded-md transition-colors border-l-[3px]',
                          isCancelled ? 'bg-red-500/5 opacity-50 cursor-default border-l-red-500/40' : 'bg-card hover:bg-white/[0.04] cursor-pointer',
                          !isCancelled && 'border-l-transparent'
                        )}
                        style={!isCancelled ? { borderLeftColor: cls.class_types?.color || '#c8a750' } : undefined}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className={cn('text-sm font-semibold truncate', isCancelled ? 'line-through text-muted' : 'text-foreground')}>
                            {cls.class_types?.name || 'Class'}
                          </span>
                          {isPrivate && <span className="text-[9px] text-amber-400 shrink-0">🔒</span>}
                        </div>
                        <p className="text-[11px] text-muted mt-0.5">{time} – {endTime}</p>
                        {cls.instructors?.name && (
                          <p className="text-[10px] text-muted/70 truncate">{cls.instructors.name}</p>
                        )}
                        {!isCancelled && (
                          <div className="flex items-center justify-between mt-1.5">
                            <div className="flex items-center gap-1.5 flex-1">
                              <div className="flex-1 h-1 bg-card-border rounded-full overflow-hidden">
                                <div
                                  className={cn('h-full rounded-full', isFull ? 'bg-red-500' : fillPct >= 75 ? 'bg-amber-500' : 'bg-green-500')}
                                  style={{ width: `${fillPct}%` }}
                                />
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); setRosterDialog(cls) }}
                              className={cn('text-[11px] font-semibold hover:text-accent transition-colors ml-1.5 shrink-0', isFull ? 'text-red-400' : fillPct >= 75 ? 'text-amber-400' : 'text-muted')}
                            >
                              {cls.booked_count}/{cls.capacity}
                            </button>
                          </div>
                        )}
                        {isCancelled && (
                          <p className="text-[10px] text-red-400 font-medium mt-1">Cancelled</p>
                        )}
                      </button>
                    )
                  })}
                  {!isPast && (
                    <button onClick={() => openAddDialog(dateKey)} className="w-full text-center text-sm text-muted hover:text-accent transition-colors py-2 rounded-md border border-dashed border-card-border hover:border-accent/30">+</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Class Dialog */}
      <Dialog open={addDialog} onOpenChange={(open) => !open && setAddDialog(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Class</DialogTitle><DialogDescription>Schedule a new class — toggle recurring to create multiple.</DialogDescription></DialogHeader>
          <ClassForm form={form} setForm={setForm} classTypes={classTypes} instructors={instructors} showRecurring />
          {form.recurring && form.days.length > 0 && (
            <p className="text-xs text-muted -mt-2">
              {form.everyWeek
                ? `Will create ~52 classes (every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][form.days[0]]} for 1 year)`
                : `Will create ~${form.weeks} classes (every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][form.days[0]]} for ${form.weeks} week${form.weeks !== 1 ? 's' : ''})`
              }
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAddDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting || (form.recurring && form.days.length === 0)}>
              {submitting ? 'Creating...' : form.recurring
                ? `Create ${form.everyWeek ? 52 : form.weeks} Classes`
                : 'Create Class'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Class Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
            <DialogDescription>{editDialog?.class_types?.name} — {editDialog?.booked_count || 0} booking{editDialog?.booked_count !== 1 ? 's' : ''}{(editDialog?.waitlist?.length || 0) > 0 ? ` · ${editDialog.waitlist.length} waitlisted` : ''}</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Left: Edit form */}
            <div>
              <ClassForm form={form} setForm={setForm} classTypes={classTypes} instructors={instructors} showRecurring recurLabel="Make this recurring" />
              {form.recurring && form.days.length > 0 && (
                <p className="text-xs text-muted mt-2">
                  Will create ~{form.everyWeek ? 52 : form.weeks} future classes (every {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][form.days[0]]}) starting after this date
                </p>
              )}
            </div>

            {/* Right: Attendees + Waitlist */}
            <div className="space-y-4">
              {/* Attendees */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">Attendees ({editDialog?.roster?.length || 0}/{editDialog?.capacity || 0})</p>
                  <button
                    onClick={() => { const cls = editDialog; setEditDialog(null); setRosterDialog(cls) }}
                    className="text-xs text-accent hover:text-accent-dim transition-colors"
                  >
                    Manage →
                  </button>
                </div>
                <div className="space-y-1 max-h-[180px] overflow-y-auto">
                  {(editDialog?.roster || []).length > 0 ? (editDialog.roster).map((m, i) => (
                    <div key={m.id || i} className="flex items-center gap-2 p-1.5 rounded border border-card-border">
                      <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center overflow-hidden shrink-0">
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-accent text-[9px] font-bold">{(m.name || '?')[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{m.name || 'No name'}</p>
                        <p className="text-[10px] text-muted truncate">{m.email}</p>
                      </div>
                      <Badge variant="success" className="text-[9px] capitalize shrink-0">
                        {m.status}
                      </Badge>
                    </div>
                  )) : (
                    <p className="text-xs text-muted text-center py-3 border border-dashed border-card-border rounded">No bookings yet</p>
                  )}
                </div>
              </div>

              {/* Waitlist */}
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Waitlist ({editDialog?.waitlist?.length || 0})</p>
                <div className="space-y-1 max-h-[120px] overflow-y-auto">
                  {(editDialog?.waitlist || []).length > 0 ? (editDialog.waitlist).map((m, i) => (
                    <div key={m.id || i} className="flex items-center gap-2 p-1.5 rounded border border-card-border">
                      <div className="w-5 h-5 rounded-full bg-card-border flex items-center justify-center shrink-0">
                        <span className="text-[8px] text-muted font-bold">#{m.position || i + 1}</span>
                      </div>
                      <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center overflow-hidden shrink-0">
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-accent text-[9px] font-bold">{(m.name || '?')[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{m.name || 'No name'}</p>
                        <p className="text-[10px] text-muted truncate">{m.email}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-xs text-muted text-center py-3 border border-dashed border-card-border rounded">No one on the waitlist</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="text-red-400 border-red-400/30 hover:bg-red-400/10" onClick={() => { setEditDialog(null); setCancelDialog(editDialog) }}>Cancel Class</Button>
            <div className="flex gap-2 sm:ml-auto">
              <Button variant="outline" onClick={() => setEditDialog(null)}>Close</Button>
              <Button onClick={handleUpdate} disabled={submitting}>{submitting ? 'Saving...' : form.recurring ? 'Save & Create Recurring' : 'Save Changes'}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Class Confirmation */}
      <Dialog open={!!cancelDialog} onOpenChange={(open) => !open && setCancelDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Cancel Class</DialogTitle><DialogDescription>This cannot be undone. All bookings will be cancelled and credits refunded.</DialogDescription></DialogHeader>
          {cancelDialog && (
            <div className="py-4 space-y-2">
              <p className="text-sm font-medium text-foreground">{cancelDialog.class_types?.name}</p>
              <p className="text-xs text-muted">
                {new Date(cancelDialog.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' })} at {new Date(cancelDialog.starts_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok' })}
              </p>
              <p className="text-xs text-muted">{cancelDialog.booked_count || 0} booking{cancelDialog.booked_count !== 1 ? 's' : ''} will be cancelled</p>
              {cancelDialog.booked_count > 0 && (
                <div className="mt-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400">
                  {cancelDialog.booked_count} member{cancelDialog.booked_count !== 1 ? 's' : ''} will be notified and credits will be refunded.
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelDialog(null)}>Keep Class</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleCancel} disabled={submitting}>{submitting ? 'Cancelling...' : 'Cancel Class'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Roster Dialog */}
      {rosterDialog && (
        <RosterDialog
          cls={rosterDialog}
          onClose={() => setRosterDialog(null)}
          onUpdate={() => fetchClasses()}
          setToast={setToast}
        />
      )}

      {/* Notify Members Dialog */}
      <Dialog open={!!notifyDialog} onOpenChange={(open) => !open && setNotifyDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Notify Members?</DialogTitle>
            <DialogDescription>
              {notifyDialog?.count} member{notifyDialog?.count !== 1 ? 's are' : ' is'} booked into this class. Would you like to notify them about the changes?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setNotifyDialog(null)}>Skip</Button>
            <Button onClick={handleNotifyMembers} disabled={submitting}>
              {submitting ? 'Sending...' : 'Notify Members'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ClassForm({ form, setForm, classTypes, instructors, showRecurring, recurLabel }) {
  const selectedType = classTypes.find((ct) => ct.id === form.classTypeId)
  const isPrivateType = selectedType?.is_private

  return (
    <div className="space-y-4 py-2">
      <div>
        <Label htmlFor="classType">Class Type</Label>
        <select id="classType" value={form.classTypeId} onChange={(e) => setForm((f) => ({ ...f, classTypeId: e.target.value }))} className="mt-1 w-full rounded-md border border-card-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent">
          <option value="">Select class type</option>
          {classTypes.map((ct) => (
            <option key={ct.id} value={ct.id}>{ct.name}{ct.is_private ? ' (Private)' : ''}</option>
          ))}
        </select>
        {isPrivateType && (
          <p className="text-xs text-amber-400 mt-1">This class type is private — it won&apos;t appear on the public schedule.</p>
        )}
      </div>
      <div>
        <Label htmlFor="instructor">Instructor</Label>
        <select id="instructor" value={form.instructorId} onChange={(e) => setForm((f) => ({ ...f, instructorId: e.target.value }))} className="mt-1 w-full rounded-md border border-card-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent">
          <option value="">Select instructor</option>
          {instructors.map((inst) => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
        </select>
      </div>
      <div><Label htmlFor="date">{form.recurring ? 'Start Date' : 'Date'}</Label><Input id="date" type="date" value={form.date} onChange={(e) => {
        const newDate = e.target.value
        const d = new Date(newDate + 'T00:00:00')
        setForm((f) => ({ ...f, date: newDate, days: [d.getDay()] }))
      }} className="mt-1" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="startTime">Start Time</Label><Input id="startTime" type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} className="mt-1" /></div>
        <div><Label htmlFor="endTime">End Time</Label><Input id="endTime" type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} className="mt-1" /></div>
      </div>
      <div><Label htmlFor="capacity">Capacity</Label><Input id="capacity" type="number" min={1} max={50} value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: parseInt(e.target.value) || 6 }))} className="mt-1" /></div>
      <div><Label htmlFor="notes">Notes (optional)</Label><Input id="notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="e.g. Special event, substitute instructor" className="mt-1" /></div>

      {showRecurring && (
        <>
          <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-card-border">
            <input
              type="checkbox"
              checked={form.recurring}
              onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.checked }))}
              className="w-4 h-4 rounded border-card-border bg-card accent-accent"
            />
            <div>
              <span className="text-sm text-foreground">{recurLabel || 'Make recurring'}</span>
              <p className="text-xs text-muted">Repeat every {DAY_NAMES[form.days[0]] || 'week'}day from the selected date</p>
            </div>
          </label>

          {form.recurring && (
            <div className="space-y-3 pl-7">
              <p className="text-xs text-foreground">
                Repeats every <span className="font-semibold text-accent">{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][form.days[0]]}</span>
              </p>
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.everyWeek}
                    onChange={(e) => setForm((f) => ({ ...f, everyWeek: e.target.checked }))}
                    className="w-4 h-4 rounded border-card-border bg-card accent-accent"
                  />
                  <span className="text-sm text-foreground">Every week (1 year)</span>
                </label>
              </div>
              {!form.everyWeek && (
                <div>
                  <Label>Number of weeks</Label>
                  <Input type="number" min={1} max={52} value={form.weeks} onChange={(e) => setForm((f) => ({ ...f, weeks: parseInt(e.target.value) || 4 }))} className="mt-1 w-24" />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function RosterDialog({ cls, onClose, onUpdate, setToast }) {
  const [roster, setRoster] = useState(cls.roster || [])
  const [waitlist, setWaitlist] = useState(cls.waitlist || [])
  const [searchInput, setSearchInput] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [activeTab, setActiveTab] = useState('attendees')

  const rosterUserIds = new Set(roster.map((m) => m.id))
  const waitlistUserIds = new Set(waitlist.map((m) => m.id))
  const allUserIds = new Set([...rosterUserIds, ...waitlistUserIds])

  async function searchMembers() {
    if (!searchInput.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`/api/admin/members?search=${encodeURIComponent(searchInput)}&limit=10`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.members || [])
      }
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setSearching(false)
    }
  }

  async function addMember(userId) {
    setActionLoading(userId)
    try {
      const res = await fetch('/api/admin/schedule/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: cls.id, userId }),
      })
      const data = await res.json()
      if (!res.ok) { setToast({ message: data.error || 'Failed to add', type: 'error' }); return }
      const member = searchResults.find((m) => m.id === userId)
      if (member) {
        setRoster((r) => [...r, { id: member.id, name: member.name, email: member.email, avatar_url: member.avatar_url, status: 'confirmed' }])
        // Remove from waitlist if they were on it
        setWaitlist((w) => w.filter((m) => m.id !== userId))
      }
      setToast({ message: `${member?.name || 'Member'} added`, type: 'success' })
      onUpdate()
    } catch {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  async function removeMember(userId) {
    setActionLoading(userId)
    try {
      const res = await fetch('/api/admin/schedule/roster', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: cls.id, userId, refundCredit: true }),
      })
      const data = await res.json()
      if (!res.ok) { setToast({ message: data.error || 'Failed to remove', type: 'error' }); return }
      setRoster((r) => r.filter((m) => m.id !== userId))
      setToast({ message: 'Member removed', type: 'success' })
      onUpdate()
    } catch {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  async function removeFromWaitlist(userId) {
    setActionLoading(`wl-${userId}`)
    try {
      const res = await fetch('/api/admin/schedule/roster', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: cls.id, userId, fromWaitlist: true }),
      })
      const data = await res.json()
      if (!res.ok) { setToast({ message: data.error || 'Failed to remove', type: 'error' }); return }
      setWaitlist((w) => w.filter((m) => m.id !== userId))
      setToast({ message: 'Removed from waitlist', type: 'success' })
      onUpdate()
    } catch {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  async function promoteFromWaitlist(userId) {
    // Add to roster directly (bypasses capacity — admin override)
    await addMember(userId)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Roster</DialogTitle>
          <DialogDescription>
            {cls.class_types?.name} — {new Date(cls.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' })}
            {' · '}{roster.length}/{cls.capacity} booked{waitlist.length > 0 ? ` · ${waitlist.length} waitlisted` : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Add member search */}
        <div className="space-y-2">
          <Label>Add Member</Label>
          <form onSubmit={(e) => { e.preventDefault(); searchMembers() }} className="flex gap-2">
            <Input
              placeholder="Search by name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <Button type="submit" variant="outline" disabled={searching}>
              {searching ? '...' : 'Search'}
            </Button>
          </form>
          {searchResults.length > 0 && (
            <div className="border border-card-border rounded-lg max-h-[150px] overflow-y-auto">
              {searchResults.filter((m) => !allUserIds.has(m.id)).map((m) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2 border-b border-card-border last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center overflow-hidden shrink-0">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-accent text-[9px] font-bold">{(m.name || m.email)?.[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{m.name || 'No name'}</p>
                      <p className="text-[10px] text-muted truncate">{m.email}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={() => addMember(m.id)}
                    disabled={actionLoading === m.id}
                  >
                    {actionLoading === m.id ? '...' : '+ Add'}
                  </Button>
                </div>
              ))}
              {searchResults.every((m) => allUserIds.has(m.id)) && (
                <p className="text-xs text-muted text-center py-2">All results already in roster or waitlist</p>
              )}
            </div>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-card-border">
          <button
            onClick={() => setActiveTab('attendees')}
            className={cn('flex-1 text-sm py-2 transition-colors border-b-2 -mb-px', activeTab === 'attendees' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-foreground')}
          >
            Attendees ({roster.length})
          </button>
          <button
            onClick={() => setActiveTab('waitlist')}
            className={cn('flex-1 text-sm py-2 transition-colors border-b-2 -mb-px', activeTab === 'waitlist' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-foreground')}
          >
            Waitlist ({waitlist.length})
          </button>
        </div>

        {/* Attendees tab */}
        {activeTab === 'attendees' && (
          <div className="space-y-1 max-h-[250px] overflow-y-auto">
            {roster.length > 0 ? roster.map((m, i) => (
              <div key={m.id || i} className="flex items-center justify-between p-2 rounded-lg border border-card-border">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center overflow-hidden shrink-0">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-accent text-[10px] font-bold">{(m.name || '?')[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-foreground">{m.name || 'No name'}</p>
                    <p className="text-[10px] text-muted">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="success" className="text-[10px] capitalize">
                    {m.status}
                  </Badge>
                  <button
                    onClick={() => removeMember(m.id)}
                    disabled={actionLoading === m.id}
                    className="text-red-400 hover:text-red-300 text-xs transition-colors disabled:opacity-50"
                    title="Remove from class"
                  >
                    {actionLoading === m.id ? '...' : '✕'}
                  </button>
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted text-center py-4">No bookings yet</p>
            )}
          </div>
        )}

        {/* Waitlist tab */}
        {activeTab === 'waitlist' && (
          <div className="space-y-1 max-h-[250px] overflow-y-auto">
            {waitlist.length > 0 ? waitlist.map((m, i) => (
              <div key={m.id || i} className="flex items-center justify-between p-2 rounded-lg border border-card-border">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-card-border flex items-center justify-center shrink-0">
                    <span className="text-[9px] text-muted font-bold">#{m.position || i + 1}</span>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center overflow-hidden shrink-0">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-accent text-[10px] font-bold">{(m.name || '?')[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-foreground">{m.name || 'No name'}</p>
                    <p className="text-[10px] text-muted">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => promoteFromWaitlist(m.id)}
                    disabled={actionLoading === m.id}
                    className="text-green-400 hover:text-green-300 text-[10px] font-medium transition-colors disabled:opacity-50 px-1.5 py-0.5 border border-green-400/20 rounded"
                    title="Move to attendees"
                  >
                    {actionLoading === m.id ? '...' : 'Promote'}
                  </button>
                  <button
                    onClick={() => removeFromWaitlist(m.id)}
                    disabled={actionLoading === `wl-${m.id}`}
                    className="text-red-400 hover:text-red-300 text-xs transition-colors disabled:opacity-50"
                    title="Remove from waitlist"
                  >
                    {actionLoading === `wl-${m.id}` ? '...' : '✕'}
                  </button>
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted text-center py-4">No one on the waitlist</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
