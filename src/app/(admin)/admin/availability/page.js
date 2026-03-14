'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Plus, Clock, MapPin, User, Trash2, RefreshCw, Users, GripVertical, ChevronDown } from 'lucide-react'

// ─── Constants ──────────────────────────────────────────────────────
const HOUR_HEIGHT = 60 // 1px per minute
const START_HOUR = 6
const END_HOUR = 22
const SNAP_MINUTES = 15
const SNAP_PX = SNAP_MINUTES
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT
const MIN_BLOCK_HEIGHT = SNAP_PX * 2 // 30 min minimum

// Mon-Sun ordering (day_of_week: 1=Mon, 2=Tue, ..., 6=Sat, 0=Sun)
const DISPLAY_DAYS = [1, 2, 3, 4, 5, 6, 0]
const DAY_LABELS = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 0: 'Sun' }
const DAY_NAMES_FULL = { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' }

const selectClass = 'w-full rounded-md bg-background border border-card-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent'

function snapToGrid(px) { return Math.round(px / SNAP_PX) * SNAP_PX }
function pxToTime(px) {
  const totalMins = Math.round(px / SNAP_PX) * SNAP_MINUTES + START_HOUR * 60
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
function timeToMinutes(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function timeToPx(t) { return (timeToMinutes(t) - START_HOUR * 60) }
function formatTimeDisplay(t) {
  const [h, m] = t.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// Color from instructor ID
function instructorColor(id) {
  if (!id) return { bg: 'rgba(45, 212, 191, 0.2)', border: 'rgba(45, 212, 191, 0.5)', text: '#2dd4bf' }
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
  const hue = Math.abs(hash) % 360
  return {
    bg: `hsla(${hue}, 60%, 50%, 0.18)`,
    border: `hsla(${hue}, 60%, 50%, 0.5)`,
    text: `hsl(${hue}, 60%, 65%)`,
  }
}

// Lane layout for overlapping blocks within a day column
function layoutBlocks(blocks) {
  if (!blocks.length) return new Map()
  const sorted = [...blocks].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))
  const lanes = []
  const result = new Map()

  sorted.forEach((block) => {
    const top = timeToPx(block.start_time.slice(0, 5))
    const height = timeToMinutes(block.end_time.slice(0, 5)) - timeToMinutes(block.start_time.slice(0, 5))
    const end = top + height
    let laneIdx = lanes.findIndex((lane) => lane.end <= top)
    if (laneIdx === -1) { laneIdx = lanes.length; lanes.push({ end }) } else { lanes[laneIdx].end = end }
    result.set(block.id, { top, height, lane: laneIdx })
  })

  // Total lanes for width calculation
  sorted.forEach((block) => {
    const layout = result.get(block.id)
    const blockEnd = layout.top + layout.height
    let maxLanes = 1
    sorted.forEach((other) => {
      const ol = result.get(other.id)
      if (ol.top < blockEnd && ol.top + ol.height > layout.top) maxLanes = Math.max(maxLanes, ol.lane + 1)
    })
    layout.totalLanes = maxLanes
  })

  return result
}

export default function AdminAvailabilityPage() {
  const [availability, setAvailability] = useState([])
  const [instructors, setInstructors] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [toast, setToast] = useState(null)

  // Filters
  const [filterInstructor, setFilterInstructor] = useState('')
  const [filterLocation, setFilterLocation] = useState('')

  // Dialog state
  const [dialog, setDialog] = useState(null) // 'create' | availability object
  const [form, setForm] = useState(getDefaultForm())
  const [submitting, setSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Drag-to-create state
  const [createDrag, setCreateDrag] = useState(null)
  const gridRef = useRef(null)
  const colRefs = useRef([])

  // Drag-to-move state
  const [dragState, setDragState] = useState(null)

  // Resize state
  const [resizeState, setResizeState] = useState(null)

  const justDragged = useRef(false)

  function getDefaultForm() {
    return {
      instructorMode: 'specific', // 'specific' | 'multiple' | 'anyone'
      instructorId: '',
      instructorIds: [],
      locationId: '',
      zoneId: '',
      openLocation: false,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '17:00',
      sessionDuration: 60,
      concurrentSlots: 1,
      creditsCost: 1,
      bufferMins: 0,
    }
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const fetchData = useCallback(async () => {
    setFetchError(null)
    try {
      const params = new URLSearchParams()
      if (filterInstructor === 'any') params.set('instructorId', 'any')
      else if (filterInstructor) params.set('instructorId', filterInstructor)
      const qs = params.toString() ? `?${params}` : ''

      const [availRes, optionsRes] = await Promise.all([
        fetch(`/api/admin/availability${qs}`),
        fetch('/api/admin/schedule/options'),
      ])
      if (availRes.ok) {
        const data = await availRes.json()
        let items = data.availability || []
        // Client-side location filter
        if (filterLocation === 'open') items = items.filter(a => !a.location_id)
        else if (filterLocation) items = items.filter(a => a.location_id === filterLocation)
        setAvailability(items)
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
  }, [filterInstructor, filterLocation])

  useEffect(() => { fetchData() }, [fetchData])

  // ─── CRUD handlers ──────────────────────────────────────────────

  function openCreate(dayOfWeek, startTime, endTime) {
    const f = getDefaultForm()
    f.dayOfWeek = dayOfWeek ?? 1
    f.startTime = startTime || '09:00'
    f.endTime = endTime || '17:00'
    if (instructors.length > 0) f.instructorId = instructors[0].id
    setForm(f)
    setDialog('create')
  }

  function openEdit(avail) {
    setForm({
      instructorMode: !avail.instructor_id ? 'anyone' : 'specific',
      instructorId: avail.instructor_id || '',
      instructorIds: [],
      locationId: avail.location_id || '',
      zoneId: avail.zone_id || '',
      openLocation: !avail.location_id,
      dayOfWeek: avail.day_of_week,
      startTime: avail.start_time?.slice(0, 5) || '09:00',
      endTime: avail.end_time?.slice(0, 5) || '17:00',
      sessionDuration: avail.session_duration,
      concurrentSlots: avail.concurrent_slots,
      creditsCost: avail.credits_cost,
      bufferMins: avail.buffer_mins ?? 0,
    })
    setDialog(avail)
  }

  async function handleSave() {
    // Validation
    if (form.instructorMode === 'specific' && !form.instructorId) {
      setToast({ message: 'Select an instructor', type: 'error' }); return
    }
    if (form.instructorMode === 'multiple' && form.instructorIds.length === 0) {
      setToast({ message: 'Select at least one instructor', type: 'error' }); return
    }
    if (form.endTime <= form.startTime) {
      setToast({ message: 'End time must be after start time', type: 'error' }); return
    }
    const windowMins = timeToMinutes(form.endTime) - timeToMinutes(form.startTime)
    if (form.sessionDuration > windowMins) {
      setToast({ message: `Session (${form.sessionDuration}min) exceeds window (${windowMins}min)`, type: 'error' }); return
    }

    setSubmitting(true)
    try {
      const isCreate = dialog === 'create'
      const payload = {
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        sessionDuration: form.sessionDuration,
        concurrentSlots: form.concurrentSlots,
        creditsCost: form.creditsCost,
        bufferMins: form.bufferMins,
        locationId: form.openLocation ? null : (form.locationId || null),
        zoneId: form.openLocation ? null : (form.zoneId || null),
      }

      if (form.instructorMode === 'anyone') {
        payload.instructorId = null
      } else if (form.instructorMode === 'multiple') {
        payload.instructorIds = form.instructorIds
      } else {
        payload.instructorId = form.instructorId
      }

      const res = await fetch('/api/admin/availability', {
        method: isCreate ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isCreate ? payload : { id: dialog.id, ...payload }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ message: data.error || 'Failed to save', type: 'error' }); return
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
        setToast({ message: data.error || 'Failed to delete', type: 'error' }); return
      }
      setToast({ message: 'Availability deleted', type: 'success' })
      setDeleteConfirm(null)
      setDialog(null)
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
      setToast({ message: data.error || 'Failed to update', type: 'error' }); return
    }
    fetchData()
  }

  async function handleQuickUpdate(avail, updates) {
    const res = await fetch('/api/admin/availability', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: avail.id, ...updates }),
    })
    if (!res.ok) {
      setToast({ message: 'Failed to update', type: 'error' })
    }
    fetchData()
  }

  // ─── Drag-to-create ──────────────────────────────────────────────

  function handleGridPointerDown(e, dayOfWeek, colIdx) {
    if (e.button !== 0) return
    const col = colRefs.current[colIdx]
    if (!col) return

    const rect = col.getBoundingClientRect()
    const y = e.clientY - rect.top + col.scrollTop
    const snappedY = snapToGrid(y)

    setCreateDrag({
      dayOfWeek,
      colIdx,
      startY: snappedY,
      currentY: snappedY + MIN_BLOCK_HEIGHT,
      activated: false,
      startClientY: e.clientY,
    })

    e.preventDefault()
    e.stopPropagation()
  }

  useEffect(() => {
    if (!createDrag) return

    function onMove(e) {
      const col = colRefs.current[createDrag.colIdx]
      if (!col) return
      const rect = col.getBoundingClientRect()
      const y = e.clientY - rect.top + col.scrollTop
      const snappedY = snapToGrid(Math.max(0, Math.min(y, TOTAL_HEIGHT)))

      const activated = createDrag.activated || Math.abs(e.clientY - createDrag.startClientY) > 5
      setCreateDrag(prev => ({ ...prev, currentY: snappedY, activated }))
    }

    function onUp() {
      if (createDrag.activated) {
        const topY = Math.min(createDrag.startY, createDrag.currentY)
        const bottomY = Math.max(createDrag.startY, createDrag.currentY)
        const height = Math.max(bottomY - topY, MIN_BLOCK_HEIGHT)
        const startTime = pxToTime(topY)
        const endTime = pxToTime(topY + height)
        openCreate(createDrag.dayOfWeek, startTime, endTime)
        justDragged.current = true
        setTimeout(() => { justDragged.current = false }, 200)
      }
      setCreateDrag(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [createDrag])

  // ─── Drag-to-move ──────────────────────────────────────────────

  function handleBlockPointerDown(e, avail, colIdx) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    const col = colRefs.current[colIdx]
    if (!col) return

    const top = timeToPx(avail.start_time.slice(0, 5))
    const height = timeToMinutes(avail.end_time.slice(0, 5)) - timeToMinutes(avail.start_time.slice(0, 5))

    setDragState({
      avail,
      colIdx,
      top,
      height,
      currentTop: top,
      currentColIdx: colIdx,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
    })
  }

  useEffect(() => {
    if (!dragState) return

    function onMove(e) {
      const deltaY = e.clientY - dragState.startClientY
      const deltaX = e.clientX - dragState.startClientX
      const newTop = snapToGrid(Math.max(0, Math.min(dragState.top + deltaY, TOTAL_HEIGHT - dragState.height)))

      // Determine column from X position
      let newColIdx = dragState.colIdx
      colRefs.current.forEach((col, i) => {
        if (!col) return
        const rect = col.getBoundingClientRect()
        if (e.clientX >= rect.left && e.clientX <= rect.right) newColIdx = i
      })

      const moved = Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3

      setDragState(prev => ({ ...prev, currentTop: newTop, currentColIdx: newColIdx, moved: moved || prev.moved }))
    }

    function onUp() {
      if (dragState.moved) {
        const newStartTime = pxToTime(dragState.currentTop)
        const newEndTime = pxToTime(dragState.currentTop + dragState.height)
        const newDayOfWeek = DISPLAY_DAYS[dragState.currentColIdx]

        handleQuickUpdate(dragState.avail, {
          dayOfWeek: newDayOfWeek,
          startTime: newStartTime,
          endTime: newEndTime,
        })

        justDragged.current = true
        setTimeout(() => { justDragged.current = false }, 200)
      }
      setDragState(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragState])

  // ─── Resize ──────────────────────────────────────────────────────

  function handleResizePointerDown(e, avail) {
    e.preventDefault()
    e.stopPropagation()

    const top = timeToPx(avail.start_time.slice(0, 5))
    const height = timeToMinutes(avail.end_time.slice(0, 5)) - timeToMinutes(avail.start_time.slice(0, 5))

    setResizeState({
      avail,
      top,
      originalHeight: height,
      currentHeight: height,
      startClientY: e.clientY,
    })
  }

  useEffect(() => {
    if (!resizeState) return

    function onMove(e) {
      const deltaY = e.clientY - resizeState.startClientY
      const newHeight = snapToGrid(Math.max(MIN_BLOCK_HEIGHT, resizeState.originalHeight + deltaY))
      setResizeState(prev => ({ ...prev, currentHeight: newHeight }))
    }

    function onUp() {
      if (resizeState.currentHeight !== resizeState.originalHeight) {
        const newEndTime = pxToTime(resizeState.top + resizeState.currentHeight)
        handleQuickUpdate(resizeState.avail, { endTime: newEndTime })
        justDragged.current = true
        setTimeout(() => { justDragged.current = false }, 200)
      }
      setResizeState(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [resizeState])

  // ─── Helpers ──────────────────────────────────────────────────────

  const getZones = (locationId) => {
    const loc = locations.find(l => l.id === locationId)
    return (loc?.zones || []).filter(z => z.is_active)
  }

  const getLocationBuffer = (locationId) => {
    if (!locationId) return 0
    const loc = locations.find(l => l.id === locationId)
    return loc?.buffer_mins || 0
  }

  const getInstructorName = (id) => {
    if (!id) return 'Anyone'
    return instructors.find(i => i.id === id)?.name || 'Instructor'
  }

  // Group availability by day for calendar rendering
  const byDay = {}
  DISPLAY_DAYS.forEach(d => { byDay[d] = [] })
  availability.forEach(a => {
    if (byDay[a.day_of_week]) byDay[a.day_of_week].push(a)
  })

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-card-border shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground">Appointment Availability</h1>
          <p className="text-xs text-muted mt-0.5">Drag on the grid to create · click blocks to edit · drag blocks to move</p>
        </div>
        <Button onClick={() => openCreate()} size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Window
        </Button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={cn(
          'mx-4 mt-2 px-4 py-2.5 rounded-lg text-sm shrink-0',
          toast.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'
        )}>
          {toast.message}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 px-4 py-2 border-b border-card-border/50 overflow-x-auto shrink-0">
        {/* Instructor filter */}
        <div className="flex gap-1.5 items-center">
          <span className="text-[10px] text-muted/50 uppercase tracking-wider font-medium mr-1">Instructor</span>
          <button onClick={() => setFilterInstructor('')} className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors', !filterInstructor ? 'bg-accent text-background' : 'bg-card border border-card-border text-muted hover:text-foreground')}>All</button>
          <button onClick={() => setFilterInstructor('any')} className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors', filterInstructor === 'any' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'bg-card border border-card-border text-muted hover:text-foreground')}>Anyone</button>
          {instructors.map(inst => (
            <button key={inst.id} onClick={() => setFilterInstructor(inst.id)} className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap', filterInstructor === inst.id ? 'bg-accent text-background' : 'bg-card border border-card-border text-muted hover:text-foreground')}>{inst.name}</button>
          ))}
        </div>
        {/* Location filter */}
        {locations.length > 0 && (
          <div className="flex gap-1.5 items-center ml-3 pl-3 border-l border-card-border/50">
            <span className="text-[10px] text-muted/50 uppercase tracking-wider font-medium mr-1">Location</span>
            <button onClick={() => setFilterLocation('')} className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors', !filterLocation ? 'bg-accent text-background' : 'bg-card border border-card-border text-muted hover:text-foreground')}>All</button>
            <button onClick={() => setFilterLocation('open')} className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors', filterLocation === 'open' ? 'bg-accent text-background' : 'bg-card border border-card-border text-muted hover:text-foreground')}>Open</button>
            {locations.map(loc => (
              <button key={loc.id} onClick={() => setFilterLocation(loc.id)} className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap', filterLocation === loc.id ? 'bg-accent text-background' : 'bg-card border border-card-border text-muted hover:text-foreground')}>{loc.name}</button>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {fetchError && (
        <div className="m-4 bg-card border border-card-border rounded-lg p-8 text-center">
          <p className="text-red-400 mb-4">{fetchError}</p>
          <Button variant="outline" onClick={fetchData} className="gap-2"><RefreshCw className="w-4 h-4" /> Retry</Button>
        </div>
      )}

      {/* Loading */}
      {loading && !fetchError && (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted">Loading availability...</div>
        </div>
      )}

      {/* Calendar Grid */}
      {!loading && !fetchError && (
        <div className="flex-1 overflow-auto" ref={gridRef}>
          <div className="flex min-w-[700px]">
            {/* Time labels column */}
            <div className="w-14 shrink-0 border-r border-card-border/30 sticky left-0 bg-background z-10">
              <div className="h-8 border-b border-card-border/30" /> {/* header spacer */}
              <div className="relative" style={{ height: TOTAL_HEIGHT }}>
                {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                  <div key={i} className="absolute w-full text-right pr-2 -translate-y-1/2 text-[10px] text-muted/50 select-none" style={{ top: i * HOUR_HEIGHT }}>
                    {formatTimeDisplay(`${String(START_HOUR + i).padStart(2, '0')}:00`)}
                  </div>
                ))}
              </div>
            </div>

            {/* Day columns */}
            {DISPLAY_DAYS.map((dow, colIdx) => {
              const dayBlocks = byDay[dow] || []
              const layouts = layoutBlocks(dayBlocks)

              return (
                <div key={dow} className="flex-1 min-w-[80px] border-r border-card-border/20 last:border-r-0">
                  {/* Day header */}
                  <div className="h-8 border-b border-card-border/30 flex items-center justify-center sticky top-0 bg-background z-10">
                    <span className="text-xs font-semibold text-foreground">{DAY_LABELS[dow]}</span>
                    {dayBlocks.length > 0 && (
                      <span className="ml-1.5 text-[9px] text-accent bg-accent/10 rounded-full px-1.5">{dayBlocks.length}</span>
                    )}
                  </div>

                  {/* Grid area */}
                  <div
                    className="relative select-none"
                    style={{ height: TOTAL_HEIGHT }}
                    ref={el => { colRefs.current[colIdx] = el }}
                    onPointerDown={(e) => {
                      // Only start drag-to-create on empty space
                      if (e.target === e.currentTarget || e.target.dataset.gridline) {
                        handleGridPointerDown(e, dow, colIdx)
                      }
                    }}
                  >
                    {/* Hour gridlines */}
                    {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                      <div key={i} data-gridline="true" className="absolute w-full border-t border-card-border/15" style={{ top: i * HOUR_HEIGHT }} />
                    ))}
                    {/* Half-hour gridlines */}
                    {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                      <div key={`h${i}`} data-gridline="true" className="absolute w-full border-t border-card-border/8" style={{ top: i * HOUR_HEIGHT + 30 }} />
                    ))}

                    {/* Availability blocks */}
                    {dayBlocks.map(avail => {
                      const layout = layouts.get(avail.id)
                      if (!layout) return null

                      const isDragging = dragState?.avail.id === avail.id
                      const isResizing = resizeState?.avail.id === avail.id

                      const top = isDragging ? dragState.currentTop : layout.top
                      const height = isResizing ? resizeState.currentHeight : layout.height
                      const currentColIdx = isDragging ? dragState.currentColIdx : colIdx
                      const color = instructorColor(avail.instructor_id)

                      // Only render in the correct column during drag
                      if (isDragging && currentColIdx !== colIdx) return null

                      const laneWidth = 100 / layout.totalLanes
                      const laneLeft = layout.lane * laneWidth
                      const bufferHeight = avail.buffer_mins || 0

                      return (
                        <div key={avail.id}>
                          {/* Buffer zone (after) */}
                          {bufferHeight > 0 && (
                            <div
                              className="absolute pointer-events-none rounded-b-sm opacity-40"
                              style={{
                                top: top + height,
                                height: bufferHeight,
                                left: `calc(${laneLeft}% + 2px)`,
                                width: `calc(${laneWidth}% - 4px)`,
                                background: `repeating-linear-gradient(45deg, transparent, transparent 3px, ${color.border} 3px, ${color.border} 4px)`,
                              }}
                            />
                          )}

                          {/* Main block */}
                          <div
                            className={cn(
                              'absolute rounded-md border cursor-pointer transition-shadow overflow-hidden group',
                              avail.is_active ? 'hover:shadow-lg hover:shadow-black/20' : 'opacity-40',
                              isDragging && 'shadow-xl shadow-black/30 z-20 ring-2 ring-accent/30',
                            )}
                            style={{
                              top,
                              height: Math.max(height, SNAP_PX),
                              left: `calc(${laneLeft}% + 2px)`,
                              width: `calc(${laneWidth}% - 4px)`,
                              backgroundColor: color.bg,
                              borderColor: color.border,
                            }}
                            onPointerDown={(e) => handleBlockPointerDown(e, avail, colIdx)}
                            onClick={() => {
                              if (!justDragged.current) openEdit(avail)
                            }}
                          >
                            {/* Content */}
                            <div className="px-1.5 py-1 text-[10px] leading-tight overflow-hidden h-full flex flex-col">
                              <div className="font-semibold truncate" style={{ color: color.text }}>
                                {avail.instructor_id ? getInstructorName(avail.instructor_id) : '✦ Anyone'}
                              </div>
                              <div className="text-muted/60 truncate">
                                {avail.start_time?.slice(0, 5)} – {avail.end_time?.slice(0, 5)}
                              </div>
                              {height >= 60 && (
                                <>
                                  <div className="text-muted/40 truncate mt-0.5">{avail.session_duration}min sessions</div>
                                  {avail.locations?.name && (
                                    <div className="text-muted/40 truncate flex items-center gap-0.5 mt-0.5">
                                      <MapPin className="w-2.5 h-2.5 shrink-0" />{avail.locations.name}
                                    </div>
                                  )}
                                  {!avail.location_id && !avail.instructor_id && (
                                    <div className="text-muted/40 truncate mt-0.5">Open location</div>
                                  )}
                                  {avail.buffer_mins > 0 && (
                                    <div className="text-muted/40 truncate mt-0.5">{avail.buffer_mins}min buffer</div>
                                  )}
                                </>
                              )}
                              {avail.concurrent_slots > 1 && height >= 45 && (
                                <div className="mt-auto text-[9px] font-medium" style={{ color: color.text }}>{avail.concurrent_slots} concurrent</div>
                              )}
                            </div>

                            {/* Resize handle */}
                            <div
                              className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ background: `linear-gradient(transparent, ${color.border})` }}
                              onPointerDown={(e) => handleResizePointerDown(e, avail)}
                            />
                          </div>
                        </div>
                      )
                    })}

                    {/* Drag blocks from other columns being moved here */}
                    {dragState && dragState.moved && dragState.currentColIdx === colIdx && dragState.colIdx !== colIdx && (() => {
                      const avail = dragState.avail
                      const color = instructorColor(avail.instructor_id)
                      return (
                        <div
                          className="absolute rounded-md border z-20 ring-2 ring-accent/30 shadow-xl shadow-black/30 opacity-70"
                          style={{
                            top: dragState.currentTop,
                            height: dragState.height,
                            left: '2px',
                            right: '2px',
                            backgroundColor: color.bg,
                            borderColor: color.border,
                          }}
                        >
                          <div className="px-1.5 py-1 text-[10px] font-semibold truncate" style={{ color: color.text }}>
                            {avail.instructor_id ? getInstructorName(avail.instructor_id) : '✦ Anyone'}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Drag-to-create preview */}
                    {createDrag && createDrag.colIdx === colIdx && createDrag.activated && (
                      <div
                        className="absolute rounded-md border-2 border-dashed border-accent/60 bg-accent/10 pointer-events-none z-10"
                        style={{
                          top: Math.min(createDrag.startY, createDrag.currentY),
                          height: Math.max(Math.abs(createDrag.currentY - createDrag.startY), MIN_BLOCK_HEIGHT),
                          left: '2px',
                          right: '2px',
                        }}
                      >
                        <div className="px-1.5 py-0.5 text-[10px] text-accent font-medium">
                          {pxToTime(Math.min(createDrag.startY, createDrag.currentY))} – {pxToTime(Math.min(createDrag.startY, createDrag.currentY) + Math.max(Math.abs(createDrag.currentY - createDrag.startY), MIN_BLOCK_HEIGHT))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog === 'create' ? 'Create Availability' : 'Edit Availability'}</DialogTitle>
            <DialogDescription>
              {dialog === 'create' ? 'Set when this time slot is available for appointments' : 'Modify this availability window'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Day & Time */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted/70 uppercase tracking-wider">Schedule</div>
              <div>
                <Label className="text-xs">Day of Week</Label>
                <select value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: parseInt(e.target.value) }))} className={selectClass}>
                  {DISPLAY_DAYS.map(d => <option key={d} value={d}>{DAY_NAMES_FULL[d]}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Start Time</Label>
                  <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">End Time</Label>
                  <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="mt-1" />
                </div>
              </div>
            </div>

            {/* Instructor assignment */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted/70 uppercase tracking-wider">Instructor</div>
              {dialog === 'create' && (
                <div className="flex gap-2">
                  {[
                    { key: 'specific', label: 'Specific', icon: User },
                    { key: 'multiple', label: 'Multiple', icon: Users },
                    { key: 'anyone', label: 'Anyone Available', icon: null },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setForm(f => ({ ...f, instructorMode: key }))}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all border',
                        form.instructorMode === key
                          ? key === 'anyone' ? 'bg-teal-500/15 border-teal-500/30 text-teal-400' : 'bg-accent/15 border-accent/30 text-accent'
                          : 'bg-card border-card-border text-muted hover:text-foreground'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {form.instructorMode === 'specific' && (
                <select value={form.instructorId} onChange={e => setForm(f => ({ ...f, instructorId: e.target.value }))} className={selectClass} disabled={dialog !== 'create'}>
                  <option value="">Select instructor</option>
                  {instructors.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
                </select>
              )}

              {form.instructorMode === 'multiple' && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto bg-card rounded-lg border border-card-border p-2">
                  {instructors.map(inst => (
                    <label key={inst.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-background/50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={form.instructorIds.includes(inst.id)}
                        onChange={(e) => {
                          setForm(f => ({
                            ...f,
                            instructorIds: e.target.checked
                              ? [...f.instructorIds, inst.id]
                              : f.instructorIds.filter(id => id !== inst.id),
                          }))
                        }}
                        className="rounded border-card-border accent-accent"
                      />
                      <span className="text-sm text-foreground">{inst.name}</span>
                    </label>
                  ))}
                  {instructors.length === 0 && <p className="text-xs text-muted text-center py-2">No instructors found</p>}
                </div>
              )}

              {form.instructorMode === 'anyone' && (
                <div className="bg-teal-500/10 border border-teal-500/20 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-teal-400">Any available instructor at the selected location can be assigned when a member books.</p>
                </div>
              )}
            </div>

            {/* Session settings */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted/70 uppercase tracking-wider">Session</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Duration (min)</Label>
                  <Input type="number" min={15} max={480} step={15} value={form.sessionDuration} onChange={e => setForm(f => ({ ...f, sessionDuration: parseInt(e.target.value) || 60 }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Concurrent</Label>
                  <Input type="number" min={1} max={100} value={form.concurrentSlots} onChange={e => setForm(f => ({ ...f, concurrentSlots: parseInt(e.target.value) || 1 }))} className="mt-1" />
                  <p className="text-[9px] text-muted/40 mt-0.5">Bookings at once</p>
                </div>
                <div>
                  <Label className="text-xs">Credits</Label>
                  <Input type="number" min={0} max={10} value={form.creditsCost} onChange={e => setForm(f => ({ ...f, creditsCost: parseInt(e.target.value) || 0 }))} className="mt-1" />
                  <p className="text-[9px] text-muted/40 mt-0.5">0 = free</p>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted/70 uppercase tracking-wider">Location</div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Switch checked={form.openLocation} onCheckedChange={v => setForm(f => ({ ...f, openLocation: v, locationId: '', zoneId: '' }))} />
                <span className="text-sm text-foreground">Open location</span>
                <span className="text-[10px] text-muted/50">(no fixed venue)</span>
              </label>
              {!form.openLocation && locations.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Location</Label>
                    <select
                      value={form.locationId}
                      onChange={e => {
                        const locId = e.target.value
                        const locBuffer = getLocationBuffer(locId)
                        setForm(f => ({ ...f, locationId: locId, zoneId: '', bufferMins: locBuffer || f.bufferMins }))
                      }}
                      className={selectClass}
                    >
                      <option value="">None</option>
                      {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Zone</Label>
                    <select value={form.zoneId} onChange={e => setForm(f => ({ ...f, zoneId: e.target.value }))} className={selectClass} disabled={!getZones(form.locationId).length}>
                      <option value="">None</option>
                      {getZones(form.locationId).map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Buffer time */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted/70 uppercase tracking-wider">Buffer Time</div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    step={5}
                    value={form.bufferMins}
                    onChange={e => setForm(f => ({ ...f, bufferMins: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <span className="text-sm text-muted shrink-0">minutes between appointments</span>
              </div>
              {form.locationId && getLocationBuffer(form.locationId) > 0 && (
                <p className="text-[10px] text-muted/50">
                  Location default: {getLocationBuffer(form.locationId)} min
                  {form.bufferMins !== getLocationBuffer(form.locationId) && (
                    <button onClick={() => setForm(f => ({ ...f, bufferMins: getLocationBuffer(f.locationId) }))} className="ml-2 text-accent hover:underline">
                      Reset to default
                    </button>
                  )}
                </p>
              )}
              {form.bufferMins > 0 && (
                <p className="text-[10px] text-muted/40">
                  Effective slot: {form.sessionDuration}min session + {form.bufferMins}min buffer = {form.sessionDuration + form.bufferMins}min per slot
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            {dialog !== 'create' && (
              <Button variant="ghost" size="sm" className="mr-auto text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => setDeleteConfirm(dialog.id)}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
              </Button>
            )}
            {dialog !== 'create' && (
              <div className="flex items-center gap-2 mr-2">
                <Switch checked={dialog?.is_active ?? true} onCheckedChange={v => { handleToggleActive(dialog); setDialog(null) }} />
                <span className="text-xs text-muted">{dialog?.is_active ? 'Active' : 'Inactive'}</span>
              </div>
            )}
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting}>
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
            <DialogDescription>This removes the recurring availability. Existing appointments are not affected.</DialogDescription>
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
