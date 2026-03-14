'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Clock, MapPin, User, Calendar, RefreshCw, Check } from 'lucide-react'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatTime(time) {
  const [h, m] = time.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function BookAppointmentPage() {
  const [slots, setSlots] = useState([])
  const [instructors, setInstructors] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [toast, setToast] = useState(null)

  // Confirmation dialog
  const [pendingSlot, setPendingSlot] = useState(null)
  const [booking, setBooking] = useState(false)

  // Success state
  const [bookedSlot, setBookedSlot] = useState(null)

  // Filters
  const [selectedInstructor, setSelectedInstructor] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString().split('T')[0]
  })

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  const fetchSlots = useCallback(async () => {
    setFetchError(null)
    setLoading(true)
    try {
      const params = new URLSearchParams({ date: weekStart, days: '7' })
      if (selectedInstructor) params.set('instructorId', selectedInstructor)
      const res = await fetch(`/api/availability?${params}`)
      if (!res.ok) {
        const data = await res.json()
        if (res.status === 402) {
          setFetchError('Appointment booking is not available on your current plan.')
        } else {
          setFetchError(data.error || 'Failed to load availability')
        }
        return
      }
      const data = await res.json()
      setSlots(data.slots || [])
      setInstructors(data.instructors || [])
    } catch {
      setFetchError('Unable to connect. Check your internet and try again.')
    } finally {
      setLoading(false)
    }
  }, [weekStart, selectedInstructor])

  useEffect(() => { fetchSlots() }, [fetchSlots])

  function handleSlotClick(slot) {
    setBookedSlot(null)
    setPendingSlot(slot)
  }

  async function confirmBook() {
    if (!pendingSlot) return
    setBooking(true)
    try {
      const res = await fetch('/api/availability/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          availabilityId: pendingSlot.availabilityId,
          date: pendingSlot.date,
          time: pendingSlot.time,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ message: data.error || 'Booking failed', type: 'error' })
        setPendingSlot(null)
        return
      }
      setBookedSlot(pendingSlot)
      setPendingSlot(null)
      setToast({ message: data.message || 'Appointment booked!', type: 'success' })
      fetchSlots()
    } catch {
      setToast({ message: 'Something went wrong', type: 'error' })
      setPendingSlot(null)
    } finally {
      setBooking(false)
    }
  }

  function shiftWeek(direction) {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + direction * 7)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (d < today) return
    setWeekStart(d.toISOString().split('T')[0])
    setSelectedDate('')
    setBookedSlot(null)
  }

  // Group slots by date
  const slotsByDate = {}
  slots.forEach((slot) => {
    if (!slotsByDate[slot.date]) slotsByDate[slot.date] = []
    slotsByDate[slot.date].push(slot)
  })

  // Generate week days for the header
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  const today = new Date().toISOString().split('T')[0]

  // Filter by selected date
  const displaySlots = selectedDate ? (slotsByDate[selectedDate] || []) : slots

  // Group display slots by instructor for better presentation
  const slotsByInstructor = {}
  displaySlots.forEach((slot) => {
    const key = slot.instructorId
    if (!slotsByInstructor[key]) {
      slotsByInstructor[key] = { instructor: slot.instructor, slots: [] }
    }
    slotsByInstructor[key].slots.push(slot)
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Book Appointment</h1>
        <p className="text-sm text-muted mt-1">Choose an available time slot with your preferred instructor</p>
      </div>

      {/* Toast */}
      {toast && (
        <div className={cn(
          'px-4 py-3 rounded-lg text-sm flex items-center gap-2 transition-all',
          toast.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'
        )}>
          {toast.type === 'success' && <Check className="w-4 h-4 shrink-0" />}
          {toast.message}
        </div>
      )}

      {/* Success banner */}
      {bookedSlot && (
        <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-accent" />
            </div>
            <p className="text-sm font-semibold text-accent">Appointment confirmed</p>
          </div>
          <p className="text-xs text-muted ml-8">
            {formatTime(bookedSlot.time)} on {FULL_DAY_NAMES[new Date(bookedSlot.date + 'T12:00:00Z').getDay()]}, {new Date(bookedSlot.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {bookedSlot.instructor?.name && ` with ${bookedSlot.instructor.name}`}
            {bookedSlot.location?.name && ` at ${bookedSlot.location.name}`}
          </p>
        </div>
      )}

      {/* Instructor filter */}
      {instructors.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedInstructor('')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
              !selectedInstructor ? 'bg-accent text-background' : 'bg-card border border-card-border text-muted hover:text-foreground'
            )}
          >
            All Instructors
          </button>
          {instructors.map((inst) => (
            <button
              key={inst.id}
              onClick={() => setSelectedInstructor(inst.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                selectedInstructor === inst.id ? 'bg-accent text-background' : 'bg-card border border-card-border text-muted hover:text-foreground'
              )}
            >
              {inst.photo_url && (
                <Image src={inst.photo_url} alt="" width={16} height={16} className="w-4 h-4 rounded-full object-cover" />
              )}
              {inst.name}
            </button>
          ))}
        </div>
      )}

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => shiftWeek(-1)} className="text-muted hover:text-foreground transition-colors p-2 -ml-2 rounded-lg hover:bg-card">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex gap-1">
          {weekDays.map((dateStr) => {
            const d = new Date(dateStr + 'T12:00:00Z')
            const isToday = dateStr === today
            const hasSlots = !!slotsByDate[dateStr]?.length
            const slotCount = slotsByDate[dateStr]?.length || 0
            const isSelected = dateStr === selectedDate
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(isSelected ? '' : dateStr)}
                className={cn(
                  'flex flex-col items-center px-2.5 py-2 rounded-lg text-xs transition-all min-w-[48px]',
                  isSelected ? 'bg-accent text-background ring-2 ring-accent/30' :
                  isToday ? 'bg-accent/10 text-accent' :
                  hasSlots ? 'bg-card text-foreground hover:bg-card-border hover:scale-105' :
                  'text-muted/30 cursor-default'
                )}
                disabled={!hasSlots && !isSelected}
              >
                <span className="font-medium">{DAY_NAMES[d.getUTCDay()]}</span>
                <span className={cn('text-lg font-bold', !hasSlots && 'opacity-40')}>{d.getUTCDate()}</span>
                {hasSlots && (
                  <span className={cn('text-[9px] mt-0.5', isSelected ? 'text-background/70' : 'text-muted/60')}>
                    {slotCount} slot{slotCount !== 1 ? 's' : ''}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <button onClick={() => shiftWeek(1)} className="text-muted hover:text-foreground transition-colors p-2 -mr-2 rounded-lg hover:bg-card">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Error state */}
      {fetchError && (
        <div className="bg-card border border-card-border rounded-lg p-8 text-center">
          <p className="text-red-400 mb-4">{fetchError}</p>
          <Button variant="outline" onClick={fetchSlots} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Retry
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading && !fetchError && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-card-border rounded-lg p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-card-border" />
                <div className="h-5 w-32 bg-card-border rounded" />
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-16 w-20 bg-card-border rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !fetchError && displaySlots.length === 0 && (
        <div className="bg-card border border-card-border rounded-lg p-12 text-center">
          <Calendar className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-foreground font-medium mb-1">No available slots</p>
          <p className="text-sm text-muted mb-4">
            {selectedDate ? `No availability on ${FULL_DAY_NAMES[new Date(selectedDate + 'T12:00:00Z').getUTCDay()]}` :
             selectedInstructor ? 'This instructor has no availability this week' :
             'No appointments available this week'}
          </p>
          <div className="flex gap-2 justify-center">
            {selectedDate && (
              <Button variant="outline" size="sm" onClick={() => setSelectedDate('')}>Show all days</Button>
            )}
            <Button variant="outline" size="sm" onClick={() => shiftWeek(1)} className="gap-1.5">
              Next week <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Slots grouped by instructor */}
      {!loading && !fetchError && Object.entries(slotsByInstructor).map(([instrId, { instructor, slots: instrSlots }]) => (
        <Card key={instrId} className="overflow-hidden">
          <CardContent className="p-4">
            {/* Instructor header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden shrink-0">
                {instructor?.photo_url ? (
                  <Image src={instructor.photo_url} alt={instructor?.name || ''} width={40} height={40} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-accent" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">{instructor?.name || 'Instructor'}</h3>
                {instructor?.bio && (
                  <p className="text-xs text-muted line-clamp-1">{instructor.bio}</p>
                )}
              </div>
            </div>

            {/* Group by date, then by time-of-day */}
            {Object.entries(
              instrSlots.reduce((acc, slot) => {
                if (!acc[slot.date]) acc[slot.date] = []
                acc[slot.date].push(slot)
                return acc
              }, {})
            ).map(([dateStr, dateSlots]) => {
              const d = new Date(dateStr + 'T12:00:00Z')
              // Group by time-of-day (Morning <12, Afternoon 12-17, Evening 17+)
              const morning = dateSlots.filter(s => parseInt(s.time) < 12)
              const afternoon = dateSlots.filter(s => { const h = parseInt(s.time); return h >= 12 && h < 17 })
              const evening = dateSlots.filter(s => parseInt(s.time) >= 17)
              const timeGroups = [
                { label: 'Morning', slots: morning },
                { label: 'Afternoon', slots: afternoon },
                { label: 'Evening', slots: evening },
              ].filter(g => g.slots.length > 0)

              return (
                <div key={dateStr} className="mb-5 last:mb-0">
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-xs text-muted font-medium">
                      {FULL_DAY_NAMES[d.getUTCDay()]}, {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                    </p>
                    {dateSlots[0]?.location && (
                      <span className="flex items-center gap-1 text-[10px] text-muted/50">
                        <MapPin className="w-3 h-3" />
                        {dateSlots[0].location.name}
                        {dateSlots[0].zone && ` \u00b7 ${dateSlots[0].zone.name}`}
                      </span>
                    )}
                  </div>
                  {timeGroups.map(({ label, slots: groupSlots }) => (
                    <div key={label} className="mb-3 last:mb-0">
                      {timeGroups.length > 1 && (
                        <p className="text-[10px] text-muted/50 uppercase tracking-wider font-medium mb-1.5 ml-0.5">{label}</p>
                      )}
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {groupSlots.map((slot) => {
                          const slotKey = `${slot.availabilityId}:${slot.date}:${slot.time}`
                          return (
                            <button
                              key={slotKey}
                              onClick={() => handleSlotClick(slot)}
                              className="flex flex-col items-center px-2 py-2.5 rounded-lg border border-card-border bg-card hover:border-accent/50 hover:bg-accent/5 active:scale-95 transition-all text-sm group"
                            >
                              <span className="font-semibold text-foreground group-hover:text-accent transition-colors">{formatTime(slot.time)}</span>
                              <span className="text-[10px] text-muted flex items-center gap-0.5 mt-0.5">
                                <Clock className="w-2.5 h-2.5" />{slot.duration}min
                              </span>
                              {slot.creditsCost === 0 ? (
                                <span className="text-[9px] text-green-400 font-medium mt-0.5">Free</span>
                              ) : (
                                <span className="text-[9px] text-muted mt-0.5">{slot.creditsCost} credit{slot.creditsCost !== 1 ? 's' : ''}</span>
                              )}
                              {slot.concurrentSlots > 1 && (
                                <span className={cn(
                                  'text-[9px] mt-0.5 font-medium',
                                  slot.slotsRemaining <= 2 ? 'text-orange-400' : 'text-accent/60'
                                )}>
                                  {slot.slotsRemaining} left
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}

      {/* Confirmation Dialog */}
      <Dialog open={!!pendingSlot} onOpenChange={(open) => { if (!open && !booking) setPendingSlot(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Appointment</DialogTitle>
            <DialogDescription>Review the details and confirm your booking</DialogDescription>
          </DialogHeader>
          {pendingSlot && (
            <div className="space-y-3 py-2">
              <div className="bg-card border border-card-border rounded-lg p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-accent shrink-0" />
                  <span className="text-sm text-foreground font-medium">{pendingSlot.instructor?.name || 'Instructor'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-accent shrink-0" />
                  <span className="text-sm text-foreground">
                    {FULL_DAY_NAMES[new Date(pendingSlot.date + 'T12:00:00Z').getUTCDay()]}, {new Date(pendingSlot.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent shrink-0" />
                  <span className="text-sm text-foreground">{formatTime(pendingSlot.time)} ({pendingSlot.duration} minutes)</span>
                </div>
                {pendingSlot.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-accent shrink-0" />
                    <span className="text-sm text-foreground">
                      {pendingSlot.location.name}
                      {pendingSlot.zone && ` \u00b7 ${pendingSlot.zone.name}`}
                    </span>
                  </div>
                )}
              </div>
              {pendingSlot.creditsCost > 0 && (
                <p className="text-xs text-muted text-center">
                  This will use {pendingSlot.creditsCost} credit{pendingSlot.creditsCost !== 1 ? 's' : ''} from your pack
                </p>
              )}
              {pendingSlot.creditsCost === 0 && (
                <p className="text-xs text-green-400 text-center font-medium">This is a free appointment</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingSlot(null)} disabled={booking}>Cancel</Button>
            <Button onClick={confirmBook} disabled={booking}>
              {booking ? 'Booking...' : 'Confirm Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
