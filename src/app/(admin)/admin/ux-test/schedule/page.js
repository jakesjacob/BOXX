'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { X, Check, Plus, ChevronDown, ChevronUp, Clock, MapPin, User, Calendar, Repeat } from 'lucide-react'

// ─── Constants ──────────────────────────────────────────────────
const HOUR_HEIGHT = 60
const START_HOUR = 6
const END_HOUR = 22
const SNAP_MINUTES = 15
const SNAP_PX = SNAP_MINUTES
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT

function snapToGrid(px) {
  return Math.round(px / SNAP_PX) * SNAP_PX
}

function pxToTime(px) {
  const totalMins = Math.round(px / SNAP_PX) * SNAP_MINUTES + START_HOUR * 60
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatTime(time) {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

// ─── Mock data ──────────────────────────────────────────────────
const MOCK_CLASS_TYPES = [
  { id: 'ct1', name: 'Boxing Fundamentals', color: '#c8a750', duration_mins: 60 },
  { id: 'ct2', name: 'HIIT Circuit', color: '#ef4444', duration_mins: 45 },
  { id: 'ct3', name: 'Yoga Flow', color: '#22c55e', duration_mins: 75 },
  { id: 'ct4', name: 'Strength Training', color: '#3b82f6', duration_mins: 60 },
]

const MOCK_INSTRUCTORS = [
  { id: 'i1', name: 'Sarah Chen' },
  { id: 'i2', name: 'Mike Torres' },
  { id: 'i3', name: 'Aisha Patel' },
]

const MOCK_LOCATIONS = [
  { id: 'l1', name: 'Main Studio', zones: [{ id: 'z1', name: 'Ring A' }, { id: 'z2', name: 'Studio 2' }] },
  { id: 'l2', name: 'Thonglor Branch', zones: [] },
]

// Generate mock classes for the current week
function generateMockClasses() {
  const classes = []
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - today.getDay() + 1)

  const schedule = [
    { day: 0, start: '07:00', end: '08:00', ct: 'ct1', inst: 'i2', loc: 'l1', zone: 'z1' },
    { day: 0, start: '09:00', end: '09:45', ct: 'ct2', inst: 'i3', loc: 'l1', zone: 'z2' },
    { day: 1, start: '08:00', end: '09:15', ct: 'ct3', inst: 'i1', loc: 'l1', zone: 'z2' },
    { day: 1, start: '17:00', end: '18:00', ct: 'ct4', inst: 'i2', loc: 'l2', zone: '' },
    { day: 2, start: '07:00', end: '08:00', ct: 'ct1', inst: 'i2', loc: 'l1', zone: 'z1' },
    { day: 2, start: '10:00', end: '10:45', ct: 'ct2', inst: 'i3', loc: 'l1', zone: 'z2' },
    { day: 3, start: '08:00', end: '09:15', ct: 'ct3', inst: 'i1', loc: 'l1', zone: 'z2' },
    { day: 3, start: '17:00', end: '18:00', ct: 'ct1', inst: 'i2', loc: 'l2', zone: '' },
    { day: 4, start: '07:00', end: '08:00', ct: 'ct4', inst: 'i2', loc: 'l1', zone: 'z1' },
    { day: 4, start: '09:00', end: '09:45', ct: 'ct2', inst: 'i3', loc: 'l1', zone: 'z2' },
    { day: 5, start: '09:00', end: '10:15', ct: 'ct3', inst: 'i1', loc: 'l1', zone: 'z2' },
  ]

  schedule.forEach((s, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + s.day)
    const dateStr = d.toISOString().split('T')[0]
    const ct = MOCK_CLASS_TYPES.find((c) => c.id === s.ct)
    const inst = MOCK_INSTRUCTORS.find((ins) => ins.id === s.inst)
    const loc = MOCK_LOCATIONS.find((l) => l.id === s.loc)
    const zone = loc?.zones.find((z) => z.id === s.zone)
    classes.push({
      id: `cls-${i}`,
      date: dateStr,
      startTime: s.start,
      endTime: s.end,
      classType: ct,
      instructor: inst,
      location: loc,
      zone: zone || null,
      capacity: 12,
      booked: Math.floor(Math.random() * 10),
    })
  })
  return classes
}

const selectClass = 'w-full rounded-md bg-background border border-card-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent transition-colors'

// ─── Inline Add Form (slides down from top of calendar) ─────────
function InlineAddForm({ date, startTime, endTime, onSave, onCancel }) {
  const [form, setForm] = useState({
    classTypeId: MOCK_CLASS_TYPES[0].id,
    instructorId: MOCK_INSTRUCTORS[0].id,
    startTime: startTime || '07:00',
    endTime: endTime || '08:00',
    capacity: 6,
    locationId: MOCK_LOCATIONS[0].id,
    zoneId: '',
    notes: '',
  })
  const [showMore, setShowMore] = useState(false)
  const formRef = useRef(null)

  const selectedCt = MOCK_CLASS_TYPES.find((ct) => ct.id === form.classTypeId)
  const selectedLoc = MOCK_LOCATIONS.find((l) => l.id === form.locationId)
  const zones = selectedLoc?.zones || []

  useEffect(() => {
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [])

  function handleKeyDown(e) {
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div
      ref={formRef}
      className="border-b border-accent/20 bg-card animate-in slide-in-from-top-2 fade-in duration-200"
      onKeyDown={handleKeyDown}
    >
      {/* Color strip */}
      <div className="h-1" style={{ backgroundColor: selectedCt?.color || '#c8a750' }} />

      <div className="px-4 py-3">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold text-foreground">
              New class · {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                onSave({
                  date,
                  ...form,
                  classType: selectedCt,
                  instructor: MOCK_INSTRUCTORS.find((i) => i.id === form.instructorId),
                  location: selectedLoc,
                  zone: zones.find((z) => z.id === form.zoneId) || null,
                })
              }}
              className="h-7 px-3 rounded-md bg-accent/15 text-accent hover:bg-accent/25 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Create
            </button>
            <button
              onClick={onCancel}
              className="h-7 w-7 rounded-md text-muted hover:text-foreground hover:bg-white/5 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Primary fields — single row on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Event</label>
            <select
              value={form.classTypeId}
              onChange={(e) => setForm((f) => ({ ...f, classTypeId: e.target.value }))}
              className={cn(selectClass, 'h-9 text-xs')}
            >
              {MOCK_CLASS_TYPES.map((ct) => (
                <option key={ct.id} value={ct.id}>{ct.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Instructor</label>
            <select
              value={form.instructorId}
              onChange={(e) => setForm((f) => ({ ...f, instructorId: e.target.value }))}
              className={cn(selectClass, 'h-9 text-xs')}
            >
              {MOCK_INSTRUCTORS.map((inst) => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Start</label>
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              className="h-9 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">End</label>
            <Input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              className="h-9 text-xs"
            />
          </div>
        </div>

        {/* More options toggle */}
        <button
          onClick={() => setShowMore((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] text-muted hover:text-foreground mt-2.5 transition-colors"
        >
          {showMore ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {showMore ? 'Less options' : 'More options'}
        </button>

        {/* Progressive disclosure */}
        <div className={cn(
          'overflow-hidden transition-all duration-200 ease-out',
          showMore ? 'max-h-[300px] opacity-100 mt-2.5' : 'max-h-0 opacity-0 mt-0'
        )}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-1">
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Location</label>
              <select
                value={form.locationId}
                onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value, zoneId: '' }))}
                className={cn(selectClass, 'h-9 text-xs')}
              >
                <option value="">None</option>
                {MOCK_LOCATIONS.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Zone</label>
              <select
                value={form.zoneId}
                onChange={(e) => setForm((f) => ({ ...f, zoneId: e.target.value }))}
                className={cn(selectClass, 'h-9 text-xs')}
                disabled={!zones.length}
              >
                <option value="">None</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Capacity</label>
              <Input
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => setForm((f) => ({ ...f, capacity: parseInt(e.target.value) || 1 }))}
                className="h-9 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Notes</label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
                className="h-9 text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted px-4 pb-2">Esc to cancel</p>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main schedule exploration page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function ScheduleInlineExplorationPage() {
  const [classes, setClasses] = useState(() => generateMockClasses())
  const [inlineAdd, setInlineAdd] = useState(null) // { date, startTime, endTime }
  const [toast, setToast] = useState(null)
  const scrollRef = useRef(null)
  const columnRefs = useRef([])

  // Drag-to-create
  const [createDrag, setCreateDrag] = useState(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // Auto-scroll to 6am area
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 60 // 7am area
    }
  }, [])

  // Compute the week days
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - today.getDay() + 1)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  // Group classes by date
  const classesByDay = {}
  classes.forEach((cls) => {
    if (!classesByDay[cls.date]) classesByDay[cls.date] = []
    classesByDay[cls.date].push(cls)
  })

  function handleGridClick(dayIdx) {
    const day = weekDays[dayIdx]
    const dateStr = day.toISOString().split('T')[0]
    setInlineAdd({ date: dateStr, startTime: '07:00', endTime: '08:00' })
  }

  function handleGridPointerDown(e, dayIdx) {
    if (e.target !== e.currentTarget) return
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const snappedY = snapToGrid(y)
    setCreateDrag({ dayIdx, startTop: snappedY, currentTop: snappedY + SNAP_PX, startY: e.clientY, activated: false })
  }

  // Drag-to-create handlers
  useEffect(() => {
    if (!createDrag) return

    function onMove(e) {
      const dy = Math.abs(e.clientY - createDrag.startY)
      if (dy < 5 && !createDrag.activated) return
      const col = columnRefs.current[createDrag.dayIdx]
      if (!col) return
      const rect = col.getBoundingClientRect()
      const y = e.clientY - rect.top
      const snappedY = Math.max(createDrag.startTop + SNAP_PX, Math.min(TOTAL_HEIGHT, snapToGrid(y)))
      setCreateDrag((prev) => ({ ...prev, currentTop: snappedY, activated: true }))
    }

    function onUp() {
      const startTime = pxToTime(createDrag.startTop)
      const endTime = createDrag.activated ? pxToTime(createDrag.currentTop) : null
      const dateStr = weekDays[createDrag.dayIdx].toISOString().split('T')[0]
      const wasActivated = createDrag.activated

      setCreateDrag(null)

      if (wasActivated) {
        setInlineAdd({ date: dateStr, startTime, endTime })
      } else {
        // Simple click — open with default duration
        const [sh, sm] = startTime.split(':').map(Number)
        const endMins = sh * 60 + sm + 60
        const defaultEnd = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`
        setInlineAdd({ date: dateStr, startTime, endTime: defaultEnd })
      }
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') setCreateDrag(null)
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

  function handleInlineSave(data) {
    const newClass = {
      id: `cls-${Date.now()}`,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      classType: data.classType,
      instructor: data.instructor,
      location: data.location,
      zone: data.zone,
      capacity: data.capacity,
      booked: 0,
    }
    setClasses((prev) => [...prev, newClass])
    setToast({ message: `${data.classType.name} created at ${formatTime(data.startTime)}`, type: 'success' })
    setInlineAdd(null)
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Schedule — Inline Creation Exploration</h1>
        <p className="text-sm text-muted mt-1">
          Click or drag on the calendar grid to create a class. The form appears inline above the calendar instead of as a modal dialog.
        </p>
      </div>

      {/* Research notes */}
      <div className="bg-card border border-card-border rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold text-accent mb-2">How this differs from the current dialog approach</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-xs text-muted">
          <div>
            <p className="text-foreground font-medium mb-1">Current (Dialog)</p>
            <ul className="space-y-1">
              <li>Click/drag on grid → full-screen modal opens</li>
              <li>Calendar hidden behind overlay</li>
              <li>Can&apos;t see schedule conflicts while filling form</li>
              <li>Must close dialog to check other days</li>
              <li>All fields visible at once (overwhelming)</li>
            </ul>
          </div>
          <div>
            <p className="text-foreground font-medium mb-1">Inline Panel (This exploration)</p>
            <ul className="space-y-1">
              <li>Click/drag on grid → form slides down from top</li>
              <li className="text-green-400/80">Calendar stays visible below</li>
              <li className="text-green-400/80">Can see schedule conflicts while creating</li>
              <li className="text-green-400/80">Only essential fields shown first</li>
              <li className="text-green-400/80">More options via progressive disclosure</li>
              <li className="text-green-400/80">Esc to dismiss instantly</li>
            </ul>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-card-border text-xs text-muted">
          <p className="text-foreground font-medium mb-1">Recommendation for schedule specifically</p>
          <p>
            The schedule is the most interaction-heavy admin page. Use a <strong className="text-accent">hybrid approach</strong>:
          </p>
          <ul className="mt-1.5 space-y-1">
            <li><strong className="text-foreground">Create:</strong> Inline panel (shown here) — fast, keeps calendar context visible</li>
            <li><strong className="text-foreground">Edit:</strong> Keep dialog — editing needs roster management, notify members, cancel/delete actions, recurring options. Too much for inline.</li>
            <li><strong className="text-foreground">Move/resize:</strong> Already inline (drag & drop with confirm overlay) — keep as-is</li>
          </ul>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex flex-col border border-card-border rounded-lg overflow-hidden bg-card">
        {/* Inline add form — appears above the calendar */}
        {inlineAdd && (
          <InlineAddForm
            date={inlineAdd.date}
            startTime={inlineAdd.startTime}
            endTime={inlineAdd.endTime}
            onSave={handleInlineSave}
            onCancel={() => setInlineAdd(null)}
          />
        )}

        {/* Day headers */}
        <div className="flex border-b border-card-border sticky top-0 z-20 bg-card shrink-0">
          <div className="w-14 shrink-0 border-r border-card-border" />
          {weekDays.map((day, i) => {
            const isToday = day.toDateString() === today.toDateString()
            return (
              <div key={i} className="flex-1 text-center py-2 border-r border-card-border last:border-r-0 min-w-[100px]">
                <p className="text-[10px] text-muted uppercase tracking-wider">
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </p>
                <p className={cn('text-lg font-bold leading-tight', isToday ? 'text-accent' : 'text-foreground')}>
                  {day.getDate()}
                </p>
              </div>
            )
          })}
        </div>

        {/* Time grid */}
        <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: '600px' }}>
          <div className="flex relative" style={{ height: TOTAL_HEIGHT }}>
            {/* Time gutter */}
            <div className="w-14 shrink-0 border-r border-card-border relative">
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => {
                if (i === 0) return null
                const h = i + START_HOUR
                return (
                  <div key={i} className="absolute right-2 text-[10px] text-muted -translate-y-1/2" style={{ top: i * HOUR_HEIGHT }}>
                    {h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
                  </div>
                )
              })}
            </div>

            {/* Day columns */}
            {weekDays.map((day, dayIdx) => {
              const dateKey = day.toISOString().split('T')[0]
              const dayClasses = classesByDay[dateKey] || []
              const isToday = day.toDateString() === today.toDateString()

              return (
                <div
                  key={dayIdx}
                  ref={(el) => { columnRefs.current[dayIdx] = el }}
                  className="flex-1 relative border-r border-card-border last:border-r-0 min-w-[100px]"
                  style={{ height: TOTAL_HEIGHT }}
                  onPointerDown={(e) => handleGridPointerDown(e, dayIdx)}
                >
                  {/* Hour lines */}
                  {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                    <div key={i} className="absolute left-0 right-0 border-t border-card-border/40 pointer-events-none" style={{ top: i * HOUR_HEIGHT }} />
                  ))}
                  {/* Half-hour lines */}
                  {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                    <div key={`h-${i}`} className="absolute left-0 right-0 border-t border-dashed border-card-border/20 pointer-events-none" style={{ top: i * HOUR_HEIGHT + 30 }} />
                  ))}

                  {/* Today highlight */}
                  {isToday && <div className="absolute inset-0 bg-accent/[0.02] pointer-events-none" />}

                  {/* Drag-to-create preview */}
                  {createDrag?.dayIdx === dayIdx && createDrag.activated && (
                    <div
                      className="absolute left-1 right-1 rounded-md border-2 border-dashed border-accent/50 bg-accent/[0.08] pointer-events-none z-20 flex items-center justify-center"
                      style={{
                        top: `${createDrag.startTop}px`,
                        height: `${Math.max(SNAP_PX, createDrag.currentTop - createDrag.startTop)}px`,
                      }}
                    >
                      <div className="flex items-center gap-1.5 text-accent/70">
                        <Plus className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-medium">{pxToTime(createDrag.startTop)} – {pxToTime(createDrag.currentTop)}</span>
                      </div>
                    </div>
                  )}

                  {/* Event blocks */}
                  {dayClasses.map((cls) => {
                    const [sh, sm] = cls.startTime.split(':').map(Number)
                    const [eh, em] = cls.endTime.split(':').map(Number)
                    const startMins = (sh - START_HOUR) * 60 + sm
                    const endMins = (eh - START_HOUR) * 60 + em
                    const top = startMins
                    const height = endMins - startMins
                    const color = cls.classType?.color || '#c8a750'

                    return (
                      <div
                        key={cls.id}
                        className="absolute left-1 right-1 rounded-md border-l-[3px] overflow-hidden select-none cursor-pointer hover:shadow-md hover:z-10 transition-shadow group/block"
                        style={{
                          top: `${top}px`,
                          height: `${Math.max(height, 20)}px`,
                          borderLeftColor: color,
                          backgroundColor: `${color}15`,
                        }}
                      >
                        <div className="px-1.5 py-1 h-full flex flex-col overflow-hidden">
                          <span className="text-[11px] font-semibold text-foreground truncate leading-tight">
                            {cls.classType?.name || 'Class'}
                          </span>
                          <p className="text-[10px] text-muted leading-tight">{formatTime(cls.startTime)}</p>
                          {height >= 45 && cls.instructor?.name && (
                            <p className="text-[9px] text-muted/60 truncate">{cls.instructor.name}</p>
                          )}
                          {height >= 55 && cls.location?.name && (
                            <p className="text-[9px] text-accent/50 truncate">
                              {cls.location.name}{cls.zone?.name ? ` · ${cls.zone.name}` : ''}
                            </p>
                          )}
                          {height >= 35 && (
                            <div className="mt-auto">
                              <span className="text-[9px] text-muted font-semibold">{cls.booked}/{cls.capacity}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 px-4 py-3 rounded-lg border flex items-center gap-3 shadow-lg backdrop-blur-sm sm:max-w-sm animate-in slide-in-from-bottom-2',
          toast.type === 'error'
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : 'bg-green-500/10 border-green-500/20 text-green-400'
        )}>
          <span className="text-sm flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Additional UX notes */}
      <div className="mt-6 bg-card border border-card-border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-accent">Schedule-specific considerations</h2>
        <div className="text-xs text-muted space-y-2">
          <div>
            <p className="text-foreground font-medium mb-1">Why inline works for schedule creation</p>
            <p>
              The calendar is the context. When creating a class at 9am Tuesday, the admin needs to see
              what&apos;s already at 9am Tuesday. A dialog blocks this view. The inline panel keeps the
              calendar visible below while the form sits at the top — you can still see conflicts, instructor
              availability, and room utilization.
            </p>
          </div>
          <div>
            <p className="text-foreground font-medium mb-1">Why dialogs should stay for editing</p>
            <p>
              Edit needs: roster management (who&apos;s booked, add/remove members), notify members toggle,
              cancel/delete with refund, recurring series management, booking count visualization.
              This is too much for an inline panel. The rich edit dialog is the right pattern here.
            </p>
          </div>
          <div>
            <p className="text-foreground font-medium mb-1">Alternative: Side panel</p>
            <p>
              Some calendar apps (Google Calendar, Cal.com) use a side panel instead of top panel.
              This preserves even more calendar visibility but requires wider screens. For a week view
              with 7 columns, a side panel would compress the columns. The top panel is more responsive.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
