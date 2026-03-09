'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export default function AdminSchedulePage() {
  const [classes, setClasses] = useState([])
  const [classTypes, setClassTypes] = useState([])
  const [instructors, setInstructors] = useState([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [toast, setToast] = useState(null)

  // Dialog states
  const [addDialog, setAddDialog] = useState(false)
  const [editDialog, setEditDialog] = useState(null) // class object
  const [cancelDialog, setCancelDialog] = useState(null) // class object
  const [submitting, setSubmitting] = useState(false)

  // Form state for add/edit
  const [form, setForm] = useState({
    classTypeId: '',
    instructorId: '',
    date: '',
    startTime: '07:00',
    endTime: '07:55',
    capacity: 6,
    notes: '',
  })

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // Calculate week range
  const getWeekRange = useCallback(() => {
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7) // Monday
    startOfWeek.setHours(0, 0, 0, 0)

    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6) // Sunday
    endOfWeek.setHours(23, 59, 59, 999)

    return { start: startOfWeek, end: endOfWeek }
  }, [weekOffset])

  // Fetch classes
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

  // Fetch class types and instructors
  useEffect(() => {
    async function fetchOptions() {
      try {
        const [typesRes, instructorsRes] = await Promise.all([
          fetch('/api/admin/schedule/options'),
          fetch('/api/admin/schedule/options'),
        ])
        // We'll use a single endpoint for options
      } catch (err) {
        console.error(err)
      }
    }
    // Fetch options from the schedule options endpoint
    fetch('/api/admin/schedule/options')
      .then((res) => res.ok ? res.json() : { classTypes: [], instructors: [] })
      .then((data) => {
        setClassTypes(data.classTypes || [])
        setInstructors(data.instructors || [])
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchClasses()
  }, [fetchClasses])

  // Build week days
  const { start: weekStart } = getWeekRange()
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Group classes by date
  const classesByDay = {}
  classes.forEach((cls) => {
    const dateKey = new Date(cls.starts_at).toISOString().split('T')[0]
    if (!classesByDay[dateKey]) classesByDay[dateKey] = []
    classesByDay[dateKey].push(cls)
  })

  function openAddDialog(date) {
    setForm({
      classTypeId: classTypes[0]?.id || '',
      instructorId: instructors[0]?.id || '',
      date: date || new Date().toISOString().split('T')[0],
      startTime: '07:00',
      endTime: '07:55',
      capacity: 6,
      notes: '',
    })
    setAddDialog(true)
  }

  function openEditDialog(cls) {
    const startsAt = new Date(cls.starts_at)
    const endsAt = new Date(cls.ends_at)
    setForm({
      classTypeId: cls.class_type_id,
      instructorId: cls.instructor_id,
      date: startsAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }),
      startTime: startsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }),
      endTime: endsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }),
      capacity: cls.capacity,
      notes: cls.notes || '',
    })
    setEditDialog(cls)
  }

  function buildDatetime(date, time) {
    // Convert date (YYYY-MM-DD) + time (HH:MM) to Bangkok timezone ISO string
    return new Date(`${date}T${time}:00+07:00`).toISOString()
  }

  async function handleCreate() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classTypeId: form.classTypeId,
          instructorId: form.instructorId,
          startsAt: buildDatetime(form.date, form.startTime),
          endsAt: buildDatetime(form.date, form.endTime),
          capacity: form.capacity,
          notes: form.notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ message: data.error || 'Failed to create class', type: 'error' })
        return
      }
      setToast({ message: 'Class created successfully', type: 'success' })
      setAddDialog(false)
      fetchClasses()
    } catch (err) {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdate() {
    if (!editDialog) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editDialog.id,
          classTypeId: form.classTypeId,
          instructorId: form.instructorId,
          startsAt: buildDatetime(form.date, form.startTime),
          endsAt: buildDatetime(form.date, form.endTime),
          capacity: form.capacity,
          notes: form.notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ message: data.error || 'Failed to update class', type: 'error' })
        return
      }
      setToast({ message: 'Class updated successfully', type: 'success' })
      setEditDialog(null)
      fetchClasses()
    } catch (err) {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
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
      if (!res.ok) {
        setToast({ message: data.error || 'Failed to cancel class', type: 'error' })
        return
      }
      setToast({
        message: `Class cancelled. ${data.bookingsCancelled} booking${data.bookingsCancelled !== 1 ? 's' : ''} cancelled, ${data.creditsRefunded} credit${data.creditsRefunded !== 1 ? 's' : ''} refunded.`,
        type: 'success',
      })
      setCancelDialog(null)
      fetchClasses()
    } catch (err) {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const weekLabel = (() => {
    const s = weekDays[0]
    const e = weekDays[6]
    const sMonth = s.toLocaleDateString('en-US', { month: 'short' })
    const eMonth = e.toLocaleDateString('en-US', { month: 'short' })
    if (sMonth === eMonth) {
      return `${sMonth} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`
    }
    return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}, ${e.getFullYear()}`
  })()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
        <Button onClick={() => openAddDialog()}>+ Add Class</Button>
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

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setWeekOffset((o) => o - 1)}
          className="text-sm text-muted hover:text-foreground transition-colors px-3 py-1.5 border border-card-border rounded"
        >
          ← Prev
        </button>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">{weekLabel}</p>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs text-accent hover:text-accent-dim transition-colors"
            >
              Today
            </button>
          )}
        </div>
        <button
          onClick={() => setWeekOffset((o) => o + 1)}
          className="text-sm text-muted hover:text-foreground transition-colors px-3 py-1.5 border border-card-border rounded"
        >
          Next →
        </button>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-7 gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-40 bg-card border border-card-border rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        /* Calendar grid */
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dateKey = day.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
            const dayClasses = classesByDay[dateKey] || []
            const isToday = day.toDateString() === today.toDateString()
            const isPast = day < today

            return (
              <div
                key={dateKey}
                className={cn(
                  'border border-card-border rounded-lg overflow-hidden min-h-[160px]',
                  isToday ? 'border-accent/30' : '',
                  isPast ? 'opacity-60' : ''
                )}
              >
                {/* Day header */}
                <div className={cn(
                  'px-2 py-1.5 text-center border-b border-card-border',
                  isToday ? 'bg-accent/10' : 'bg-card'
                )}>
                  <p className="text-xs text-muted">
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <p className={cn('text-sm font-medium', isToday ? 'text-accent' : 'text-foreground')}>
                    {day.getDate()}
                  </p>
                </div>

                {/* Classes */}
                <div className="p-1 space-y-1">
                  {dayClasses.map((cls) => {
                    const time = new Date(cls.starts_at).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                      timeZone: 'Asia/Bangkok',
                    })
                    const isCancelled = cls.status === 'cancelled'
                    const isFull = cls.booked_count >= cls.capacity

                    return (
                      <button
                        key={cls.id}
                        onClick={() => isCancelled ? null : openEditDialog(cls)}
                        className={cn(
                          'w-full text-left px-1.5 py-1 rounded text-xs transition-colors',
                          isCancelled
                            ? 'bg-red-500/10 opacity-50 cursor-default'
                            : 'bg-card hover:bg-white/5 cursor-pointer'
                        )}
                      >
                        <div className="flex items-center gap-1">
                          <div
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: cls.class_types?.color || '#c8a750' }}
                          />
                          <span className={cn('truncate font-medium', isCancelled ? 'line-through text-muted' : 'text-foreground')}>
                            {cls.class_types?.name || 'Class'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-muted">{time}</span>
                          {!isCancelled && (
                            <span className={cn(
                              'font-medium',
                              isFull ? 'text-red-400' : 'text-muted'
                            )}>
                              {cls.booked_count}/{cls.capacity}
                            </span>
                          )}
                          {isCancelled && <span className="text-red-400">X</span>}
                        </div>
                      </button>
                    )
                  })}

                  {/* Add class button for this day */}
                  {!isPast && (
                    <button
                      onClick={() => openAddDialog(dateKey)}
                      className="w-full text-center text-xs text-muted hover:text-accent transition-colors py-1 rounded border border-dashed border-card-border hover:border-accent/30"
                    >
                      +
                    </button>
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
          <DialogHeader>
            <DialogTitle>Add Class</DialogTitle>
            <DialogDescription>Schedule a new class.</DialogDescription>
          </DialogHeader>
          <ClassForm
            form={form}
            setForm={setForm}
            classTypes={classTypes}
            instructors={instructors}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAddDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Class'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Class Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
            <DialogDescription>
              {editDialog?.class_types?.name} — {editDialog?.booked_count || 0} booking{editDialog?.booked_count !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <ClassForm
            form={form}
            setForm={setForm}
            classTypes={classTypes}
            instructors={instructors}
          />
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="text-red-400 border-red-400/30 hover:bg-red-400/10"
              onClick={() => { setEditDialog(null); setCancelDialog(editDialog) }}
            >
              Cancel Class
            </Button>
            <div className="flex gap-2 sm:ml-auto">
              <Button variant="outline" onClick={() => setEditDialog(null)}>Close</Button>
              <Button onClick={handleUpdate} disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Class Confirmation */}
      <Dialog open={!!cancelDialog} onOpenChange={(open) => !open && setCancelDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Class</DialogTitle>
            <DialogDescription>
              This action cannot be undone. All bookings will be cancelled and credits refunded.
            </DialogDescription>
          </DialogHeader>
          {cancelDialog && (
            <div className="py-4 space-y-2">
              <p className="text-sm font-medium text-foreground">
                {cancelDialog.class_types?.name}
              </p>
              <p className="text-xs text-muted">
                {new Date(cancelDialog.starts_at).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'Asia/Bangkok',
                })} at {new Date(cancelDialog.starts_at).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                  timeZone: 'Asia/Bangkok',
                })}
              </p>
              <p className="text-xs text-muted">
                {cancelDialog.booked_count || 0} booking{cancelDialog.booked_count !== 1 ? 's' : ''} will be cancelled
              </p>
              {cancelDialog.booked_count > 0 && (
                <div className="mt-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400">
                  {cancelDialog.booked_count} member{cancelDialog.booked_count !== 1 ? 's' : ''} will be notified and credits will be refunded.
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelDialog(null)}>Keep Class</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleCancel}
              disabled={submitting}
            >
              {submitting ? 'Cancelling...' : 'Cancel Class'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ClassForm({ form, setForm, classTypes, instructors }) {
  return (
    <div className="space-y-4 py-2">
      <div>
        <Label htmlFor="classType">Class Type</Label>
        <select
          id="classType"
          value={form.classTypeId}
          onChange={(e) => setForm((f) => ({ ...f, classTypeId: e.target.value }))}
          className="mt-1 w-full rounded-md border border-card-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">Select class type</option>
          {classTypes.map((ct) => (
            <option key={ct.id} value={ct.id}>{ct.name}</option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="instructor">Instructor</Label>
        <select
          id="instructor"
          value={form.instructorId}
          onChange={(e) => setForm((f) => ({ ...f, instructorId: e.target.value }))}
          className="mt-1 w-full rounded-md border border-card-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">Select instructor</option>
          {instructors.map((inst) => (
            <option key={inst.id} value={inst.id}>{inst.name}</option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="date">Date</Label>
        <Input
          id="date"
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="startTime">Start Time</Label>
          <Input
            id="startTime"
            type="time"
            value={form.startTime}
            onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="endTime">End Time</Label>
          <Input
            id="endTime"
            type="time"
            value={form.endTime}
            onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="capacity">Capacity</Label>
        <Input
          id="capacity"
          type="number"
          min={1}
          max={50}
          value={form.capacity}
          onChange={(e) => setForm((f) => ({ ...f, capacity: parseInt(e.target.value) || 6 }))}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input
          id="notes"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="e.g. Special event, substitute instructor"
          className="mt-1"
        />
      </div>
    </div>
  )
}
