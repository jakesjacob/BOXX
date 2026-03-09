'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-96 bg-card rounded-lg" />}>
      <SettingsContent />
    </Suspense>
  )
}

const TABS = [
  { id: 'payments', label: 'Payments', icon: '💳' },
  { id: 'studio', label: 'Studio', icon: '🏢' },
  { id: 'booking', label: 'Booking', icon: '📋' },
  { id: 'reminders', label: 'Reminders', icon: '🔔' },
]

function SettingsContent() {
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('tab') || 'payments'
  const connected = searchParams.get('connected')
  const error = searchParams.get('error')
  const [activeTab, setActiveTab] = useState(defaultTab)

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">Settings</h1>

      {/* Tab buttons — horizontal scroll on mobile */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0',
              activeTab === tab.id
                ? 'bg-accent/10 text-accent'
                : 'text-muted hover:text-foreground hover:bg-white/5'
            )}
          >
            <span className="text-base">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'payments' && <PaymentsTab connected={connected} error={error} />}
      {activeTab === 'studio' && <PlaceholderTab title="Studio Info" description="Studio name, address, contact details — coming soon." />}
      {activeTab === 'booking' && <PlaceholderTab title="Booking Rules" description="Cancellation window, capacity, advance booking — coming soon." />}
      {activeTab === 'reminders' && <PlaceholderTab title="Reminders" description="24h and 2h reminder toggles — coming soon." />}
    </div>
  )
}

function PlaceholderTab({ title, description }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}

function PaymentsTab({ connected, error }) {
  const [stripeStatus, setStripeStatus] = useState(null)
  const [packs, setPacks] = useState([])
  const [priceIds, setPriceIds] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [saveMessage, setSaveMessage] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [settingsRes, packsRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/packs'),
      ])

      if (settingsRes.ok) {
        const { settings } = await settingsRes.json()
        setStripeStatus({
          accountId: settings.stripe_account_id || '',
          isConnected: !!settings.stripe_account_id,
        })
      }

      if (packsRes.ok) {
        const { packs: packData } = await packsRes.json()
        setPacks(packData)
        const ids = {}
        packData.forEach((p) => {
          ids[p.id] = p.stripe_price_id || ''
        })
        setPriceIds(ids)
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect your Stripe account? Members will not be able to purchase class packs.')) {
      return
    }

    setDisconnecting(true)
    try {
      const res = await fetch('/api/stripe/connect', { method: 'DELETE' })
      if (res.ok) {
        setStripeStatus({ accountId: '', isConnected: false })
      }
    } catch (err) {
      console.error('Disconnect failed:', err)
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleSavePriceIds() {
    setSaving(true)
    setSaveMessage(null)

    try {
      const promises = Object.entries(priceIds).map(([packId, priceId]) =>
        fetch('/api/admin/packs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: packId, stripe_price_id: priceId }),
        })
      )

      await Promise.all(promises)
      setSaveMessage({ type: 'success', text: 'Price IDs saved successfully.' })
    } catch (err) {
      setSaveMessage({ type: 'error', text: 'Failed to save Price IDs.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-card-border rounded w-48" />
            <div className="h-12 bg-card-border rounded w-full sm:w-64" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Connection status messages */}
      {connected && (
        <div className="p-3 sm:p-4 bg-green-600/10 border border-green-600/20 rounded-lg">
          <p className="text-green-400 text-sm font-medium">Stripe account connected successfully!</p>
        </div>
      )}
      {error && (
        <div className="p-3 sm:p-4 bg-red-600/10 border border-red-600/20 rounded-lg">
          <p className="text-red-400 text-sm font-medium">
            {error === 'denied' && 'Stripe connection was cancelled.'}
            {error === 'invalid' && 'Invalid connection request.'}
            {error === 'failed' && 'Failed to connect Stripe account. Please try again.'}
            {error === 'no_code' && 'No authorization code received.'}
            {error === 'db' && 'Failed to save connection. Please try again.'}
          </p>
        </div>
      )}

      {/* Stripe Connection Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span>💳</span> Stripe Connection
          </CardTitle>
          <CardDescription>
            Connect your Stripe account to accept payments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stripeStatus?.isConnected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="success">Connected</Badge>
              </div>
              <p className="text-xs text-muted break-all">
                Account: {stripeStatus.accountId}
              </p>
              <p className="text-xs text-muted">
                Payments go directly to your Stripe account.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                  <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">
                    Stripe Dashboard ↗
                  </a>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Connect your Stripe account to start accepting payments.
              </p>
              <Button className="w-full sm:w-auto" asChild>
                <a href="/api/stripe/connect">Connect with Stripe</a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Price IDs Card — only show when connected */}
      {stripeStatus?.isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stripe Price IDs</CardTitle>
            <CardDescription>
              Create products in Stripe, then paste Price IDs here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {packs.map((pack) => (
              <div key={pack.id} className="space-y-1.5">
                <Label htmlFor={`price-${pack.id}`}>{pack.name}</Label>
                <Input
                  id={`price-${pack.id}`}
                  placeholder="price_xxxxxxxxxxxx"
                  value={priceIds[pack.id] || ''}
                  onChange={(e) =>
                    setPriceIds((prev) => ({ ...prev, [pack.id]: e.target.value }))
                  }
                />
              </div>
            ))}

            {saveMessage && (
              <p className={cn('text-sm', saveMessage.type === 'success' ? 'text-green-400' : 'text-red-400')}>
                {saveMessage.text}
              </p>
            )}

            <div className="space-y-2 pt-2">
              <Button onClick={handleSavePriceIds} disabled={saving} className="w-full sm:w-auto">
                {saving ? 'Saving...' : 'Save Price IDs'}
              </Button>
              <a
                href="https://docs.stripe.com/products-prices/how-products-and-prices-work#what-is-a-price"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-accent hover:underline"
              >
                How to find your Price IDs →
              </a>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
