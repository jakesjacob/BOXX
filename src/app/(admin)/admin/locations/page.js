'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { MapPin, Plus, ChevronDown, ChevronRight, Layers, RefreshCw } from 'lucide-react'

export default function AdminLocationsPage() {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [toast, setToast] = useState(null)

  // Location dialog
  const [locDialog, setLocDialog] = useState(null) // 'create' | location object
  const [locForm, setLocForm] = useState({ name: '', address: '', city: '', country: '', phone: '', timezone: '' })
  const [submitting, setSubmitting] = useState(false)

  // Zone dialog
  const [zoneDialog, setZoneDialog] = useState(null) // { locationId, zone: 'create' | zone object }
  const [zoneForm, setZoneForm] = useState({ name: '', capacity: '', description: '' })

  // Expanded locations (for zone visibility)
  const [expanded, setExpanded] = useState(new Set())

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

  function openCreateLocation() {
    setLocForm({ name: '', address: '', city: '', country: '', phone: '', timezone: '' })
    setLocDialog('create')
  }

  function openEditLocation(loc) {
    setLocForm({
      name: loc.name || '',
      address: loc.address || '',
      city: loc.city || '',
      country: loc.country || '',
      phone: loc.phone || '',
      timezone: loc.timezone || '',
    })
    setLocDialog(loc)
  }

  async function saveLocation() {
    if (!locForm.name.trim()) return
    setSubmitting(true)
    try {
      const isCreate = locDialog === 'create'
      const res = await fetch('/api/admin/locations', {
        method: isCreate ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isCreate ? locForm : { id: locDialog.id, ...locForm }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ message: data.error || 'Failed to save', type: 'error' })
        return
      }
      setToast({ message: isCreate ? 'Location created' : 'Location updated', type: 'success' })
      setLocDialog(null)
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
  function openCreateZone(locationId) {
    setZoneForm({ name: '', capacity: '', description: '' })
    setZoneDialog({ locationId, zone: 'create' })
  }

  function openEditZone(locationId, zone) {
    setZoneForm({
      name: zone.name || '',
      capacity: zone.capacity == null ? '' : String(zone.capacity),
      description: zone.description || '',
    })
    setZoneDialog({ locationId, zone })
  }

  async function saveZone() {
    if (!zoneForm.name.trim()) return
    setSubmitting(true)
    try {
      const isCreate = zoneDialog.zone === 'create'
      const rawCapacity = zoneForm.capacity.trim()
      const parsedCapacity = rawCapacity === '' ? null : parseInt(rawCapacity, 10)
      const payload = {
        name: zoneForm.name,
        capacity: Number.isNaN(parsedCapacity) ? null : parsedCapacity,
        description: zoneForm.description || null,
      }
      const res = await fetch(`/api/admin/locations/${zoneDialog.locationId}/zones`, {
        method: isCreate ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isCreate ? payload : { id: zoneDialog.zone.id, ...payload }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ message: data.error || 'Failed to save zone', type: 'error' })
        return
      }
      setToast({ message: isCreate ? 'Zone created' : 'Zone updated', type: 'success' })
      setZoneDialog(null)
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Locations</h1>
          <p className="text-sm text-muted mt-1">Manage your studio locations and areas within them</p>
        </div>
        <Button onClick={openCreateLocation} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Location
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
      {!loading && !fetchError && locations.length === 0 && (
        <div className="bg-card border border-card-border rounded-lg p-12 text-center">
          <MapPin className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-foreground font-medium mb-1">No locations yet</p>
          <p className="text-sm text-muted mb-4">Add your first studio location to get started</p>
          <Button onClick={openCreateLocation} className="gap-2">
            <Plus className="w-4 h-4" /> Add Location
          </Button>
        </div>
      )}

      {/* Locations list */}
      {!loading && !fetchError && locations.length > 0 && (
        <div className="space-y-3">
          {locations.map((loc) => {
            const isExpanded = expanded.has(loc.id)
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
                    <Button variant="ghost" size="sm" onClick={() => openEditLocation(loc)}>
                      Edit
                    </Button>
                  </div>
                </div>

                {/* Zones section (expanded) */}
                {isExpanded && (
                  <div className="border-t border-card-border bg-background/30 px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between ml-7">
                      <div className="flex items-center gap-2 text-sm text-muted">
                        <Layers className="w-3.5 h-3.5" />
                        <span>Zones / Areas</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => openCreateZone(loc.id)} className="text-xs gap-1.5 h-7">
                        <Plus className="w-3 h-3" /> Add Zone
                      </Button>
                    </div>

                    {zones.length === 0 && (
                      <p className="text-xs text-muted/50 ml-7 py-2">No zones. Add zones to organize different areas within this location.</p>
                    )}

                    {zones.map((zone) => (
                      <div key={zone.id} className={cn(
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
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEditZone(loc.id, zone)}>
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Location Dialog */}
      <Dialog open={!!locDialog} onOpenChange={(open) => !open && setLocDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{locDialog === 'create' ? 'Add Location' : 'Edit Location'}</DialogTitle>
            <DialogDescription>
              {locDialog === 'create' ? 'Add a new studio location' : 'Update location details'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="locName">Name *</Label>
              <Input id="locName" value={locForm.name} onChange={(e) => setLocForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Main Studio" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="locAddress">Address</Label>
              <Input id="locAddress" value={locForm.address} onChange={(e) => setLocForm((f) => ({ ...f, address: e.target.value }))} placeholder="123 Sukhumvit Road" className="mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="locCity">City</Label>
                <Input id="locCity" value={locForm.city} onChange={(e) => setLocForm((f) => ({ ...f, city: e.target.value }))} placeholder="Bangkok" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="locCountry">Country</Label>
                <Input id="locCountry" value={locForm.country} onChange={(e) => setLocForm((f) => ({ ...f, country: e.target.value }))} placeholder="Thailand" className="mt-1.5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="locPhone">Phone</Label>
                <Input id="locPhone" value={locForm.phone} onChange={(e) => setLocForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+66 2 123 4567" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="locTimezone">Timezone</Label>
                <select id="locTimezone" value={locForm.timezone} onChange={(e) => setLocForm((f) => ({ ...f, timezone: e.target.value }))} className="mt-1.5 w-full rounded-md bg-background border border-card-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent">
                  <option value="">Select timezone</option>
                  {[
                    'Asia/Bangkok', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai',
                    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam', 'Europe/Madrid', 'Europe/Rome',
                    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto',
                    'America/Sao_Paulo', 'America/Mexico_City',
                    'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
                    'Africa/Johannesburg', 'Africa/Cairo',
                    'UTC',
                  ].map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocDialog(null)}>Cancel</Button>
            <Button onClick={saveLocation} disabled={submitting || !locForm.name.trim()}>
              {submitting ? 'Saving...' : locDialog === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Zone Dialog */}
      <Dialog open={!!zoneDialog} onOpenChange={(open) => !open && setZoneDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{zoneDialog?.zone === 'create' ? 'Add Zone' : 'Edit Zone'}</DialogTitle>
            <DialogDescription>
              Zones are areas within a location (e.g. Ring A, Studio 2, Room 3)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="zoneName">Name *</Label>
              <Input id="zoneName" value={zoneForm.name} onChange={(e) => setZoneForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Ring A, Studio 2" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="zoneCapacity">Capacity</Label>
              <Input id="zoneCapacity" type="number" min={1} value={zoneForm.capacity} onChange={(e) => setZoneForm((f) => ({ ...f, capacity: e.target.value }))} placeholder="Leave empty for unlimited" className="mt-1.5" />
              <p className="text-[10px] text-muted/50 mt-1">Leave empty for unlimited capacity</p>
            </div>
            <div>
              <Label htmlFor="zoneDesc">Description</Label>
              <Input id="zoneDesc" value={zoneForm.description} onChange={(e) => setZoneForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional description" className="mt-1.5" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setZoneDialog(null)}>Cancel</Button>
            <Button onClick={saveZone} disabled={submitting || !zoneForm.name.trim()}>
              {submitting ? 'Saving...' : zoneDialog?.zone === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
