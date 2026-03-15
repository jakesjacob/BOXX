'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { X, Check, User, ChevronDown, ChevronUp } from 'lucide-react'

export default function AdminInstructorsPage() {
  const [instructors, setInstructors] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [fetchError, setFetchError] = useState(null)

  // Inline create state
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', bio: '' })
  const [createShowBio, setCreateShowBio] = useState(false)
  const createNameRef = useRef(null)

  // Inline edit state
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', bio: '' })
  const [editShowBio, setEditShowBio] = useState(false)
  const editNameRef = useRef(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  async function fetchInstructors() {
    setFetchError(null)
    try {
      const res = await fetch('/api/admin/instructors')
      if (res.ok) {
        const data = await res.json()
        setInstructors(data.instructors || [])
      } else {
        setFetchError('Failed to load instructors')
      }
    } catch (err) {
      console.error(err)
      setFetchError('Unable to connect. Check your internet and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchInstructors() }, [])

  // Focus name input when create row appears
  useEffect(() => {
    if (showCreate && createNameRef.current) {
      createNameRef.current.focus()
    }
  }, [showCreate])

  // Focus name input when edit row appears
  useEffect(() => {
    if (editingId && editNameRef.current) {
      editNameRef.current.focus()
    }
  }, [editingId])

  function startCreate() {
    setEditingId(null)
    setCreateForm({ name: '', bio: '' })
    setCreateShowBio(false)
    setShowCreate(true)
  }

  function cancelCreate() {
    setShowCreate(false)
    setCreateForm({ name: '', bio: '' })
    setCreateShowBio(false)
  }

  function startEdit(inst) {
    setShowCreate(false)
    setEditForm({ name: inst.name, bio: inst.bio || '' })
    setEditShowBio(!!inst.bio)
    setEditingId(inst.id)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm({ name: '', bio: '' })
    setEditShowBio(false)
  }

  async function handleSaveCreate() {
    if (!createForm.name.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/instructors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name,
          bio: createForm.bio || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ message: data.error || 'Failed to save', type: 'error' })
        return
      }
      setToast({ message: 'Instructor added', type: 'success' })
      cancelCreate()
      fetchInstructors()
    } catch (err) {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveEdit() {
    if (!editForm.name.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/instructors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          name: editForm.name,
          bio: editForm.bio || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ message: data.error || 'Failed to save', type: 'error' })
        return
      }
      setToast({ message: 'Instructor updated', type: 'success' })
      cancelEdit()
      fetchInstructors()
    } catch (err) {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(e, inst) {
    e.stopPropagation()
    try {
      const res = await fetch('/api/admin/instructors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inst.id, active: !inst.active }),
      })
      if (res.ok) {
        setToast({ message: inst.active ? 'Instructor deactivated' : 'Instructor activated', type: 'success' })
        fetchInstructors()
      }
    } catch (err) {
      setToast({ message: 'Failed to update', type: 'error' })
    }
  }

  const handleCreateKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveCreate()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelCreate()
    }
  }, [createForm, submitting])

  const handleEditKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  }, [editForm, submitting, editingId])

  // Click outside to close inline forms
  useEffect(() => {
    function handleClickOutside(e) {
      if (showCreate) {
        const createEl = document.querySelector('[data-instructor-create]')
        if (createEl && !createEl.contains(e.target)) cancelCreate()
      }
      if (editingId) {
        const editEl = document.querySelector('[data-instructor-edit]')
        if (editEl && !editEl.contains(e.target)) cancelEdit()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showCreate, editingId])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Instructors</h1>
        <p className="text-sm text-muted mt-1">Manage your team of instructors and coaches</p>
      </div>

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 px-4 py-3 rounded-lg border flex items-center gap-3 shadow-lg backdrop-blur-sm sm:max-w-sm',
          toast.type === 'error'
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : 'bg-green-500/10 border-green-500/20 text-green-400'
        )}>
          <span className="text-sm flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 shrink-0"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {fetchError && !loading ? (
        <div className="border border-card-border rounded-lg py-12 text-center">
          <p className="text-red-400 font-medium">{fetchError}</p>
          <button
            onClick={fetchInstructors}
            className="mt-3 px-3 py-1.5 text-sm border border-card-border rounded-md text-foreground hover:bg-white/[0.03] transition-colors"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-card border border-card-border rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Empty state (but still show add button below) */}
          {instructors.length === 0 && !showCreate && (
            <div className="border border-card-border rounded-lg py-12 text-center">
              <p className="text-muted">No instructors yet.</p>
            </div>
          )}

          {/* Instructor rows */}
          {instructors.map((inst) => (
            editingId === inst.id ? (
              /* Inline edit row */
              <div
                key={inst.id}
                data-instructor-edit
                className="border-2 border-accent/40 rounded-lg p-3 sm:p-4 bg-card animate-in fade-in duration-200"
                onKeyDown={handleEditKeyDown}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full bg-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {inst.photo_url ? (
                      <Image src={inst.photo_url} alt="" width={44} height={44} className="object-cover rounded-full" unoptimized />
                    ) : (
                      <span className="text-accent text-sm font-medium">
                        {(editForm.name?.[0] || inst.name?.[0] || '?').toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Fields */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <Input
                      ref={editNameRef}
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Instructor name"
                      className="h-8 text-sm bg-background border-card-border"
                    />
                    {editShowBio ? (
                      <Input
                        value={editForm.bio}
                        onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                        placeholder="Short bio..."
                        className="h-8 text-sm bg-background border-card-border"
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setEditShowBio(!editShowBio)}
                      className="flex items-center gap-1 text-[11px] text-muted hover:text-accent transition-colors"
                    >
                      {editShowBio ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {editShowBio ? 'Hide bio' : 'More'}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={handleSaveEdit}
                      disabled={submitting || !editForm.name.trim()}
                      className={cn(
                        'w-8 h-8 rounded-md flex items-center justify-center transition-colors',
                        submitting || !editForm.name.trim()
                          ? 'text-muted cursor-not-allowed'
                          : 'text-green-400 hover:bg-green-400/10'
                      )}
                      title="Save (Enter)"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      title="Cancel (Esc)"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-muted mt-2 ml-14">Enter to save · Esc to cancel</p>
              </div>
            ) : (
              /* Normal display row */
              <button
                key={inst.id}
                onClick={() => startEdit(inst)}
                className={cn(
                  'w-full text-left border border-card-border rounded-lg p-3 sm:p-4 transition-colors hover:bg-white/[0.03]',
                  !inst.active && 'opacity-50'
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Photo */}
                  <div className="w-11 h-11 rounded-full bg-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {inst.photo_url ? (
                      <Image src={inst.photo_url} alt="" width={44} height={44} className="object-cover rounded-full" unoptimized />
                    ) : (
                      <span className="text-accent text-sm font-medium">
                        {inst.name?.[0]?.toUpperCase() || '?'}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{inst.name}</p>
                      {!inst.active && (
                        <span className="text-[10px] font-medium text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded shrink-0">
                          Inactive
                        </span>
                      )}
                    </div>
                    {inst.bio && <p className="text-xs text-muted truncate mt-0.5">{inst.bio}</p>}
                  </div>

                  {/* Toggle */}
                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={inst.active}
                      onCheckedChange={() => handleToggleActive({ stopPropagation: () => {} }, inst)}
                    />
                  </div>
                </div>
              </button>
            )
          ))}

          {/* Inline create row */}
          {showCreate ? (
            <div
              data-instructor-create
              className="border-2 border-dashed border-accent/40 rounded-lg p-3 sm:p-4 bg-card animate-in slide-in-from-bottom-2 fade-in duration-300"
              onKeyDown={handleCreateKeyDown}
            >
              <div className="flex items-center gap-3">
                {/* Placeholder avatar */}
                <div className="w-11 h-11 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-accent/50" />
                </div>

                {/* Fields */}
                <div className="flex-1 min-w-0 space-y-2">
                  <Input
                    ref={createNameRef}
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Instructor name"
                    className="h-8 text-sm bg-background border-card-border"
                  />
                  {createShowBio ? (
                    <Input
                      value={createForm.bio}
                      onChange={(e) => setCreateForm((f) => ({ ...f, bio: e.target.value }))}
                      placeholder="Short bio..."
                      className="h-8 text-sm bg-background border-card-border"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setCreateShowBio(!createShowBio)}
                    className="flex items-center gap-1 text-[11px] text-muted hover:text-accent transition-colors"
                  >
                    {createShowBio ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {createShowBio ? 'Hide bio' : 'More'}
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={handleSaveCreate}
                    disabled={submitting || !createForm.name.trim()}
                    className={cn(
                      'w-8 h-8 rounded-md flex items-center justify-center transition-colors',
                      submitting || !createForm.name.trim()
                        ? 'text-muted cursor-not-allowed'
                        : 'text-green-400 hover:bg-green-400/10'
                    )}
                    title="Save (Enter)"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelCreate}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="Cancel (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-muted mt-2 ml-14">Enter to save · Esc to cancel</p>
            </div>
          ) : (
            /* Add instructor button */
            <button
              onClick={startCreate}
              className="w-full border-2 border-dashed border-card-border rounded-lg p-4 text-muted hover:text-accent hover:border-accent/30 transition-all duration-200 flex items-center justify-center gap-2 group"
            >
              <span className="text-lg leading-none group-hover:text-accent transition-colors">+</span>
              <span className="text-sm">Add instructor</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
