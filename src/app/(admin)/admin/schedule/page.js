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

  // Private class member invite state
  const [inviteMembers, setInviteMembers] = useState([]) // { id, name, email, avatar_url }
  const [inviteSearch, setInviteSearch] = useState('')
  const [inviteResults, setInviteResults] = useState([])
  const [inviteSearching, setInviteSearching] = useState(false)

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
  const recurringCounts = {}
  classes.forEach((cls) => {
    const dateKey = new Date(cls.starts_at).toISOString().split('T')[0]
    if (!classesByDay[dateKey]) classesByDay[dateKey] = []
    classesByDay[dateKey].push(cls)
    if (cls.recurring_id) {
      recurringCounts[cls.recurring_id] = (recurringCounts[cls.recurring_id] || 0) + 1
    }
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
    setInviteMembers([])
    setInviteSearch('')
    setInviteResults([])
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

  async function searchInviteMembers() {
    if (!inviteSearch.trim()) return
    setInviteSearching(true)
    try {
      const res = await fetch(`/api/admin/members?search=${encodeURIComponent(inviteSearch)}&limit=10`)
      if (res.ok) {
        const data = await res.json()
        setInviteResults(data.members || [])
      }
    } catch (err) {
      console.error('Invite search failed:', err)
    } finally {
      setInviteSearching(false)
    }
  }

  async function handleCreate() {
    setSubmitting(true)
    try {
      let createdClassId = null

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
        createdClassId = data.class?.id
        setToast({ message: 'Class created', type: 'success' })
      }

      // Add invited members to the class (private classes)
      if (createdClassId && inviteMembers.length > 0) {
        let added = 0
        for (const member of inviteMembers) {
          const res = await fetch('/api/admin/schedule/roster', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ classId: createdClassId, userId: member.id }),
          })
          if (res.ok) added++
        }
        if (added > 0) {
          setToast({ message: `Class created with ${added} member${added !== 1 ? 's' : ''} added`, type: 'success' })
        }
      }

      setAddDialog(false); fetchClasses()
    } catch { setToast({ message: 'Something went wrong', type: 'error' }) }
    finally { setSubmitting(false) }
  }

  // mode: 'this' = save this only (unlink if recurring), 'all' = apply to all recurring siblings
  async function handleUpdate(mode = 'this') {
    if (!editDialog) return
    setSubmitting(true)
    try {
      const isRecurring = !!editDialog.recurring_id
      const unlinkFromRecurring = isRecurring && mode === 'this'
      const updateAll = isRecurring && mode === 'all'

      const res = await fetch('/api/admin/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editDialog.id, classTypeId: form.classTypeId, instructorId: form.instructorId,
          startsAt: buildDatetime(form.date, form.startTime), endsAt: buildDatetime(form.date, form.endTime),
          capacity: form.capacity, notes: form.notes || null,
          updateAll,
          unlinkFromRecurring,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setToast({ message: data.error || 'Failed to update', type: 'error' }); return }

      // If "make recurring" toggle is on (for non-recurring classes or extending), create future copies
      if (form.recurring && form.days.length > 0 && !isRecurring) {
        const weeks = form.everyWeek ? 52 : form.weeks
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
      } else if (updateAll && data.siblingsUpdated > 0) {
        setToast({ message: `Updated this class + ${data.siblingsUpdated} recurring sibling${data.siblingsUpdated !== 1 ? 's' : ''}`, type: 'success' })
      } else if (unlinkFromRecurring) {
        setToast({ message: 'Class updated and removed from recurring set', type: 'success' })
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

  async function handleCancel(cancelAll = false) {
    if (!cancelDialog) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/schedule/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: cancelDialog.id, cancelAll }),
      })
      const data = await res.json()
      if (!res.ok) { setToast({ message: data.error || 'Failed to cancel', type: 'error' }); return }
      if (cancelAll) {
        setToast({ message: `Cancelled ${data.classesCancelled} classes. ${data.bookingsCancelled} booking(s), ${data.creditsRefunded} credit(s) refunded.`, type: 'success' })
      } else {
        setToast({ message: `Cancelled. ${data.bookingsCancelled} booking(s), ${data.creditsRefunded} credit(s) refunded.`, type: 'success' })
      }
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
        <div className={cn('fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 px-4 py-3 rounded-lg border flex items-center gap-3 shadow-lg sm:max-w-sm animate-in slide-in-from-bottom-2', toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400 backdrop-blur-sm' : 'bg-green-500/10 border-green-500/20 text-green-400 backdrop-blur-sm')}>
          <span className="text-sm">{toast.message}</span>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 shrink-0">✕</button>
        </div>
      )}

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setWeekOffset((o) => o - 1)} className="text-sm text-muted hover:text-foreground transition-colors px-3 py-2 min-h-[44px] border border-card-border rounded">← Prev</button>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">{weekLabel}</p>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} className="text-xs text-accent hover:text-accent-dim transition-colors py-1">Today</button>
          )}
        </div>
        <button onClick={() => setWeekOffset((o) => o + 1)} className="text-sm text-muted hover:text-foreground transition-colors px-3 py-2 min-h-[44px] border border-card-border rounded">Next →</button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 sm:gap-3">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className="h-48 bg-card border border-card-border rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 sm:gap-3">
          {weekDays.map((day) => {
            const dateKey = day.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
            const dayClasses = classesByDay[dateKey] || []
            const isToday = day.toDateString() === today.toDateString()
            const isPast = day < today

            return (
              <div key={dateKey} className={cn('border border-card-border rounded-lg overflow-hidden min-h-[120px] md:min-h-[200px]', isToday ? 'border-accent/40 shadow-[0_0_12px_rgba(200,167,80,0.08)]' : '', isPast ? 'opacity-50' : '')}>
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
                    const isRecurring = !!cls.recurring_id
                    const fillPct = cls.capacity > 0 ? Math.min((cls.booked_count / cls.capacity) * 100, 100) : 0

                    return (
                      <button
                        key={cls.id}
                        onClick={() => isCancelled ? null : openEditDialog(cls)}
                        className={cn(
                          'w-full text-left px-2.5 py-2 rounded-md transition-colors border-l-[3px] relative',
                          isCancelled ? 'bg-red-500/5 opacity-50 cursor-default border-l-red-500/40' : 'bg-card hover:bg-white/[0.04] cursor-pointer',
                          !isCancelled && 'border-l-transparent',
                          !isCancelled && isRecurring && !isPrivate && 'ring-1 ring-purple-400/20 bg-gradient-to-r from-purple-500/[0.06] to-transparent',
                          !isCancelled && isPrivate && 'ring-1 ring-amber-400/20 bg-gradient-to-r from-amber-500/[0.06] to-transparent',
                          !isCancelled && !isRecurring && !isPrivate && 'ring-1 ring-sky-400/15 bg-gradient-to-r from-sky-500/[0.04] to-transparent'
                        )}
                        style={!isCancelled ? { borderLeftColor: cls.class_types?.color || '#c8a750' } : undefined}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className={cn('text-sm font-semibold truncate', isCancelled ? 'line-through text-muted' : 'text-foreground')}>
                            {cls.class_types?.name || 'Class'}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {isRecurring && !isCancelled && (
                              <span className="text-sm text-purple-400/70" title="Recurring class">↻</span>
                            )}
                            {isPrivate && <span className="text-[9px] text-amber-400">🔒</span>}
                          </div>
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
        <DialogContent className="sm:max-w-md p-0 gap-0">
          {/* Color bar — class color into category hue */}
          {(() => {
            const ct = classTypes.find((c) => c.id === form.classTypeId)
            const addColor = ct?.color || '#c8a750'
            const addHue = form.recurring ? '#a78bfa' : ct?.is_private ? '#fbbf24' : '#38bdf8'
            return <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${addColor}, ${addHue}88)` }} />
          })()}
          <div className="px-4 sm:px-6 pt-5 pb-2">
            <DialogHeader>
              <DialogTitle>Add Class</DialogTitle>
              <DialogDescription>Schedule a new class — toggle recurring to create multiple.</DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-4 sm:px-6 pb-2 relative">
            {(() => {
              const ct = classTypes.find((c) => c.id === form.classTypeId)
              const addHue = form.recurring ? '#a78bfa' : ct?.is_private ? '#fbbf24' : '#38bdf8'
              return <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ background: `linear-gradient(135deg, ${addHue}, transparent 60%)` }} />
            })()}
            <div className="relative">
              <ClassForm form={form} setForm={setForm} classTypes={classTypes} instructors={instructors} showRecurring />
            </div>
          </div>
          {form.recurring && form.days.length > 0 && (
            <p className="text-xs text-muted px-4 sm:px-6 -mt-1 pb-2">
              {form.everyWeek
                ? `Will create ~52 classes (every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][form.days[0]]} for 1 year)`
                : `Will create ~${form.weeks} classes (every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][form.days[0]]} for ${form.weeks} week${form.weeks !== 1 ? 's' : ''})`
              }
            </p>
          )}

          {/* Invite members — shown for private class types */}
          {(() => {
            const ct = classTypes.find((c) => c.id === form.classTypeId)
            if (!ct?.is_private) return null
            const invitedIds = new Set(inviteMembers.map((m) => m.id))
            return (
              <div className="px-4 sm:px-6 pb-3 space-y-3">
                <div className="border-t border-card-border pt-3">
                  <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Invite Members</p>
                  <form onSubmit={(e) => { e.preventDefault(); searchInviteMembers() }} className="flex gap-2">
                    <Input
                      placeholder="Search by name or email..."
                      value={inviteSearch}
                      onChange={(e) => setInviteSearch(e.target.value)}
                      className="text-sm"
                    />
                    <Button type="submit" variant="outline" size="sm" disabled={inviteSearching}>
                      {inviteSearching ? '...' : 'Search'}
                    </Button>
                  </form>
                  {inviteResults.length > 0 && (
                    <div className="border border-card-border/60 rounded-lg mt-2 max-h-[120px] overflow-y-auto">
                      {inviteResults.filter((m) => !invitedIds.has(m.id)).map((m) => (
                        <div key={m.id} className="flex items-center justify-between px-3 py-1.5 border-b border-card-border/40 last:border-0">
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
                          <button
                            type="button"
                            onClick={() => setInviteMembers((prev) => [...prev, { id: m.id, name: m.name, email: m.email, avatar_url: m.avatar_url }])}
                            className="text-xs text-accent hover:text-accent-dim font-medium shrink-0 ml-2"
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                      {inviteResults.every((m) => invitedIds.has(m.id)) && (
                        <p className="text-[10px] text-muted text-center py-2">All results already added</p>
                      )}
                    </div>
                  )}
                </div>
                {inviteMembers.length > 0 && (
                  <div>
                    <p className="text-[11px] text-muted mb-1.5">{inviteMembers.length} member{inviteMembers.length !== 1 ? 's' : ''} will be added</p>
                    <div className="flex flex-wrap gap-1.5">
                      {inviteMembers.map((m) => (
                        <div key={m.id} className="flex items-center gap-1.5 bg-amber-400/5 border border-amber-400/20 rounded-full pl-1 pr-2 py-0.5">
                          <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden shrink-0">
                            {m.avatar_url ? (
                              <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[8px] font-bold text-accent">{(m.name || '?')[0]?.toUpperCase()}</span>
                            )}
                          </div>
                          <span className="text-[11px] text-foreground font-medium">{m.name?.split(' ')[0] || m.email?.split('@')[0]}</span>
                          <button
                            type="button"
                            onClick={() => setInviteMembers((prev) => prev.filter((p) => p.id !== m.id))}
                            className="text-muted hover:text-red-400 text-[10px] ml-0.5"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          <div className="border-t border-card-border px-4 sm:px-6 py-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting || (form.recurring && form.days.length === 0)}>
              {submitting ? 'Creating...' : form.recurring
                ? `Create ${form.everyWeek ? 52 : form.weeks} Classes`
                : 'Create Class'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Class Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent className="sm:max-w-3xl p-0 gap-0">
          {/* Color banner header */}
          {editDialog && (() => {
            const color = editDialog.class_types?.color || '#c8a750'
            const isRecurring = !!editDialog.recurring_id
            const isPrivate = editDialog.class_types?.is_private
            // Category hue: purple=recurring, amber=private, sky=singular
            const categoryHue = isRecurring ? '#a78bfa' : isPrivate ? '#fbbf24' : '#38bdf8'
            const fillPct = editDialog.capacity > 0 ? Math.min(((editDialog.booked_count || 0) / editDialog.capacity) * 100, 100) : 0
            const isFull = (editDialog.booked_count || 0) >= editDialog.capacity
            const startsAt = new Date(editDialog.starts_at)
            const endsAt = new Date(editDialog.ends_at)
            const dateLabel = startsAt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' })
            const timeLabel = startsAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok' })
            const endLabel = endsAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok' })

            return (
              <>
                {/* Accent top bar — class color fading into category hue */}
                <div className="h-1.5 w-full rounded-t-lg" style={{ background: `linear-gradient(90deg, ${color}, ${categoryHue}88)` }} />

                {/* Header section */}
                <div className="px-4 sm:px-6 pt-5 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-lg sm:text-xl font-bold text-foreground">{editDialog.class_types?.name || 'Class'}</h2>
                        {isRecurring && (
                          <span className="text-[11px] font-medium text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="text-sm">↻</span> Recurring
                          </span>
                        )}
                        {isPrivate && (
                          <span className="text-[11px] font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">🔒 Private</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                        <span className="flex items-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                          </svg>
                          {dateLabel}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {timeLabel} – {endLabel}
                        </span>
                        {editDialog.instructors?.name && (
                          <span className="flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                            </svg>
                            {editDialog.instructors.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Capacity ring */}
                    <div className="shrink-0 text-center">
                      <div className="relative w-14 h-14">
                        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                          <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="3" className="text-card-border" />
                          <circle cx="28" cy="28" r="24" fill="none" strokeWidth="3" strokeLinecap="round"
                            stroke={isFull ? '#ef4444' : fillPct >= 75 ? '#f59e0b' : '#22c55e'}
                            strokeDasharray={`${fillPct * 1.508} 150.8`}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className={cn('text-sm font-bold', isFull ? 'text-red-400' : 'text-foreground')}>
                            {editDialog.booked_count || 0}/{editDialog.capacity}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted mt-1">{isFull ? 'Full' : `${editDialog.capacity - (editDialog.booked_count || 0)} spots`}</p>
                    </div>
                  </div>

                  {/* Roster pills — "Who's coming" */}
                  {(editDialog.roster?.length > 0 || editDialog.waitlist?.length > 0) && (
                    <div className="mt-4 space-y-3">
                      {editDialog.roster?.length > 0 && (
                        <div>
                          <p className="text-xs text-muted mb-2">Who&apos;s booked ({editDialog.roster.length})</p>
                          <div className="flex flex-wrap gap-1.5">
                            {editDialog.roster.map((m, i) => (
                              <div key={m.id || i} className="flex items-center gap-1.5 bg-background rounded-full pl-1 pr-2.5 py-1 border border-card-border">
                                <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden shrink-0">
                                  {m.avatar_url ? (
                                    <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[8px] font-bold text-accent">{(m.name || '?')[0]?.toUpperCase()}</span>
                                  )}
                                </div>
                                <span className="text-[11px] text-foreground font-medium">{m.name?.split(' ')[0] || m.email?.split('@')[0]}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {editDialog.waitlist?.length > 0 && (
                        <div>
                          <p className="text-xs text-muted/60 mb-2">Waitlist ({editDialog.waitlist.length})</p>
                          <div className="flex flex-wrap gap-1.5">
                            {editDialog.waitlist.map((m, i) => (
                              <div key={m.id || i} className="flex items-center gap-1.5 bg-background/50 rounded-full pl-1 pr-2.5 py-1 border border-card-border opacity-60">
                                <div className="w-5 h-5 rounded-full bg-muted/20 flex items-center justify-center overflow-hidden shrink-0">
                                  {m.avatar_url ? (
                                    <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[8px] font-bold text-muted">{(m.name || '?')[0]?.toUpperCase()}</span>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted">#{m.position || i + 1} {m.name?.split(' ')[0] || 'Member'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => { const cls = editDialog; setEditDialog(null); setRosterDialog(cls) }}
                        className="text-xs text-accent hover:text-accent-dim transition-colors font-medium"
                      >
                        Manage roster →
                      </button>
                    </div>
                  )}
                  {!editDialog.roster?.length && !editDialog.waitlist?.length && (
                    <div className="mt-4 flex items-center justify-between py-3 px-4 rounded-lg border border-dashed border-card-border">
                      <p className="text-xs text-muted">No bookings yet</p>
                      <button
                        onClick={() => { const cls = editDialog; setEditDialog(null); setRosterDialog(cls) }}
                        className="text-xs text-accent hover:text-accent-dim transition-colors font-medium"
                      >
                        Add members →
                      </button>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-card-border" />

                {/* Edit form section — tinted by category hue */}
                <div className="px-4 sm:px-6 py-5 relative">
                  <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ background: `linear-gradient(135deg, ${categoryHue}, transparent 60%)` }} />
                  <div className="relative">
                    <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3">Edit Details</p>
                    <ClassForm form={form} setForm={setForm} classTypes={classTypes} instructors={instructors} showRecurring={!isRecurring} recurLabel="Make this recurring" isEditing bookedCount={editDialog.booked_count || 0} />
                    {form.recurring && form.days.length > 0 && !isRecurring && (
                      <p className="text-xs text-muted mt-2">
                        Will create ~{form.everyWeek ? 52 : form.weeks} future classes (every {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][form.days[0]]}) starting after this date
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer actions */}
                <div className="border-t border-card-border px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-2">
                  <Button variant="outline" className="text-red-400 border-red-400/30 hover:bg-red-400/10 w-full sm:w-auto" onClick={() => { setEditDialog(null); setCancelDialog(editDialog) }}>
                    {isRecurring ? 'Cancel...' : 'Cancel Class'}
                  </Button>
                  <div className="flex flex-col sm:flex-row gap-2 sm:ml-auto">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEditDialog(null)}>Close</Button>
                    {isRecurring ? (
                      <>
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => handleUpdate('this')}
                          disabled={submitting}
                          title="Save changes to this class only and remove it from the recurring set"
                        >
                          {submitting ? 'Saving...' : 'Save This Only'}
                        </Button>
                        <Button className="w-full sm:w-auto" onClick={() => handleUpdate('all')} disabled={submitting}>
                          {submitting ? 'Saving...' : 'Save All Recurring'}
                        </Button>
                      </>
                    ) : (
                      <Button className="w-full sm:w-auto" onClick={() => handleUpdate('this')} disabled={submitting}>
                        {submitting ? 'Saving...' : form.recurring ? 'Save & Create Recurring' : 'Save Changes'}
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Cancel Class Confirmation */}
      <Dialog open={!!cancelDialog} onOpenChange={(open) => !open && setCancelDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Cancel Class</DialogTitle><DialogDescription>This cannot be undone. All bookings will be cancelled and credits refunded.</DialogDescription></DialogHeader>
          {cancelDialog && (
            <div className="py-4 space-y-2">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                {cancelDialog.class_types?.name}
                {cancelDialog.recurring_id && (
                  <span className="text-[10px] text-accent/70 bg-accent/10 px-1.5 py-0.5 rounded-full">↻ Recurring</span>
                )}
              </p>
              <p className="text-xs text-muted">
                {new Date(cancelDialog.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' })} at {new Date(cancelDialog.starts_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok' })}
              </p>
              <p className="text-xs text-muted">{cancelDialog.booked_count || 0} booking{cancelDialog.booked_count !== 1 ? 's' : ''} will be cancelled</p>
              {cancelDialog.booked_count > 0 && (
                <div className="mt-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400">
                  {cancelDialog.booked_count} member{cancelDialog.booked_count !== 1 ? 's' : ''} will be notified and credits will be refunded.
                </div>
              )}
              {cancelDialog.recurring_id && (
                <div className="mt-2 px-3 py-2 bg-accent/5 border border-accent/20 rounded text-xs text-accent/80">
                  This class is part of a recurring series. You can cancel just this one, or all upcoming classes in the series.
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setCancelDialog(null)}>Keep Class</Button>
            <div className="flex gap-2 sm:ml-auto">
              {cancelDialog?.recurring_id && (
                <Button
                  className="bg-red-600/80 hover:bg-red-700 text-white text-xs"
                  onClick={() => handleCancel(true)}
                  disabled={submitting}
                >
                  {submitting ? 'Cancelling...' : 'Cancel All Recurring'}
                </Button>
              )}
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleCancel(false)} disabled={submitting}>
                {submitting ? 'Cancelling...' : cancelDialog?.recurring_id ? 'Cancel This Only' : 'Cancel Class'}
              </Button>
            </div>
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

const selectClass = 'mt-1.5 w-full h-10 rounded-lg bg-background/50 border border-card-border/60 px-3.5 py-2 text-sm text-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/30 focus:bg-background/80 [color-scheme:dark]'
const selectDisabled = 'mt-1.5 w-full h-10 rounded-lg bg-card-border/20 border border-card-border/40 px-3.5 py-2 text-sm text-muted cursor-not-allowed'

function ClassForm({ form, setForm, classTypes, instructors, showRecurring, recurLabel, isEditing, bookedCount }) {
  const selectedType = classTypes.find((ct) => ct.id === form.classTypeId)
  const isPrivateType = selectedType?.is_private

  return (
    <div className="space-y-4 py-2">
      <div>
        <Label htmlFor="classType">Class Type</Label>
        {isEditing ? (
          <>
            <select id="classType" value={form.classTypeId} disabled className={selectDisabled}>
              {classTypes.map((ct) => (
                <option key={ct.id} value={ct.id}>{ct.name}{ct.is_private ? ' (Private)' : ''}</option>
              ))}
            </select>
            <p className="text-[10px] text-muted/50 mt-1">Class type cannot be changed after creation</p>
          </>
        ) : (
          <>
            <select id="classType" value={form.classTypeId} onChange={(e) => {
              const newId = e.target.value
              const ct = classTypes.find((c) => c.id === newId)
              setForm((f) => ({
                ...f,
                classTypeId: newId,
                capacity: ct?.is_private ? 1 : (f.capacity === 1 ? 6 : f.capacity),
              }))
            }} className={selectClass}>
              <option value="">Select class type</option>
              {classTypes.map((ct) => (
                <option key={ct.id} value={ct.id}>{ct.name}{ct.is_private ? ' (Private)' : ''}</option>
              ))}
            </select>
            {isPrivateType && (
              <p className="text-xs text-amber-400 mt-1.5">This class type is private — it won&apos;t appear on the public schedule.</p>
            )}
          </>
        )}
      </div>
      <div>
        <Label htmlFor="instructor">Instructor</Label>
        <select id="instructor" value={form.instructorId} onChange={(e) => setForm((f) => ({ ...f, instructorId: e.target.value }))} className={selectClass}>
          <option value="">Select instructor</option>
          {instructors.map((inst) => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
        </select>
      </div>
      <div>
        <Label htmlFor="date">{form.recurring ? 'Start Date' : 'Date'}</Label>
        <Input id="date" type="date" value={form.date} onChange={(e) => {
          const newDate = e.target.value
          const d = new Date(newDate + 'T00:00:00')
          setForm((f) => ({ ...f, date: newDate, days: [d.getDay()] }))
        }} className="mt-1.5" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="startTime">Start Time</Label>
          <Input id="startTime" type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="endTime">End Time</Label>
          <Input id="endTime" type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} className="mt-1.5" />
        </div>
      </div>
      <div>
        <div>
          <Label htmlFor="capacity">Capacity</Label>
          <Input id="capacity" type="number" min={isEditing ? (bookedCount || 1) : 1} max={50} value={form.capacity} onChange={(e) => {
            const val = parseInt(e.target.value) || 1
            const min = isEditing ? (bookedCount || 1) : 1
            setForm((f) => ({ ...f, capacity: Math.max(val, min) }))
          }} className="mt-1.5" />
          {isEditing && bookedCount > 0 && (
            <p className="text-[10px] text-muted/50 mt-1">Min {bookedCount} (current bookings)</p>
          )}
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="e.g. Special event, substitute instructor" className="mt-1.5" />
      </div>

      {showRecurring && (
        <>
          <label className="flex items-center gap-3 cursor-pointer pt-3 border-t border-card-border/40">
            <input
              type="checkbox"
              checked={form.recurring}
              onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.checked }))}
              className="w-4 h-4 rounded-md border-card-border bg-background/50 accent-accent"
            />
            <div>
              <span className="text-sm text-foreground">{recurLabel || 'Make recurring'}</span>
              <p className="text-[11px] text-muted/60">Repeat every {DAY_NAMES[form.days[0]] || 'week'}day from the selected date</p>
            </div>
          </label>

          {form.recurring && (
            <div className="space-y-3 pl-7">
              <p className="text-xs text-foreground">
                Repeats every <span className="font-semibold text-accent">{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][form.days[0]]}</span>
              </p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.everyWeek}
                  onChange={(e) => setForm((f) => ({ ...f, everyWeek: e.target.checked }))}
                  className="w-4 h-4 rounded-md border-card-border bg-background/50 accent-accent"
                />
                <span className="text-sm text-foreground">Every week (1 year)</span>
              </label>
              {!form.everyWeek && (
                <div>
                  <Label>Weeks</Label>
                  <Input type="number" min={1} max={52} value={form.weeks} onChange={(e) => setForm((f) => ({ ...f, weeks: parseInt(e.target.value) || 4 }))} className="mt-1.5 w-24" />
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
