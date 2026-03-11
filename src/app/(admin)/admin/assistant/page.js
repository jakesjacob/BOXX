'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { renderMarkdown } from '@/lib/agent/markdown'

const DEFAULT_SUGGESTIONS = [
  "What's on the schedule this week?",
  "How's the studio doing this month?",
  "Show me today's classes",
  "Search for a member",
]

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

export default function AssistantPage() {
  const [conversations, setConversations] = useState([])
  const [activeConvoId, setActiveConvoId] = useState(null)
  const [messages, setMessages] = useState([])
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(null)
  const [convoLoading, setConvoLoading] = useState(true)
  const [vpOffset, setVpOffset] = useState(0)
  const [vpHeight, setVpHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 800)
  const [usage, setUsage] = useState(null) // { cost_usd, limit_usd, limited }
  const [usageLimited, setUsageLimited] = useState(false)

  const messagesEndRef = useRef(null)
  const messagesRef = useRef(null)
  const inputRef = useRef(null)

  // Lock page scroll + track keyboard via visualViewport
  useEffect(() => {
    const html = document.documentElement
    const body = document.body

    // Prevent document-level scroll
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.width = '100%'
    body.style.top = '0'
    body.style.overscrollBehavior = 'none'
    html.style.overscrollBehavior = 'none'

    // Prevent touchmove on everything except the messages scroll area
    const preventTouch = (e) => {
      const messagesEl = messagesRef.current
      if (messagesEl && messagesEl.contains(e.target)) return // allow scrolling in messages
      e.preventDefault()
    }
    document.addEventListener('touchmove', preventTouch, { passive: false })

    const vv = window.visualViewport
    if (vv) {
      const update = () => {
        // Use visualViewport dimensions directly — much more reliable
        // than trying to calculate keyboard height from innerHeight
        setVpHeight(vv.height)
        setVpOffset(vv.offsetTop)

        // Try to prevent iOS from accumulating scroll offset
        if (vv.offsetTop > 0) {
          window.scrollTo(0, 0)
        }

        // Shift the admin header to compensate for iOS viewport scroll
        const header = document.querySelector('header[class*="fixed"]')
        if (header) {
          header.style.transform = `translateY(${vv.offsetTop}px)`
        }
      }

      vv.addEventListener('resize', update)
      vv.addEventListener('scroll', update)
      update()

      return () => {
        vv.removeEventListener('resize', update)
        vv.removeEventListener('scroll', update)
        document.removeEventListener('touchmove', preventTouch)
        html.style.overflow = ''
        html.style.overscrollBehavior = ''
        body.style.overflow = ''
        body.style.position = ''
        body.style.width = ''
        body.style.top = ''
        body.style.overscrollBehavior = ''
        // Reset header
        const header = document.querySelector('header[class*="fixed"]')
        if (header) header.style.transform = ''
      }
    }

    return () => {
      document.removeEventListener('touchmove', preventTouch)
      html.style.overflow = ''
      html.style.overscrollBehavior = ''
      body.style.overflow = ''
      body.style.position = ''
      body.style.width = ''
      body.style.top = ''
      body.style.overscrollBehavior = ''
    }
  }, [])

  // Scroll to bottom when messages change or viewport resizes (keyboard)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, vpHeight])

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus()
  }, [activeConvoId])

  // Check for ?test-limit param to simulate usage limit
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('test-limit') === 'true') {
      setUsageLimited(true)
      setUsage({ cost_usd: 2.00, limit_usd: 2.00, limited: true })
    }
  }, [])

  // Load conversations + suggestions on mount
  useEffect(() => {
    fetchConversations()
  }, [])

  async function fetchConversations() {
    try {
      const res = await fetch('/api/admin/agent/conversations')
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
        if (data.suggestions?.length) setSuggestions(data.suggestions)
        if (data.usage) {
          setUsage(data.usage)
          if (data.usage.limited) setUsageLimited(true)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setConvoLoading(false)
    }
  }

  async function loadConversation(id) {
    setActiveConvoId(id)
    setMessages([])
    setError(null)
    setSidebarOpen(false)

    try {
      const res = await fetch(`/api/admin/agent/conversations/${id}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  function startNewChat() {
    setActiveConvoId(null)
    setMessages([])
    setError(null)
    setSidebarOpen(false)
    inputRef.current?.focus()
  }

  async function handleDelete() {
    if (!deleteDialog) return
    try {
      await fetch(`/api/admin/agent/conversations/${deleteDialog}`, { method: 'DELETE' })
      setConversations((prev) => prev.filter((c) => c.id !== deleteDialog))
      if (activeConvoId === deleteDialog) startNewChat()
    } catch (err) {
      console.error(err)
    } finally {
      setDeleteDialog(null)
    }
  }

  async function handleSend(text) {
    const msg = text || input.trim()
    if (!msg || loading || usageLimited) return

    setInput('')
    setError(null)

    const userMessage = { role: 'user', content: msg }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setLoading(true)

    try {
      const apiMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch('/api/admin/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          conversationId: activeConvoId,
          newConversation: !activeConvoId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Check for usage limit error
        if (data.error === 'usage_limit') {
          setUsageLimited(true)
          setUsage((prev) => prev ? { ...prev, limited: true } : { cost_usd: 2.00, limit_usd: 2.00, limited: true })
          // Remove the optimistic user message
          setMessages(messages)
          return
        }
        setError(data.error || 'Something went wrong')
        return
      }

      // Update usage from response
      if (data.usage) {
        setUsage(data.usage)
        if (data.usage.limited) setUsageLimited(true)
      }

      // If this created a new conversation, update state
      if (data.conversationId && !activeConvoId) {
        setActiveConvoId(data.conversationId)
        setConversations((prev) => [{
          id: data.conversationId,
          title: msg.length <= 40 ? msg : msg.slice(0, 40).replace(/\s\S*$/, '') + '...',
          updated_at: new Date().toISOString(),
        }, ...prev])
      } else if (data.conversationId) {
        setConversations((prev) => {
          const updated = prev.map((c) =>
            c.id === data.conversationId ? { ...c, updated_at: new Date().toISOString() } : c
          )
          updated.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
          return updated
        })
      }

      const assistantMessage = {
        role: 'assistant',
        content: data.response,
        tool_results: data.toolResults,
      }

      setMessages([...updatedMessages, assistantMessage])
    } catch {
      setError('Failed to reach the assistant. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const usagePercent = usage ? Math.min(100, (usage.cost_usd / usage.limit_usd) * 100) : 0

  return (
    <>
      <div
        className={cn(
          'fixed left-0 right-0 flex flex-col bg-background z-20',
          'lg:static lg:z-auto lg:flex-row lg:h-[calc(100vh-4rem)] lg:-m-6 lg:overflow-hidden'
        )}
        style={{ top: `${64 + vpOffset}px`, height: `${vpHeight - 64}px` }}
      >
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={cn(
          'fixed top-0 left-0 bottom-0 z-50 w-72 bg-card border-r border-card-border flex flex-col transition-transform duration-200',
          'lg:static lg:translate-x-0 lg:z-auto lg:shrink-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}>
          <div className="p-3 border-b border-card-border">
            <Button onClick={startNewChat} className="w-full justify-start gap-2 text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Chat
            </Button>
          </div>

          <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
            {convoLoading ? (
              <div className="space-y-2 px-2 pt-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-9 bg-white/5 rounded animate-pulse" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-xs text-muted text-center pt-6 px-4">No conversations yet</p>
            ) : (
              conversations.map((convo) => (
                <div key={convo.id} className="group relative">
                  <button
                    onClick={() => loadConversation(convo.id)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-md text-sm transition-colors truncate pr-8',
                      activeConvoId === convo.id
                        ? 'bg-accent/10 text-accent'
                        : 'text-muted hover:text-foreground hover:bg-white/5'
                    )}
                    title={convo.title}
                  >
                    <span className="block truncate text-[13px]">{convo.title}</span>
                    <span className="block text-[10px] text-muted/60 mt-0.5">{timeAgo(convo.updated_at)}</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteDialog(convo.id) }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded text-muted/40 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete conversation"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </nav>

          <div className="p-3 border-t border-card-border">
            <p className="text-[10px] text-muted text-center">
              Conversations auto-delete after 7 days
            </p>
          </div>
        </aside>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Chat header */}
          <div className="h-12 border-b border-card-border flex items-center justify-between px-4 shrink-0 bg-background">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden w-8 h-8 flex items-center justify-center rounded hover:bg-white/5"
              >
                <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">Studio Assistant</span>
                <span className="text-[10px] text-muted bg-white/5 px-1.5 py-0.5 rounded">AI</span>
              </div>
            </div>

            {/* Usage indicator */}
            {usage && (
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      usagePercent >= 90 ? 'bg-red-400' : usagePercent >= 70 ? 'bg-amber-400' : 'bg-accent'
                    )}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted whitespace-nowrap">
                  {Math.round(usagePercent)}% used
                </span>
              </div>
            )}
          </div>

          {/* Usage limit screen */}
          {/* TODO: Add upgrade plan email/link once email is set up */}
          {usageLimited ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="w-16 h-16 rounded-full bg-amber-400/10 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Monthly limit reached</h2>
              <p className="text-sm text-muted max-w-sm mb-4">
                You've used your AI assistant allowance for this month.
              </p>
              <p className="text-sm text-muted max-w-sm">
                Your allowance resets on the 1st of each month. To increase your limit, please contact the developer.
              </p>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0 overscroll-contain">
                {messages.length === 0 && !loading && (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4">
                    <div className="text-4xl mb-4">🥊</div>
                    <h2 className="text-lg font-semibold text-foreground mb-2">How can I help?</h2>
                    <p className="text-sm text-muted max-w-md mb-6">
                      I can manage your schedule, look up members, check stats, send emails, and more. Just ask.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 w-full max-w-lg">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleSend(s)}
                          className="text-left text-sm px-4 py-3 rounded-lg border border-card-border bg-card hover:bg-white/[0.04] hover:border-accent/30 transition-colors text-muted"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[85%] sm:max-w-[75%] rounded-xl px-4 py-3',
                      msg.role === 'user'
                        ? 'bg-accent/15 text-foreground'
                        : 'bg-card border border-card-border text-foreground'
                    )}>
                      {msg.tool_results?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {msg.tool_results.map((tr, j) => (
                            <span
                              key={j}
                              className={cn(
                                'text-[10px] font-medium px-2 py-0.5 rounded-full',
                                tr.result?.success
                                  ? 'bg-green-500/10 text-green-400'
                                  : 'bg-red-500/10 text-red-400'
                              )}
                            >
                              {tr.tool.replace(/_/g, ' ')}
                              {tr.result?.success ? ' ✓' : ' ✗'}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-sm leading-relaxed">
                        {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                      </div>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-card border border-card-border rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-accent/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-accent/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-accent/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-xs text-muted">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex justify-start">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 max-w-[85%]">
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-card-border p-3 shrink-0 bg-background">
                <form onSubmit={(e) => { e.preventDefault(); handleSend() }} className="flex gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    enterKeyHint="send"
                    placeholder="Type a command..."
                    rows={1}
                    disabled={loading}
                    className="flex-1 resize-none rounded-lg bg-card border border-card-border px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/30 disabled:opacity-50"
                  />
                  <Button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="px-4 shrink-0"
                  >
                    {loading ? (
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
                      </svg>
                    )}
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              This will permanently delete this conversation and all its messages.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
