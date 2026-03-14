'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { MapPin, Plus, ChevronDown, ChevronRight, Layers, RefreshCw, Check, X, ChevronUp } from 'lucide-react'

export default function AdminLocationsPage() {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [toast, setToast] = useState(null)

  // Inline location create/edit
  const [showCreateLoc, setShowCreateLoc] = useState(false)
  const [editingLocId, setEditingLocId] = useState(null)
  const [locForm, setLocForm] = useState({ name: '', address: '', city: '', country: '', phone: '', timezone: '', buffer_mins: 0 })
  const [locMoreOptions, setLocMoreOptions] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Inline zone create/edit
  const [creatingZoneForLoc, setCreatingZoneForLoc] = useState(null)
  const [editingZoneId, setEditingZoneId] = useState(null)
  const [editingZoneLocId, setEditingZoneLocId] = useState(null)
  const [zoneForm, setZoneForm] = useState({ name: '', capacity: '', description: '' })
  const [zoneMoreOptions, setZoneMoreOptions] = useState(false)

  // Expanded locations (for zone visibility)
  const [expanded, setExpanded] = useState(new Set())

  const createLocNameRef = useRef(null)
  const editLocNameRef = useRef(null)
  const createZoneNameRef = useRef(null)
  const editZoneNameRef = useRef(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  async function fetchLocations() {
    setFetchError(null)
    try {
      const res = await fetch('/api/admin/locations')
      if (res.ok) {
        const data = await res.json()
        setLocations(data.locations || [])
      } else {
        setFetchError('Failed to load locations')
      }
    } catch {
      setFetchError('Unable to connect. Check your internet and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLocations() }, [])

  // Focus name input when inline forms appear
  useEffect(() => {
    if (showCreateLoc) setTimeout(() => createLocNameRef.current?.focus(), 50)
  }, [showCreateLoc])

  useEffect(() => {
    if (editingLocId) setTimeout(() => editLocNameRef.current?.focus(), 50)
  }, [editingLocId])

  useEffect(() => {
    if (creatingZoneForLoc) setTimeout(() => createZoneNameRef.current?.focus(), 50)
  }, [creatingZoneForLoc])

  useEffect(() => {
    if (editingZoneId) setTimeout(() => editZoneNameRef.current?.focus(), 50)
  }, [editingZoneId])

  function startCreateLocation() {
    setLocForm({ name: '', address: '', city: '', country: '', phone: '', timezone: '', buffer_mins: 0 })
    setLocMoreOptions(false)
    setShowCreateLoc(true)
    setEditingLocId(null)
  }

  function cancelCreateLocation() {
    setShowCreateLoc(false)
    setLocMoreOptions(false)
  }

  function startEditLocation(loc) {
    setLocForm({
      name: loc.name || '',
      address: loc.address || '',
      city: loc.city || '',
      country: loc.country || '',
      phone: loc.phone || '',
      timezone: loc.timezone || '',
      buffer_mins: loc.buffer_mins || 0,
    })
    // Show more options if any optional field has data
    const hasOptional = loc.address || loc.city || loc.country || loc.phone || loc.timezone || loc.buffer_mins
    setLocMoreOptions(!!hasOptional)
    setEditingLocId(loc.id)
    setShowCreateLoc(false)
  }

  function cancelEditLocation() {
    setEditingLocId(null)
    setLocMoreOptions(false)
  }

  async function saveLocation(mode) {
    if (!locForm.name.trim()) return
    setSubmitting(true)
    try {
      const isCreate = mode === 'create'
      const editLoc = !isCreate ? locations.find((l) => l.id === editingLocId) : null
      const res = await fetch('/api/admin/locations', {
        method: isCreate ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isCreate ? locForm : { id: editingLocId, ...locForm }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ message: data.error || 'Failed to save', type: 'error' })
        return
      }
      setToast({ message: isCreate ? 'Location created' : 'Location updated', type: 'success' })
      if (isCreate) {
        setShowCreateLoc(false)
      } else {
        setEditingLocId(null)
      }
      setLocMoreOptions(false)
      fetchLocations()
    } catch {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleLocationActive(loc) {
    const res = await fetch('/api/admin/locations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: loc.id, is_active: !loc.is_active }),
    })
    const data = await res.json()
    if (!res.ok) {
      setToast({ message: data.error || 'Failed to update', type: 'error' })
      return
    }
    fetchLocations()
  }

  function toggleExpanded(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Zone handlers
  function startCreateZone(locationId) {
    setZoneForm({ name: '', capacity: '', description: '' })
    setZoneMoreOptions(false)
    setCreatingZoneForLoc(locationId)
    setEditingZoneId(null)
    setEditingZoneLocId(null)
  }

  function cancelCreateZone() {
    setCreatingZoneForLoc(null)
    setZoneMoreOptions(false)
  }

  function startEditZone(locationId, zone) {
    setZoneForm({
      name: zone.name || '',
      capacity: zone.capacity == null ? '' : String(zone.capacity),
      description: zone.description || '',
    })
    setZoneMoreOptions(!!zone.description)
    setEditingZoneId(zone.id)
    setEditingZoneLocId(locationId)
    setCreatingZoneForLoc(null)
  }

  function cancelEditZone() {
    setEditingZoneId(null)
    setEditingZoneLocId(null)
    setZoneMoreOptions(false)
  }

  async function saveZone(mode) {
    if (!zoneForm.name.trim()) return
    setSubmitting(true)
    const locationId = mode === 'create' ? creatingZoneForLoc : editingZoneLocId
    try {
      const isCreate = mode === 'create'
      const rawCapacity = zoneForm.capacity.trim()
      const parsedCapacity = rawCapacity === '' ? null : parseInt(rawCapacity, 10)
      const payload = {
        name: zoneForm.name,
        capacity: Number.isNaN(parsedCapacity) ? null : parsedCapacity,
        description: zoneForm.description || null,
      }
      const res = await fetch(`/api/admin/locations/${locationId}/zones`, {
        method: isCreate ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isCreate ? payload : { id: editingZoneId, ...payload }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ message: data.error || 'Failed to save zone', type: 'error' })
        return
      }
      setToast({ message: isCreate ? 'Zone created' : 'Zone updated', type: 'success' })
      if (isCreate) {
        setCreatingZoneForLoc(null)
      } else {
        setEditingZoneId(null)
        setEditingZoneLocId(null)
      }
      setZoneMoreOptions(false)
      fetchLocations()
    } catch {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleZoneActive(locationId, zone) {
    const res = await fetch(`/api/admin/locations/${locationId}/zones`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: zone.id, is_active: !zone.is_active }),
    })
    const data = await res.json()
    if (!res.ok) {
      setToast({ message: data.error || 'Failed to update', type: 'error' })
      return
    }
    fetchLocations()
  }

  function handleLocKeyDown(e, mode) {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveLocation(mode)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (mode === 'create') cancelCreateLocation()
      else cancelEditLocation()
    }
  }

  function handleZoneKeyDown(e, mode) {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveZone(mode)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (mode === 'create') cancelCreateZone()
      else cancelEditZone()
    }
  }

  // Timezone options
  const timezones = [
    'Asia/Bangkok', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam', 'Europe/Madrid', 'Europe/Rome',
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto',
    'America/Sao_Paulo', 'America/Mexico_City',
    'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
    'Africa/Johannesburg', 'Africa/Cairo',
    'UTC',
  ]

  // Shared optional fields for location form
  function renderLocOptionalFields() {
    return (
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <Label className="text-xs text-muted">Address</Label>
          <Input
            value={locForm.address}
            onChange={(e) => setLocForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="123 Sukhumvit Road"
            className="mt-1 h-8 text-sm bg-background border-card-border"
            onKeyDown={(e) => handleLocKeyDown(e, editingLocId ? 'edit' : 'create')}
          />
        </div>
        <div>
          <Label className="text-xs text-muted">City</Label>
          <Input
            value={locForm.city}
            onChange={(e) => setLocForm((f) => ({ ...f, city: e.target.value }))}
            placeholder="Bangkok"
            className="mt-1 h-8 text-sm bg-background border-card-border"
            onKeyDown={(e) => handleLocKeyDown(e, editingLocId ? 'edit' : 'create')}
          />
        </div>
        <div>
          <Label className="text-xs text-muted">Country</Label>
          <Input
            value={locForm.country}
            onChange={(e) => setLocForm((f) => ({ ...f, country: e.target.value }))}
            placeholder="Thailand"
            className="mt-1 h-8 text-sm bg-background border-card-border"
            onKeyDown={(e) => handleLocKeyDown(e, editingLocId ? 'edit' : 'create')}
          />
        </div>
        <div>
          <Label className="text-xs text-muted">Phone</Label>
          <Input
            value={locForm.phone}
            onChange={(e) => setLocForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+66 2 123 4567"
            className="mt-1 h-8 text-sm bg-background border-card-border"
            onKeyDown={(e) => handleLocKeyDown(e, editingLocId ? 'edit' : 'create')}
          />
        </div>
        <div>
          <Label className="text-xs text-muted">Timezone</Label>
          <select
            value={locForm.timezone}
            onChange={(e) => setLocForm((f) => ({ ...f, timezone: e.target.value }))}
            className="mt-1 w-full rounded-md bg-background border border-card-border px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent h-8"
          >
            <option value="">Select timezone</option>
            {timezones.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs text-muted">Buffer Time</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              type="number"
              min={0}
              max={120}
              step={5}
              value={locForm.buffer_mins}
              onChange={(e) => setLocForm((f) => ({ ...f, buffer_mins: parseInt(e.target.value) || 0 }))}
              className="h-8 text-sm w-20 bg-background border-card-border"
              onKeyDown={(e) => handleLocKeyDown(e, editingLocId ? 'edit' : 'create')}
            />
            <span className="text-xs text-muted">min</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Locations</h1>
        <p className="text-sm text-muted mt-1">Manage your studio locations and areas within them</p>
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

      {/* Error state */}
      {fetchError && (
        <div className="bg-card border border-card-border rounded-lg p-8 text-center">
          <p className="text-red-400 mb-4">{fetchError}</p>
          <Button variant="outline" onClick={fetchLocations} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Retry
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading && !fetchError && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-card border border-card-border rounded-lg p-5 animate-pulse">
              <div className="h-5 w-48 bg-card-border rounded" />
              <div className="h-4 w-32 bg-card-border rounded mt-2" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !fetchError && locations.length === 0 && !showCreateLoc && (
        <div className="bg-card border border-card-border rounded-lg p-12 text-center">
          <MapPin className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-foreground font-medium mb-1">No locations yet</p>
          <p className="text-sm text-muted mb-4">Add your first studio location to get started</p>
          <Button onClick={startCreateLocation} className="gap-2">
            <Plus className="w-4 h-4" /> Add Location
          </Button>
        </div>
      )}

      {/* Locations list */}
      {!loading && !fetchError && (locations.length > 0 || showCreateLoc) && (
        <div className="space-y-3">
          {locations.map((loc) => {
            const isExpanded = expanded.has(loc.id)
            const isEditing = editingLocId === loc.id
            const zones = loc.zones || []
            return (
              <div key={loc.id} className={cn('bg-card border border-card-border rounded-lg overflow-hidden', !loc.is_active && 'opacity-60')}>
                {/* Location header */}
                <div className="p-4 flex items-start gap-3">
                  <button
                    onClick={() => toggleExpanded(loc.id)}
                    className="mt-0.5 text-muted hover:text-foreground transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-accent shrink-0" />
                      <h3 className="font-semibold text-foreground truncate">{loc.name}</h3>
                      {!loc.is_active && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded">Inactive</span>
                      )}
                    </div>
                    {(loc.address || loc.city || loc.country) && (
                      <p className="text-xs text-muted mt-1 ml-6">
                        {[loc.address, loc.city, loc.country].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {zones.length > 0 && (
                      <p className="text-xs text-muted/60 mt-1 ml-6">
                        {zones.filter((z) => z.is_active).length} active zone{zones.filter((z) => z.is_active).length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Switch
                      checked={loc.is_active}
                      onCheckedChange={() => toggleLocationActive(loc)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => isEditing ? cancelEditLocation() : startEditLocation(loc)}
                      className={cn(isEditing && 'text-accent')}
                    >
                      {isEditing ? 'Cancel' : 'Edit'}
                    </Button>
                  </div>
                </div>

                {/* Inline edit panel */}
                {isEditing && (
                  <div className="border-t border-card-border bg-background/50 px-4 py-4 ml-7 mr-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Label className="text-xs text-muted">Name *</Label>
                        <Input
                          ref={editLocNameRef}
                          value={locForm.name}
                          onChange={(e) => setLocForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Location name"
                          className="mt-1 h-8 text-sm bg-background border-card-border"
                          onKeyDown={(e) => handleLocKeyDown(e, 'edit')}
                        />
                      </div>
                      <div className="flex items-center gap-1 pt-5">
                        <button
                          onClick={() => saveLocation('edit')}
                          disabled={submitting || !locForm.name.trim()}
                          className={cn(
                            'p-1.5 rounded-md transition-colors',
                            submitting || !locForm.name.trim()
                              ? 'text-muted cursor-not-allowed'
                              : 'text-green-400 hover:bg-green-500/10'
                          )}
                          title="Save"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={cancelEditLocation}
                          className="p-1.5 rounded-md text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* More options toggle */}
                    <button
                      onClick={() => setLocMoreOptions(!locMoreOptions)}
                      className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors mt-3"
                    >
                      {locMoreOptions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {locMoreOptions ? 'Fewer options' : 'More options'}
                    </button>

                    {locMoreOptions && renderLocOptionalFields()}
                  </div>
                )}

                {/* Zones section (expanded) */}
                {isExpanded && (
                  <div className="border-t border-card-border bg-background/30 px-4 py-3 space-y-2">
                    <div className="flex items-center ml-7">
                      <div className="flex items-center gap-2 text-sm text-muted">
                        <Layers className="w-3.5 h-3.5" />
                        <span>Zones / Areas</span>
                      </div>
                    </div>

                    {zones.length === 0 && creatingZoneForLoc !== loc.id && (
                      <p className="text-xs text-muted/50 ml-7 py-2">No zones. Add zones to organize different areas within this location.</p>
                    )}

                    {zones.map((zone) => {
                      const isZoneEditing = editingZoneId === zone.id
                      return (
                        <div key={zone.id}>
                          <div className={cn(
                            'ml-7 flex items-center justify-between py-2 px-3 rounded-md bg-card/50 border border-card-border/50',
                            !zone.is_active && 'opacity-50'
                          )}>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-foreground">{zone.name}</span>
                                <span className="text-[10px] text-muted px-1.5 py-0.5 bg-card-border/50 rounded">
                                  {zone.capacity == null ? 'Unlimited' : `Cap: ${zone.capacity}`}
                                </span>
                                {!zone.is_active && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded">Inactive</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={zone.is_active}
                                onCheckedChange={() => toggleZoneActive(loc.id, zone)}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className={cn('h-7 text-xs', isZoneEditing && 'text-accent')}
                                onClick={() => isZoneEditing ? cancelEditZone() : startEditZone(loc.id, zone)}
                              >
                                {isZoneEditing ? 'Cancel' : 'Edit'}
                              </Button>
                            </div>
                          </div>

                          {/* Inline zone edit */}
                          {isZoneEditing && (
                            <div className="ml-7 mt-1 px-3 py-3 rounded-md bg-background/50 border border-card-border/50">
                              <div className="flex items-end gap-2">
                                <div className="flex-1">
                                  <Label className="text-xs text-muted">Name *</Label>
                                  <Input
                                    ref={editZoneNameRef}
                                    value={zoneForm.name}
                                    onChange={(e) => setZoneForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder="Zone name"
                                    className="mt-1 h-7 text-sm bg-background border-card-border"
                                    onKeyDown={(e) => handleZoneKeyDown(e, 'edit')}
                                  />
                                </div>
                                <div className="w-24">
                                  <Label className="text-xs text-muted">Capacity</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={zoneForm.capacity}
                                    onChange={(e) => setZoneForm((f) => ({ ...f, capacity: e.target.value }))}
                                    placeholder="Unlimited"
                                    className="mt-1 h-7 text-sm bg-background border-card-border"
                                    onKeyDown={(e) => handleZoneKeyDown(e, 'edit')}
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => saveZone('edit')}
                                    disabled={submitting || !zoneForm.name.trim()}
                                    className={cn(
                                      'p-1 rounded-md transition-colors',
                                      submitting || !zoneForm.name.trim()
                                        ? 'text-muted cursor-not-allowed'
                                        : 'text-green-400 hover:bg-green-500/10'
                                    )}
                                    title="Save"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={cancelEditZone}
                                    className="p-1 rounded-md text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Zone more options */}
                              <button
                                onClick={() => setZoneMoreOptions(!zoneMoreOptions)}
                                className="flex items-center gap-1 text-[11px] text-muted hover:text-foreground transition-colors mt-2"
                              >
                                {zoneMoreOptions ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                                {zoneMoreOptions ? 'Fewer options' : 'More options'}
                              </button>

                              {zoneMoreOptions && (
                                <div className="mt-2">
                                  <Label className="text-xs text-muted">Description</Label>
                                  <Input
                                    value={zoneForm.description}
                                    onChange={(e) => setZoneForm((f) => ({ ...f, description: e.target.value }))}
                                    placeholder="Optional description"
                                    className="mt-1 h-7 text-sm bg-background border-card-border"
                                    onKeyDown={(e) => handleZoneKeyDown(e, 'edit')}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Inline zone create */}
                    {creatingZoneForLoc === loc.id && (
                      <div className="ml-7 px-3 py-3 rounded-md border border-dashed border-card-border bg-background/50">
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Label className="text-xs text-muted">Name *</Label>
                            <Input
                              ref={createZoneNameRef}
                              value={zoneForm.name}
                              onChange={(e) => setZoneForm((f) => ({ ...f, name: e.target.value }))}
                              placeholder="e.g. Ring A, Studio 2"
                              className="mt-1 h-7 text-sm bg-background border-card-border"
                              onKeyDown={(e) => handleZoneKeyDown(e, 'create')}
                            />
                          </div>
                          <div className="w-24">
                            <Label className="text-xs text-muted">Capacity</Label>
                            <Input
                              type="number"
                              min={1}
                              value={zoneForm.capacity}
                              onChange={(e) => setZoneForm((f) => ({ ...f, capacity: e.target.value }))}
                              placeholder="Unlimited"
                              className="mt-1 h-7 text-sm bg-background border-card-border"
                              onKeyDown={(e) => handleZoneKeyDown(e, 'create')}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => saveZone('create')}
                              disabled={submitting || !zoneForm.name.trim()}
                              className={cn(
                                'p-1 rounded-md transition-colors',
                                submitting || !zoneForm.name.trim()
                                  ? 'text-muted cursor-not-allowed'
                                  : 'text-green-400 hover:bg-green-500/10'
                              )}
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelCreateZone}
                              className="p-1 rounded-md text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Zone more options */}
                        <button
                          onClick={() => setZoneMoreOptions(!zoneMoreOptions)}
                          className="flex items-center gap-1 text-[11px] text-muted hover:text-foreground transition-colors mt-2"
                        >
                          {zoneMoreOptions ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                          {zoneMoreOptions ? 'Fewer options' : 'More options'}
                        </button>

                        {zoneMoreOptions && (
                          <div className="mt-2">
                            <Label className="text-xs text-muted">Description</Label>
                            <Input
                              value={zoneForm.description}
                              onChange={(e) => setZoneForm((f) => ({ ...f, description: e.target.value }))}
                              placeholder="Optional description"
                              className="mt-1 h-7 text-sm bg-background border-card-border"
                              onKeyDown={(e) => handleZoneKeyDown(e, 'create')}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Dashed add zone button */}
                    {creatingZoneForLoc !== loc.id && (
                      <button
                        onClick={() => startCreateZone(loc.id)}
                        className="ml-7 w-[calc(100%-1.75rem)] py-2 rounded-md border border-dashed border-card-border text-xs text-muted hover:text-accent hover:border-accent/30 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3 h-3" />
                        Add zone
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Inline create location form */}
          {showCreateLoc && (
            <div className="bg-card border border-dashed border-card-border rounded-lg p-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-accent shrink-0" />
                <div className="flex-1">
                  <Input
                    ref={createLocNameRef}
                    value={locForm.name}
                    onChange={(e) => setLocForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Location name"
                    className="h-8 text-sm bg-background border-card-border"
                    onKeyDown={(e) => handleLocKeyDown(e, 'create')}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => saveLocation('create')}
                    disabled={submitting || !locForm.name.trim()}
                    className={cn(
                      'p-1.5 rounded-md transition-colors',
                      submitting || !locForm.name.trim()
                        ? 'text-muted cursor-not-allowed'
                        : 'text-green-400 hover:bg-green-500/10'
                    )}
                    title="Save"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelCreateLocation}
                    className="p-1.5 rounded-md text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* More options toggle */}
              <button
                onClick={() => setLocMoreOptions(!locMoreOptions)}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors mt-3 ml-6"
              >
                {locMoreOptions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {locMoreOptions ? 'Fewer options' : 'More options'}
              </button>

              {locMoreOptions && (
                <div className="ml-6">
                  {renderLocOptionalFields()}
                </div>
              )}
            </div>
          )}

          {/* Dashed add location button */}
          {!showCreateLoc && (
            <button
              onClick={startCreateLocation}
              className="w-full py-3 rounded-lg border border-dashed border-card-border text-sm text-muted hover:text-accent hover:border-accent/30 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add location
            </button>
          )}
        </div>
      )}
    </div>
  )
}
