'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Lock, X, Trash2, CalendarDays, Clock, User, Check, Plus, ChevronLeft, ChevronRight, Mail, MailX } from 'lucide-react'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ─── Calendar constants ──────────────────────────────────────────────────────
const HOUR_HEIGHT = 60 // 1px per minute
const START_HOUR = 0
const END_HOUR = 24
const SNAP_MINUTES = 15
const SNAP_PX = SNAP_MINUTES // since HOUR_HEIGHT=60, 15min = 15px
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT
const MIN_BLOCK_HEIGHT = SNAP_PX // 15 min minimum

function minutesSinceStart(dateStr) {
  const d = new Date(dateStr)
  const h = parseInt(d.toLocaleTimeString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' }))
  const m = parseInt(d.toLocaleTimeString('en-GB', { minute: '2-digit', timeZone: 'Asia/Bangkok' }))
  return (h - START_HOUR) * 60 + m
}

function durationMinutes(startStr, endStr) {
  return (new Date(endStr) - new Date(startStr)) / 60000
}

function snapToGrid(px) {
  return Math.round(px / SNAP_PX) * SNAP_PX
}

function pxToTime(px) {
  const totalMins = Math.round(px / SNAP_PX) * SNAP_MINUTES + START_HOUR * 60
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Overlap layout: assign lanes to overlapping events
function layoutEvents(dayClasses) {
  if (!dayClasses.length) return new Map()
  const sorted = [...dayClasses].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
  const lanes = [] // array of { end: number } per lane
  const result = new Map()

  sorted.forEach((cls) => {
    const top = minutesSinceStart(cls.starts_at)
    const height = durationMinutes(cls.starts_at, cls.ends_at)
    const end = top + height

    // Find first lane where this event fits
    let laneIdx = lanes.findIndex((lane) => lane.end <= top)
    if (laneIdx === -1) {
      laneIdx = lanes.length
      lanes.push({ end })
    } else {
      lanes[laneIdx].end = end
    }
    result.set(cls.id, { top, height, lane: laneIdx })
  })

  // Second pass: determine total overlapping lanes for width calculation
  sorted.forEach((cls) => {
    const layout = result.get(cls.id)
    const clsEnd = layout.top + layout.height
    // Count how many lanes are active during this event's time
    let maxLanes = 1
    sorted.forEach((other) => {
      const otherLayout = result.get(other.id)
      const otherEnd = otherLayout.top + otherLayout.height
      if (otherLayout.top < clsEnd && otherEnd > layout.top) {
        maxLanes = Math.max(maxLanes, otherLayout.lane + 1)
      }
    })
    layout.totalLanes = maxLanes
  })

  return result
}

export default function AdminSchedulePage() {
  const [classes, setClasses] = useState([])
  const [classTypes, setClassTypes] = useState([])
  const [instructors, setInstructors] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('week') // 'day' | 'week' | 'month'
  const [weekOffset, setWeekOffset] = useState(0)
  const [dayOffset, setDayOffset] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [toast, setToast] = useState(null)

  // Dialog states
  const [addDialog, setAddDialog] = useState(false)
  const [editDialog, setEditDialog] = useState(null)
  const [cancelDialog, setCancelDialog] = useState(null)
  const [rosterDialog, setRosterDialog] = useState(null)
  const [notifyDialog, setNotifyDialog] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [saveConfirm, setSaveConfirm] = useState(null) // 'this' | 'all' — which save mode needs confirm

  // Form state
  const [form, setForm] = useState({
    classTypeId: '', instructorId: '', date: '', startTime: '07:00', endTime: '08:00', capacity: 6, notes: '',
    recurring: false, days: [], weeks: 4, everyWeek: false,
  })

  // Private class member invite state
  const [inviteMembers, setInviteMembers] = useState([])
  const [inviteSearch, setInviteSearch] = useState('')
  const [inviteResults, setInviteResults] = useState([])
  const [inviteSearching, setInviteSearching] = useState(false)

  // Hover-to-add indicator
  const [hoverSlot, setHoverSlot] = useState(null) // { dayIdx, top }

  // Drag-to-create state
  const [createDrag, setCreateDrag] = useState(null) // { dayIdx, startTop, currentTop }

  // Drag & resize state
  const [dragState, setDragState] = useState(null)
  const [resizeState, setResizeState] = useState(null)
  const [pendingMove, setPendingMove] = useState(null) // { classId, cls, newDate, newStartTime, newEndTime, top, height, dayIdx }
  const justDragged = useRef(false) // suppress click after drag
  const gridRef = useRef(null)
  const columnRefs = useRef([])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const getDateRange = useCallback(() => {
    const now = new Date()
    if (viewMode === 'day') {
      const day = new Date(now)
      day.setDate(now.getDate() + dayOffset)
      day.setHours(0, 0, 0, 0)
      const end = new Date(day)
      end.setHours(23, 59, 59, 999)
      return { start: day, end }
    }
    if (viewMode === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
      const start = new Date(d)
      // Align to Monday before the 1st
      const dayOfWeek = start.getDay()
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      start.setDate(start.getDate() + diff)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(start.getDate() + 41) // 6 weeks
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
    // week
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7)
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)
    return { start: startOfWeek, end: endOfWeek }
  }, [viewMode, weekOffset, dayOffset, monthOffset])

  const fetchClasses = useCallback(async () => {
    const { start, end } = getDateRange()
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
  }, [getDateRange])

  useEffect(() => {
    fetch('/api/admin/schedule/options')
      .then((res) => res.ok ? res.json() : { classTypes: [], instructors: [] })
      .then((data) => { setClassTypes(data.classTypes || []); setInstructors(data.instructors || []) })
      .catch(console.error)
  }, [])

  useEffect(() => { setLoading(true); fetchClasses() }, [fetchClasses])

  const { start: rangeStart } = getDateRange()
  const today = new Date(); today.setHours(0, 0, 0, 0)

  // Compute viewDays based on viewMode
  const viewDays = (() => {
    if (viewMode === 'day') {
      const d = new Date(rangeStart)
      return [d]
    }
    if (viewMode === 'month') {
      const { start } = getDateRange()
      return Array.from({ length: 42 }, (_, i) => {
        const d = new Date(start); d.setDate(start.getDate() + i); return d
      })
    }
    // week
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(rangeStart); d.setDate(rangeStart.getDate() + i); return d
    })
  })()

  // For time grid views (day/week), the columns to render
  const gridDays = viewMode === 'month' ? [] : viewDays

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

  function openAddDialog(date, time, customEndTime) {
    const d = date ? new Date(date + 'T00:00:00') : new Date()
    const dayOfWeek = d.getDay()
    const startTime = time || '07:00'
    let endTime = customEndTime
    if (!endTime) {
      const [sh, sm] = startTime.split(':').map(Number)
      const endMins = sh * 60 + sm + 60
      endTime = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`
    }
    setForm({
      classTypeId: classTypes[0]?.id || '', instructorId: instructors[0]?.id || '',
      date: date || new Date().toISOString().split('T')[0],
      startTime, endTime, capacity: 6, notes: '',
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

  async function handleUpdate(mode = 'this', notify = false) {
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
          updateAll, unlinkFromRecurring,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setToast({ message: data.error || 'Failed to update', type: 'error' }); return }

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

      // Send notification email if requested
      if (notify && (editDialog.booked_count || 0) > 0) {
        try {
          await fetch('/api/admin/schedule/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ classId: editDialog.id }),
          })
          setToast({ message: `Class updated — ${editDialog.booked_count} member${editDialog.booked_count !== 1 ? 's' : ''} notified`, type: 'success' })
        } catch {
          // notification failed but update succeeded
        }
      }

      setSaveConfirm(null)
      setEditDialog(null)
      fetchClasses()
    } catch { setToast({ message: 'Something went wrong', type: 'error' }) }
    finally { setSubmitting(false) }
  }

  // Quick update for drag/resize — no dialog, direct API call
  async function handleQuickUpdate(cls, newDate, newStartTime, newEndTime, notify = false) {
    try {
      const res = await fetch('/api/admin/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cls.id,
          classTypeId: cls.class_type_id,
          instructorId: cls.instructor_id,
          startsAt: buildDatetime(newDate, newStartTime),
          endsAt: buildDatetime(newDate, newEndTime),
          capacity: cls.capacity,
          notes: cls.notes || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setToast({ message: data.error || 'Failed to move class', type: 'error' })
      } else {
        if (notify && (cls.booked_count || 0) > 0) {
          try {
            await fetch('/api/admin/schedule/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ classId: cls.id }),
            })
            setToast({ message: `Class moved — ${cls.booked_count} member${cls.booked_count !== 1 ? 's' : ''} notified`, type: 'success' })
          } catch {
            setToast({ message: 'Class moved (notification failed)', type: 'success' })
          }
        } else {
          setToast({ message: 'Class moved', type: 'success' })
        }
      }
      fetchClasses()
    } catch {
      setToast({ message: 'Something went wrong', type: 'error' })
      fetchClasses()
    }
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

  async function handleDelete() {
    if (!deleteDialog) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/schedule/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classScheduleId: deleteDialog.id }),
      })
      const data = await res.json()
      if (!res.ok) { setToast({ message: data.error || 'Failed to delete', type: 'error' }); return }
      setToast({ message: 'Class permanently deleted', type: 'success' })
      setDeleteDialog(null); fetchClasses()
    } catch { setToast({ message: 'Something went wrong', type: 'error' }) }
    finally { setSubmitting(false) }
  }

  const viewLabel = (() => {
    if (viewMode === 'day') {
      return viewDays[0].toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    }
    if (viewMode === 'month') {
      const now = new Date()
      const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
    const s = viewDays[0], e = viewDays[6]
    const sM = s.toLocaleDateString('en-US', { month: 'short' })
    const eM = e.toLocaleDateString('en-US', { month: 'short' })
    return sM === eM ? `${sM} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}` : `${sM} ${s.getDate()} – ${eM} ${e.getDate()}, ${e.getFullYear()}`
  })()

  // ─── Drag handlers ──────────────────────────────────────────────────────────
  function handleDragStart(e, cls, dayIdx) {
    if (cls.status === 'cancelled') return
    e.preventDefault()
    const top = minutesSinceStart(cls.starts_at)
    const height = durationMinutes(cls.starts_at, cls.ends_at)
    setDragState({
      cls, dayIdx, top, height,
      startX: e.clientX, startY: e.clientY,
      currentTop: top, currentDayIdx: dayIdx,
      moved: false,
    })
  }

  function handleResizeStart(e, cls, dayIdx) {
    e.preventDefault()
    e.stopPropagation()
    const top = minutesSinceStart(cls.starts_at)
    const height = durationMinutes(cls.starts_at, cls.ends_at)
    setResizeState({
      cls, dayIdx, top, originalHeight: height,
      startY: e.clientY, currentHeight: height,
    })
  }

  useEffect(() => {
    if (!dragState && !resizeState) return

    function onMove(e) {
      if (dragState) {
        const dx = e.clientX - dragState.startX
        const dy = e.clientY - dragState.startY
        const moved = Math.abs(dx) > 3 || Math.abs(dy) > 3

        const rawTop = dragState.top + dy
        const snappedTop = Math.max(0, Math.min(TOTAL_HEIGHT - dragState.height, snapToGrid(rawTop)))

        // Figure out which day column we're over
        let newDayIdx = dragState.dayIdx
        if (gridRef.current) {
          const cols = columnRefs.current
          for (let i = 0; i < cols.length; i++) {
            if (cols[i]) {
              const rect = cols[i].getBoundingClientRect()
              if (e.clientX >= rect.left && e.clientX < rect.right) {
                newDayIdx = i
                break
              }
            }
          }
        }

        setDragState((prev) => ({ ...prev, currentTop: snappedTop, currentDayIdx: newDayIdx, moved: moved || prev.moved }))
      }

      if (resizeState) {
        const dy = e.clientY - resizeState.startY
        const rawHeight = resizeState.originalHeight + dy
        const snappedHeight = Math.max(MIN_BLOCK_HEIGHT, snapToGrid(rawHeight))
        const maxHeight = TOTAL_HEIGHT - resizeState.top
        setResizeState((prev) => ({ ...prev, currentHeight: Math.min(snappedHeight, maxHeight) }))
      }
    }

    function onUp() {
      if (dragState) {
        if (dragState.moved) {
          justDragged.current = true
          setTimeout(() => { justDragged.current = false }, 100)
          const newDate = gridDays[dragState.currentDayIdx].toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
          const newStartTime = pxToTime(dragState.currentTop)
          const endMins = dragState.currentTop + dragState.height
          const newEndTime = pxToTime(endMins)

          // Block moving into a past time slot
          const proposedStart = new Date(`${newDate}T${newStartTime}:00+07:00`)
          if (proposedStart < new Date()) {
            setToast({ message: 'Cannot move a class into a past time slot', type: 'error' })
          } else {
            setPendingMove({
              classId: dragState.cls.id, cls: dragState.cls,
              newDate, newStartTime, newEndTime,
              top: dragState.currentTop, height: dragState.height, dayIdx: dragState.currentDayIdx,
            })
          }
        }
        setDragState(null)
      }
      if (resizeState) {
        justDragged.current = true
        setTimeout(() => { justDragged.current = false }, 100)
        const newEndMins = resizeState.top + resizeState.currentHeight
        const newEndTime = pxToTime(newEndMins)
        const date = new Date(resizeState.cls.starts_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
        const startTime = new Date(resizeState.cls.starts_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })
        setPendingMove({
          classId: resizeState.cls.id, cls: resizeState.cls,
          newDate: date, newStartTime: startTime, newEndTime,
          top: resizeState.top, height: resizeState.currentHeight, dayIdx: resizeState.dayIdx,
        })
        setResizeState(null)
      }
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setDragState(null)
        setResizeState(null)
        setPendingMove(null)
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKeyDown)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState, resizeState])

  // Drag-to-create on empty grid space
  useEffect(() => {
    if (!createDrag) return

    function onMove(e) {
      const dy = Math.abs(e.clientY - createDrag.startY)
      if (dy < 5 && !createDrag.activated) return // wait for real drag
      const col = columnRefs.current[createDrag.dayIdx]
      if (!col) return
      const rect = col.getBoundingClientRect()
      const y = e.clientY - rect.top
      const snappedY = Math.max(createDrag.startTop + SNAP_PX, Math.min(TOTAL_HEIGHT, snapToGrid(y)))
      setCreateDrag((prev) => ({ ...prev, currentTop: snappedY, activated: true }))
    }

    function onUp() {
      const wasActivated = createDrag.activated
      if (wasActivated) {
        justDragged.current = true
        setTimeout(() => { justDragged.current = false }, 150)
      }
      const startTime = pxToTime(createDrag.startTop)
      const endTime = wasActivated ? pxToTime(createDrag.currentTop) : null
      const dateKey = gridDays[createDrag.dayIdx].toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
      setCreateDrag(null)
      setHoverSlot(null)

      // Block creation in past time slots
      const proposedStart = new Date(`${dateKey}T${startTime}:00+07:00`)
      if (proposedStart < new Date()) {
        setToast({ message: 'Cannot create a class in a past time slot', type: 'error' })
        return
      }

      if (wasActivated) {
        openAddDialog(dateKey, startTime, endTime)
      }
      // If not activated (just a click), let handleGridClick handle it
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') { setCreateDrag(null) }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKeyDown)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createDrag])

  // Click on empty grid space to create
  function confirmPendingMove(notify = false) {
    if (!pendingMove) return
    handleQuickUpdate(pendingMove.cls, pendingMove.newDate, pendingMove.newStartTime, pendingMove.newEndTime, notify)
    setPendingMove(null)
  }

  function cancelPendingMove() {
    setPendingMove(null)
  }

  function handleGridClick(e, dayIdx) {
    if (dragState || resizeState || pendingMove || createDrag) return
    if (justDragged.current) return
    // Only trigger on direct click on column background
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const snappedY = snapToGrid(y)
    const time = pxToTime(snappedY)
    const dateKey = gridDays[dayIdx].toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

    // Block creation in past time slots
    const proposedStart = new Date(`${dateKey}T${time}:00+07:00`)
    if (proposedStart < new Date()) {
      setToast({ message: 'Cannot create a class in a past time slot', type: 'error' })
      return
    }
    openAddDialog(dateKey, time)
  }

  function handleGridPointerDown(e, dayIdx) {
    if (dragState || resizeState || pendingMove || createDrag) return
    // Only trigger on column background
    if (e.target !== e.currentTarget) return
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const snappedY = snapToGrid(y)
    setCreateDrag({ dayIdx, startTop: snappedY, currentTop: snappedY + SNAP_PX, startY: e.clientY, activated: false })
    setHoverSlot(null)
  }

  // Current time line position
  const [nowMinutes, setNowMinutes] = useState(() => {
    const now = new Date()
    const h = parseInt(now.toLocaleTimeString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' }))
    const m = parseInt(now.toLocaleTimeString('en-GB', { minute: '2-digit', timeZone: 'Asia/Bangkok' }))
    return (h - START_HOUR) * 60 + m
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      const h = parseInt(now.toLocaleTimeString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' }))
      const m = parseInt(now.toLocaleTimeString('en-GB', { minute: '2-digit', timeZone: 'Asia/Bangkok' }))
      setNowMinutes((h - START_HOUR) * 60 + m)
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const todayIdx = gridDays.findIndex((d) => d.toDateString() === new Date().toDateString())

  // Auto-scroll to current time on mount
  const scrollContainerRef = useRef(null)
  useEffect(() => {
    if (!loading && scrollContainerRef.current) {
      const scrollTarget = Math.max(0, nowMinutes - 60) // scroll to 1hr before now
      scrollContainerRef.current.scrollTop = scrollTarget
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Schedule</h1>
        <Button onClick={() => openAddDialog()}>+ Add Class</Button>
      </div>

      {toast && (
        <div className={cn('fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 px-4 py-3 rounded-lg border flex items-center gap-3 shadow-lg sm:max-w-sm animate-in slide-in-from-bottom-2', toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400 backdrop-blur-sm' : 'bg-green-500/10 border-green-500/20 text-green-400 backdrop-blur-sm')}>
          <span className="text-sm">{toast.message}</span>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 shrink-0"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Navigation bar */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        {/* Prev / Today / Next */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => viewMode === 'day' ? setDayOffset(o => o - 1) : viewMode === 'month' ? setMonthOffset(o => o - 1) : setWeekOffset(o => o - 1)}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-card-border text-muted hover:text-foreground hover:bg-white/[0.04] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setDayOffset(0); setWeekOffset(0); setMonthOffset(0) }}
            className="h-8 px-3 text-xs font-medium rounded-md border border-card-border text-muted hover:text-foreground hover:bg-white/[0.04] transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => viewMode === 'day' ? setDayOffset(o => o + 1) : viewMode === 'month' ? setMonthOffset(o => o + 1) : setWeekOffset(o => o + 1)}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-card-border text-muted hover:text-foreground hover:bg-white/[0.04] transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Date label */}
        <p className="text-sm font-semibold text-foreground flex-1 ml-1">{viewLabel}</p>

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-card-border bg-card p-0.5">
          {['day', 'week', 'month'].map((mode) => (
            <button
              key={mode}
              onClick={() => {
                if (mode === viewMode) return
                // Sync offsets when switching views
                if (mode === 'day' && viewMode === 'week') {
                  // Go to today if it's in current week, else Monday of current week
                  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0)
                  const inWeek = gridDays.some(d => d.toDateString() === todayDate.toDateString())
                  if (!inWeek) {
                    const diff = Math.round((gridDays[0] - todayDate) / (1000 * 60 * 60 * 24))
                    setDayOffset(diff)
                  }
                } else if (mode === 'week' && viewMode === 'day') {
                  // Set week offset to contain the current day view date
                  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0)
                  const targetDay = new Date(todayDate); targetDay.setDate(todayDate.getDate() + dayOffset)
                  const diffDays = Math.round((targetDay - todayDate) / (1000 * 60 * 60 * 24))
                  setWeekOffset(Math.floor(diffDays / 7))
                }
                setViewMode(mode)
              }}
              className={cn(
                'px-3 h-7 text-xs font-medium rounded-md transition-all capitalize',
                viewMode === mode
                  ? 'bg-accent/15 text-accent shadow-sm'
                  : 'text-muted hover:text-foreground'
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 bg-card border border-card-border rounded-lg animate-pulse" />
      ) : viewMode === 'month' ? (
        /* ─── Month View ──────────────────────────────────────────────────────── */
        <div className="flex-1 min-h-0 border border-card-border rounded-lg overflow-y-auto bg-card">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-card-border">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="text-center py-2 text-[10px] text-muted uppercase tracking-wider border-r border-card-border last:border-r-0">{d}</div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7">
            {viewDays.map((day, i) => {
              const dateKey = day.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
              const dayClasses = (classesByDay[dateKey] || []).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
              const isToday = day.toDateString() === new Date().toDateString()
              const now = new Date()
              const currentMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1).getMonth()
              const isOtherMonth = day.getMonth() !== currentMonth
              const isPast = day < today
              const maxShow = 3
              const overflow = dayClasses.length - maxShow

              return (
                <button
                  key={i}
                  onClick={() => {
                    const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0)
                    const diff = Math.round((day - todayDate) / (1000 * 60 * 60 * 24))
                    setDayOffset(diff)
                    setViewMode('day')
                  }}
                  className={cn(
                    'min-h-[100px] p-1.5 text-left border-r border-b border-card-border last:border-r-0 transition-colors hover:bg-white/[0.03]',
                    isOtherMonth && 'opacity-40',
                    isPast && !isOtherMonth && 'opacity-60',
                  )}
                >
                  <div className={cn(
                    'w-7 h-7 flex items-center justify-center rounded-full text-xs font-semibold mb-1',
                    isToday ? 'bg-accent text-background' : 'text-foreground'
                  )}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayClasses.slice(0, maxShow).map((cls) => {
                      const color = cls.class_types?.color || '#c8a750'
                      const time = new Date(cls.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok' })
                      const isCancelled = cls.status === 'cancelled'
                      return (
                        <div
                          key={cls.id}
                          className={cn(
                            'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] leading-tight truncate',
                            isCancelled && 'opacity-40 line-through'
                          )}
                          style={{ backgroundColor: `${color}20`, color }}
                        >
                          <span className="font-medium truncate">{time} {cls.class_types?.name || 'Class'}</span>
                        </div>
                      )
                    })}
                    {overflow > 0 && (
                      <p className="text-[10px] text-muted pl-1.5">+{overflow} more</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        /* ─── Day / Week Time Grid ────────────────────────────────────────────── */
        <div className="flex-1 min-h-0 flex flex-col border border-card-border rounded-lg overflow-hidden bg-card">
          {/* Day headers */}
          <div className="flex border-b border-card-border sticky top-0 z-20 bg-card shrink-0">
            <div className="w-14 shrink-0 border-r border-card-border" />
            {gridDays.map((day, i) => {
              const isToday = day.toDateString() === new Date().toDateString()
              const isPast = day < today
              return (
                <div
                  key={i}
                  className={cn(
                    'flex-1 text-center py-2 border-r border-card-border last:border-r-0',
                    viewMode === 'day' ? 'min-w-0' : 'min-w-[100px]',
                    isPast && 'opacity-50',
                  )}
                >
                  <p className="text-[10px] text-muted uppercase tracking-wider">
                    {day.toLocaleDateString('en-US', { weekday: viewMode === 'day' ? 'long' : 'short' })}
                  </p>
                  <p className={cn('text-lg font-bold leading-tight', isToday ? 'text-accent' : 'text-foreground')}>{day.getDate()}</p>
                </div>
              )
            })}
          </div>

          {/* Time grid */}
          <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
            <div ref={gridRef} className="flex relative" style={{ height: TOTAL_HEIGHT }}>
              {/* Time gutter */}
              <div className="w-14 shrink-0 border-r border-card-border relative">
                {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => {
                  if (i === 0) return null // skip first label — clipped by header
                  const h = i + START_HOUR
                  return (
                    <div key={i} className="absolute right-2 text-[10px] text-muted -translate-y-1/2" style={{ top: i * HOUR_HEIGHT }}>
                      {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
                    </div>
                  )
                })}
              </div>

              {/* Day columns */}
              {gridDays.map((day, dayIdx) => {
                const dateKey = day.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
                const dayClasses = classesByDay[dateKey] || []
                const layouts = layoutEvents(dayClasses)
                const isToday = dayIdx === todayIdx
                const isPast = day < today

                return (
                  <div
                    key={dayIdx}
                    ref={(el) => { columnRefs.current[dayIdx] = el }}
                    className={cn('flex-1 relative border-r border-card-border last:border-r-0', viewMode !== 'day' && 'min-w-[100px]', isPast && 'opacity-50')}
                    style={{ height: TOTAL_HEIGHT }}
                    onPointerDown={(e) => handleGridPointerDown(e, dayIdx)}
                    onClick={(e) => handleGridClick(e, dayIdx)}
                    onMouseMove={(e) => {
                      if (dragState || resizeState || pendingMove || createDrag) return
                      if (e.target !== e.currentTarget) { setHoverSlot(null); return }
                      const rect = e.currentTarget.getBoundingClientRect()
                      const y = e.clientY - rect.top
                      const snappedY = snapToGrid(y)
                      setHoverSlot((prev) => (prev?.dayIdx === dayIdx && prev?.top === snappedY) ? prev : { dayIdx, top: snappedY })
                    }}
                    onMouseLeave={() => setHoverSlot(null)}
                  >
                    {/* Hour lines */}
                    {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                      <div key={i} className="absolute left-0 right-0 border-t border-card-border/40 pointer-events-none" style={{ top: i * HOUR_HEIGHT }} />
                    ))}
                    {/* Half-hour dashed lines */}
                    {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                      <div key={`h-${i}`} className="absolute left-0 right-0 border-t border-dashed border-card-border/20 pointer-events-none" style={{ top: i * HOUR_HEIGHT + 30 }} />
                    ))}

                    {/* Hover-to-add indicator */}
                    {hoverSlot?.dayIdx === dayIdx && !dragState && !resizeState && !pendingMove && !createDrag && (() => {
                      const hoverTime = pxToTime(hoverSlot.top)
                      const hoverDate = gridDays[dayIdx].toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
                      const isInPast = new Date(`${hoverDate}T${hoverTime}:00+07:00`) < new Date()
                      if (isInPast) return null
                      return (
                        <div
                          className="absolute left-1 right-1 rounded-md border-2 border-dashed border-accent/30 bg-accent/[0.04] pointer-events-none transition-all duration-100 flex items-center justify-center"
                          style={{ top: `${hoverSlot.top}px`, height: `${HOUR_HEIGHT}px` }}
                        >
                          <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center">
                            <Plus className="w-3.5 h-3.5 text-accent/60" />
                          </div>
                        </div>
                      )
                    })()}

                    {/* Drag-to-create preview */}
                    {createDrag?.dayIdx === dayIdx && (
                      <div
                        className="absolute left-1 right-1 rounded-md border-2 border-dashed border-accent/50 bg-accent/[0.08] pointer-events-none z-20 flex items-center justify-center"
                        style={{ top: `${createDrag.startTop}px`, height: `${Math.max(SNAP_PX, createDrag.currentTop - createDrag.startTop)}px` }}
                      >
                        <div className="flex items-center gap-1.5 text-accent/70">
                          <Plus className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-medium">{pxToTime(createDrag.startTop)} – {pxToTime(createDrag.currentTop)}</span>
                        </div>
                      </div>
                    )}

                    {/* Today highlight */}
                    {isToday && <div className="absolute inset-0 bg-accent/[0.02] pointer-events-none" />}

                    {/* Current time line */}
                    {isToday && nowMinutes >= 0 && nowMinutes <= TOTAL_HEIGHT && (
                      <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: nowMinutes }}>
                        <div className="relative">
                          <div className="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-red-500" />
                          <div className="h-[2px] bg-red-500 w-full" />
                        </div>
                      </div>
                    )}

                    {/* Event blocks */}
                    {dayClasses.map((cls) => {
                      const layout = layouts.get(cls.id)
                      if (!layout) return null
                      const isDragging = dragState?.cls.id === cls.id
                      const isResizing = resizeState?.cls.id === cls.id

                      // Use drag/resize/pending position if active
                      let top = layout.top
                      let height = layout.height
                      const hasPending = pendingMove?.classId === cls.id

                      if (isDragging) {
                        top = dragState.currentTop
                        height = dragState.height
                        if (dragState.currentDayIdx !== dayIdx) return null
                      } else if (hasPending) {
                        // Keep block at its pending position until confirmed/cancelled
                        top = pendingMove.top
                        height = pendingMove.height
                        if (pendingMove.dayIdx !== dayIdx) return null
                      }
                      if (isResizing) {
                        height = resizeState.currentHeight
                      }

                      const isCancelled = cls.status === 'cancelled'
                      const isFull = cls.booked_count >= cls.capacity
                      const isPrivate = cls.is_private || cls.class_types?.is_private
                      const isRecurring = !!cls.recurring_id
                      const fillPct = cls.capacity > 0 ? Math.min((cls.booked_count / cls.capacity) * 100, 100) : 0
                      const color = cls.class_types?.color || '#c8a750'
                      const widthPct = 100 / layout.totalLanes
                      const leftPct = layout.lane * widthPct

                      const time = new Date(cls.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok' })

                      return (
                        <div
                          key={cls.id}
                          className={cn(
                            'absolute rounded-md border-l-[3px] overflow-hidden select-none transition-shadow group/block',
                            isCancelled ? 'opacity-40 cursor-default' : 'cursor-grab active:cursor-grabbing',
                            isDragging && 'z-50 shadow-lg ring-2 ring-accent/40 opacity-90',
                            isResizing && 'z-50 shadow-lg',
                            !isCancelled && !isDragging && 'hover:shadow-md hover:z-10',
                          )}
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(height, 15)}px`,
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                            borderLeftColor: isCancelled ? '#ef4444' : color,
                            backgroundColor: isCancelled ? 'rgba(239,68,68,0.05)' : `${color}15`,
                          }}
                          onPointerDown={(e) => {
                            if (isCancelled || hasPending) return
                            handleDragStart(e, cls, dayIdx)
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (justDragged.current) return
                            if (pendingMove) return
                            if (!dragState) openEditDialog(cls)
                          }}
                        >
                          <div className="px-1.5 py-1 h-full flex flex-col overflow-hidden">
                            <div className="flex items-center gap-1">
                              <span className={cn('text-[11px] font-semibold truncate leading-tight', isCancelled ? 'line-through text-muted' : 'text-foreground')}>
                                {cls.class_types?.name || 'Class'}
                              </span>
                              {isRecurring && !isCancelled && <span className="text-[10px] text-purple-400/70 shrink-0">↻</span>}
                              {isPrivate && <Lock className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                            </div>
                            <p className="text-[10px] text-muted leading-tight">{time}</p>
                            {height >= 45 && cls.instructors?.name && (
                              <p className="text-[9px] text-muted/60 truncate">{cls.instructors.name}</p>
                            )}
                            {height >= 35 && !isCancelled && (
                              <div className="mt-auto">
                                <span className={cn('text-[9px] font-semibold', isFull ? 'text-red-400' : fillPct >= 75 ? 'text-amber-400' : 'text-muted')}>
                                  {cls.booked_count}/{cls.capacity}
                                </span>
                              </div>
                            )}
                            {isCancelled && (
                              <div className="flex items-center justify-between mt-auto">
                                <span className="text-[9px] text-red-400 font-medium">Cancelled</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeleteDialog(cls) }}
                                  className="text-red-400/60 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Cancel button — top-right on hover */}
                          {!isCancelled && !hasPending && !isDragging && !isResizing && (
                            <button
                              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500/10 text-red-400/50 hover:bg-red-500/25 hover:text-red-400 flex items-center justify-center transition-all opacity-0 group-hover/block:opacity-100 z-10"
                              title="Cancel class"
                              onClick={(e) => { e.stopPropagation(); setCancelDialog(cls) }}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}

                          {/* Resize handle */}
                          {!isCancelled && !pendingMove?.classId && (
                            <div
                              className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover/block:opacity-100 transition-opacity"
                              onPointerDown={(e) => handleResizeStart(e, cls, dayIdx)}
                            >
                              <div className="mx-auto w-8 h-1 rounded-full bg-foreground/30 mt-0.5" />
                            </div>
                          )}

                          {/* Pending move confirm/cancel */}
                          {pendingMove?.classId === cls.id && (
                            <div className="absolute inset-0 flex items-center justify-center gap-1 bg-background/80 backdrop-blur-[2px] rounded-md z-10" onPointerDown={(e) => e.stopPropagation()}>
                              {(cls.booked_count || 0) > 0 ? (
                                <>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); confirmPendingMove(true) }}
                                    className="w-7 h-7 rounded-full bg-accent/20 text-accent hover:bg-accent/30 flex items-center justify-center transition-colors"
                                    title="Save & notify members"
                                  >
                                    <Mail className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); confirmPendingMove(false) }}
                                    className="w-7 h-7 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center justify-center transition-colors"
                                    title="Save without notifying"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); confirmPendingMove() }}
                                  className="w-7 h-7 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center justify-center transition-colors"
                                  title="Confirm"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); cancelPendingMove() }}
                                className="w-7 h-7 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Render dragged block from another column into this one */}
                    {dragState && dragState.currentDayIdx === dayIdx && dragState.dayIdx !== dayIdx && (() => {
                      const cls = dragState.cls
                      const color = cls.class_types?.color || '#c8a750'
                      return (
                        <div
                          className="absolute rounded-md border-l-[3px] overflow-hidden select-none z-50 shadow-lg ring-2 ring-accent/40 opacity-90"
                          style={{
                            top: `${dragState.currentTop}px`,
                            height: `${dragState.height}px`,
                            left: '2px',
                            width: 'calc(100% - 4px)',
                            borderLeftColor: color,
                            backgroundColor: `${color}15`,
                          }}
                        >
                          <div className="px-1.5 py-1">
                            <span className="text-[11px] font-semibold text-foreground truncate">{cls.class_types?.name || 'Class'}</span>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Render pending-move block from another column into this one */}
                    {pendingMove && pendingMove.dayIdx === dayIdx && !dayClasses.some(c => c.id === pendingMove.classId) && (() => {
                      const cls = pendingMove.cls
                      const color = cls.class_types?.color || '#c8a750'
                      return (
                        <div
                          className="absolute rounded-md border-l-[3px] overflow-hidden select-none"
                          style={{
                            top: `${pendingMove.top}px`,
                            height: `${Math.max(pendingMove.height, 15)}px`,
                            left: '2px',
                            width: 'calc(100% - 4px)',
                            borderLeftColor: color,
                            backgroundColor: `${color}15`,
                          }}
                        >
                          <div className="px-1.5 py-1 h-full flex flex-col overflow-hidden">
                            <span className="text-[11px] font-semibold text-foreground truncate">{cls.class_types?.name || 'Class'}</span>
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center gap-1 bg-background/80 backdrop-blur-[2px] rounded-md z-10" onPointerDown={(e) => e.stopPropagation()}>
                            {(pendingMove.cls.booked_count || 0) > 0 ? (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); confirmPendingMove(true) }}
                                  className="w-7 h-7 rounded-full bg-accent/20 text-accent hover:bg-accent/30 flex items-center justify-center transition-colors"
                                  title="Save & notify members"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); confirmPendingMove(false) }}
                                  className="w-7 h-7 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center justify-center transition-colors"
                                  title="Save without notifying"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); confirmPendingMove() }}
                                className="w-7 h-7 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center justify-center transition-colors"
                                title="Confirm"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); cancelPendingMove() }}
                              className="w-7 h-7 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Dialogs (preserved from original) ─────────────────────────────────── */}

      {/* Add Class Dialog */}
      <Dialog open={addDialog} onOpenChange={(open) => !open && setAddDialog(false)}>
        <DialogContent className="sm:max-w-md p-0 gap-0" hideClose onOpenAutoFocus={(e) => e.preventDefault()}>
          {(() => {
            const ct = classTypes.find((c) => c.id === form.classTypeId)
            const addColor = ct?.color || '#c8a750'
            const addHue = form.recurring ? '#a78bfa' : ct?.is_private ? '#fbbf24' : '#38bdf8'
            return <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${addColor}, ${addHue}88)` }} />
          })()}
          <div className="px-4 sm:px-6 pt-4 pb-2">
            <div className="flex items-start justify-between gap-3">
              <DialogHeader className="space-y-1 min-w-0">
                <DialogTitle>Add Class</DialogTitle>
                <DialogDescription>Schedule a new class — toggle recurring to create multiple.</DialogDescription>
              </DialogHeader>
              <button
                onClick={() => setAddDialog(false)}
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-card-border/60 text-muted hover:text-foreground hover:bg-card-border transition-colors sm:w-7 sm:h-7 sm:bg-transparent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
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
                                <Image src={m.avatar_url} alt="" width={24} height={24} className="object-cover rounded-full" unoptimized />
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
                              <Image src={m.avatar_url} alt="" width={20} height={20} className="object-cover rounded-full" unoptimized />
                            ) : (
                              <span className="text-[8px] font-bold text-accent">{(m.name || '?')[0]?.toUpperCase()}</span>
                            )}
                          </div>
                          <span className="text-[11px] text-foreground font-medium">{m.name?.split(' ')[0] || m.email?.split('@')[0]}</span>
                          <button
                            type="button"
                            onClick={() => setInviteMembers((prev) => prev.filter((p) => p.id !== m.id))}
                            className="text-muted hover:text-red-400 text-[10px] ml-0.5"
                          ><X className="w-3 h-3" /></button>
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
      <Dialog open={!!editDialog} onOpenChange={(open) => { if (!open) { setEditDialog(null); setSaveConfirm(null) } }}>
        <DialogContent className="sm:max-w-3xl p-0 gap-0" hideClose onOpenAutoFocus={(e) => e.preventDefault()}>
          {editDialog && (() => {
            const color = editDialog.class_types?.color || '#c8a750'
            const isRecurring = !!editDialog.recurring_id
            const isPrivate = editDialog.class_types?.is_private
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
                <div className="h-1.5 w-full rounded-t-lg" style={{ background: `linear-gradient(90deg, ${color}, ${categoryHue}88)` }} />
                <div className="px-4 sm:px-6 pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                      <h2 className="text-lg sm:text-xl font-bold text-foreground">{editDialog.class_types?.name || 'Class'}</h2>
                      {isRecurring && (
                        <span className="text-[11px] font-medium text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="text-sm">↻</span> Recurring
                        </span>
                      )}
                      {isPrivate && (
                        <span className="text-[11px] font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full flex items-center gap-1"><Lock className="w-3 h-3" /> Private</span>
                      )}
                    </div>
                    <button
                      onClick={() => setEditDialog(null)}
                      className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-card-border/60 text-muted hover:text-foreground hover:bg-card-border transition-colors sm:w-7 sm:h-7 sm:bg-transparent"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted min-w-0">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="w-4 h-4 shrink-0" />
                        {dateLabel}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 shrink-0" />
                        {timeLabel} – {endLabel}
                      </span>
                      {editDialog.instructors?.name && (
                        <span className="flex items-center gap-1.5">
                          <User className="w-4 h-4 shrink-0" />
                          {editDialog.instructors.name}
                        </span>
                      )}
                    </div>
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
                                    <Image src={m.avatar_url} alt="" width={20} height={20} className="object-cover rounded-full" unoptimized />
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
                                    <Image src={m.avatar_url} alt="" width={20} height={20} className="object-cover rounded-full" unoptimized />
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

                <div className="border-t border-card-border" />

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

                <div className="border-t border-card-border px-4 sm:px-6 py-4">
                  {/* Save confirm strip — 3 options when members are booked */}
                  {saveConfirm && (editDialog.booked_count || 0) > 0 ? (
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-muted flex-1">
                        {editDialog.booked_count} member{editDialog.booked_count !== 1 ? 's' : ''} booked
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleUpdate(saveConfirm, true)}
                          disabled={submitting}
                          className="h-9 px-3 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                          title="Save and notify members"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Save & Notify</span>
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleUpdate(saveConfirm, false)}
                          disabled={submitting}
                          className="h-9 px-3 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                          title="Save without notifying"
                        >
                          <MailX className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Save Quiet</span>
                        </button>
                        <button
                          onClick={() => setSaveConfirm(null)}
                          className="w-9 h-9 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 flex items-center justify-center transition-colors"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button variant="outline" className="text-red-400 border-red-400/30 hover:bg-red-400/10 w-full sm:w-auto" onClick={() => { setEditDialog(null); setCancelDialog(editDialog) }}>
                        {isRecurring ? 'Cancel...' : 'Cancel Class'}
                      </Button>
                      <div className="flex flex-col sm:flex-row gap-2 sm:ml-auto">
                        <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEditDialog(null)}>Close</Button>
                        {isRecurring ? (
                          <>
                            <Button variant="outline" className="w-full sm:w-auto" onClick={() => (editDialog.booked_count || 0) > 0 ? setSaveConfirm('this') : handleUpdate('this')} disabled={submitting} title="Save changes to this class only and remove it from the recurring set">
                              {submitting ? 'Saving...' : 'Save This Only'}
                            </Button>
                            <Button className="w-full sm:w-auto" onClick={() => (editDialog.booked_count || 0) > 0 ? setSaveConfirm('all') : handleUpdate('all')} disabled={submitting}>
                              {submitting ? 'Saving...' : 'Save All Recurring'}
                            </Button>
                          </>
                        ) : (
                          <Button className="w-full sm:w-auto" onClick={() => (editDialog.booked_count || 0) > 0 ? setSaveConfirm('this') : handleUpdate('this')} disabled={submitting}>
                            {submitting ? 'Saving...' : form.recurring ? 'Save & Create Recurring' : 'Save Changes'}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Cancel Class Confirmation */}
      <Dialog open={!!cancelDialog} onOpenChange={(open) => !open && setCancelDialog(null)}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
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
                <Button className="bg-red-600/80 hover:bg-red-700 text-white text-xs" onClick={() => handleCancel(true)} disabled={submitting}>
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

      {/* Delete Cancelled Class Confirmation */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Permanently Delete Class</DialogTitle>
            <DialogDescription>This will permanently remove this cancelled class. It will no longer be visible to anyone.</DialogDescription>
          </DialogHeader>
          {deleteDialog && (
            <div className="py-4 space-y-2">
              <p className="text-sm font-medium text-foreground">{deleteDialog.class_types?.name || 'Class'}</p>
              <p className="text-xs text-muted">
                {new Date(deleteDialog.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' })} at {new Date(deleteDialog.starts_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok' })}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={submitting}>
              {submitting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
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
        <DialogContent className="sm:max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
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
  const [confirmRemove, setConfirmRemove] = useState(null)
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
    await addMember(userId)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Manage Roster</DialogTitle>
          <DialogDescription>
            {cls.class_types?.name} — {new Date(cls.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' })}
            {' · '}{roster.length}/{cls.capacity} booked{waitlist.length > 0 ? ` · ${waitlist.length} waitlisted` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Add Member</Label>
          <form onSubmit={(e) => { e.preventDefault(); searchMembers() }} className="flex gap-2">
            <Input placeholder="Search by name or email..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            <Button type="submit" variant="outline" disabled={searching}>{searching ? '...' : 'Search'}</Button>
          </form>
          {searchResults.length > 0 && (
            <div className="border border-card-border rounded-lg max-h-[150px] overflow-y-auto">
              {searchResults.filter((m) => !allUserIds.has(m.id)).map((m) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2 border-b border-card-border last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center overflow-hidden shrink-0">
                      {m.avatar_url ? (
                        <Image src={m.avatar_url} alt="" width={24} height={24} className="object-cover rounded-full" unoptimized />
                      ) : (
                        <span className="text-accent text-[9px] font-bold">{(m.name || m.email)?.[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{m.name || 'No name'}</p>
                      <p className="text-[10px] text-muted truncate">{m.email}</p>
                    </div>
                  </div>
                  <Button size="sm" className="text-xs h-7 px-2" onClick={() => addMember(m.id)} disabled={actionLoading === m.id}>
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

        <div className="flex border-b border-card-border">
          <button onClick={() => setActiveTab('attendees')} className={cn('flex-1 text-sm py-2 transition-colors border-b-2 -mb-px', activeTab === 'attendees' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-foreground')}>
            Attendees ({roster.length})
          </button>
          <button onClick={() => setActiveTab('waitlist')} className={cn('flex-1 text-sm py-2 transition-colors border-b-2 -mb-px', activeTab === 'waitlist' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-foreground')}>
            Waitlist ({waitlist.length})
          </button>
        </div>

        {activeTab === 'attendees' && (
          <div className="space-y-1 max-h-[250px] overflow-y-auto">
            {roster.length > 0 ? roster.map((m, i) => (
              <div key={m.id || i} className="flex items-center justify-between p-2 rounded-lg border border-card-border">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center overflow-hidden shrink-0">
                    {m.avatar_url ? (
                      <Image src={m.avatar_url} alt="" width={28} height={28} className="object-cover rounded-full" unoptimized />
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
                  {confirmRemove?.userId === m.id && confirmRemove?.type === 'roster' ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-red-400">Remove?</span>
                      <button onClick={() => { setConfirmRemove(null); removeMember(m.id) }} disabled={actionLoading === m.id} className="text-[10px] font-medium text-red-400 hover:text-red-300 px-1.5 py-0.5 border border-red-400/30 rounded transition-colors">
                        {actionLoading === m.id ? '...' : 'Yes'}
                      </button>
                      <button onClick={() => setConfirmRemove(null)} className="text-[10px] font-medium text-muted hover:text-foreground px-1.5 py-0.5 border border-card-border rounded transition-colors">No</button>
                    </div>
                  ) : (
                    <>
                      <Badge variant="success" className="text-[10px] capitalize">{m.status}</Badge>
                      <button onClick={() => setConfirmRemove({ userId: m.id, type: 'roster', name: m.name })} className="text-red-400 hover:text-red-300 text-xs transition-colors" title="Remove from class">
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted text-center py-4">No bookings yet</p>
            )}
          </div>
        )}

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
                      <Image src={m.avatar_url} alt="" width={28} height={28} className="object-cover rounded-full" unoptimized />
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
                  {confirmRemove?.userId === m.id && confirmRemove?.type === 'waitlist' ? (
                    <>
                      <span className="text-[10px] text-red-400">Remove?</span>
                      <button onClick={() => { setConfirmRemove(null); removeFromWaitlist(m.id) }} disabled={actionLoading === `wl-${m.id}`} className="text-[10px] font-medium text-red-400 hover:text-red-300 px-1.5 py-0.5 border border-red-400/30 rounded transition-colors">
                        {actionLoading === `wl-${m.id}` ? '...' : 'Yes'}
                      </button>
                      <button onClick={() => setConfirmRemove(null)} className="text-[10px] font-medium text-muted hover:text-foreground px-1.5 py-0.5 border border-card-border rounded transition-colors">No</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => promoteFromWaitlist(m.id)} disabled={actionLoading === m.id} className="text-green-400 hover:text-green-300 text-[10px] font-medium transition-colors disabled:opacity-50 px-1.5 py-0.5 border border-green-400/20 rounded" title="Move to attendees">
                        {actionLoading === m.id ? '...' : 'Promote'}
                      </button>
                      <button onClick={() => setConfirmRemove({ userId: m.id, type: 'waitlist', name: m.name })} className="text-red-400 hover:text-red-300 text-xs transition-colors" title="Remove from waitlist">
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  )}
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
