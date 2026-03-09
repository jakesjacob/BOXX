'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export default function BuyClassesPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-96 bg-card rounded-lg" />}>
      <BuyClassesContent />
    </Suspense>
  )
}

function BuyClassesContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [packs, setPacks] = useState([])
  const [activeCredits, setActiveCredits] = useState([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(null)
  const [success, setSuccess] = useState(false)

  // Check for success return from Stripe
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setSuccess(true)
    }
  }, [searchParams])

  // Fetch packs and user's active credits
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/packs')
        if (res.ok) {
          const data = await res.json()
          setPacks(data.packs || [])
          setActiveCredits(data.activeCredits || [])
        }
      } catch (err) {
        console.error('Failed to fetch packs:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [success])

  async function handleBuy(packId) {
    setPurchasing(packId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Something went wrong')
        return
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url
    } catch (err) {
      console.error('Checkout error:', err)
      alert('Something went wrong. Please try again.')
    } finally {
      setPurchasing(null)
    }
  }

  const hasActiveCredits = activeCredits.length > 0
  const totalCreditsRemaining = activeCredits.reduce((sum, c) => {
    if (c.credits_remaining === null) return Infinity
    return sum + (c.credits_remaining || 0)
  }, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Buy Packs</h1>
      <p className="text-muted mb-8">Choose a class pack to get started.</p>

      {/* Success message */}
      {success && (
        <div className="mb-8 p-4 bg-green-600/10 border border-green-600/20 rounded-lg">
          <p className="text-green-400 font-medium">Payment successful! Your credits have been added.</p>
          <p className="text-green-400/70 text-sm mt-1">You can now book classes from the schedule.</p>
        </div>
      )}

      {/* Active credits banner */}
      {hasActiveCredits && !success && (
        <div className="mb-8 p-4 bg-accent/5 border border-accent/20 rounded-lg">
          <p className="text-accent text-sm">
            You have{' '}
            <span className="font-bold">
              {totalCreditsRemaining === Infinity ? 'unlimited' : totalCreditsRemaining}
            </span>{' '}
            active credit{totalCreditsRemaining !== 1 ? 's' : ''}. You can still purchase additional packs.
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-card border border-card-border rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        /* Pack cards */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packs.map((pack) => {
            const isIntro = pack.is_intro
            const isMembership = pack.is_membership
            const canBuyIntro = isIntro && !hasActiveCredits

            // Hide intro pack if user already has credits
            if (isIntro && hasActiveCredits) return null

            return (
              <Card
                key={pack.id}
                className={cn(
                  'relative flex flex-col',
                  pack.badge_text && 'ring-1 ring-accent/30'
                )}
              >
                {pack.badge_text && (
                  <div className="absolute -top-3 left-4">
                    <Badge>{pack.badge_text}</Badge>
                  </div>
                )}

                <CardHeader className="flex-1">
                  <CardTitle className="text-base">{pack.name}</CardTitle>
                  <p className="text-sm text-muted mt-1">{pack.description}</p>

                  <div className="mt-4">
                    <span className="text-3xl font-bold text-foreground">
                      ฿{pack.price_thb.toLocaleString()}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-muted">
                    <p>
                      {pack.credits === null
                        ? 'Unlimited classes'
                        : `${pack.credits} class${pack.credits !== 1 ? 'es' : ''}`}
                    </p>
                    <p>Valid for {pack.validity_days} days</p>
                    {isMembership && <p>Auto-renews monthly</p>}
                  </div>
                </CardHeader>

                <CardContent>
                  <Button
                    className="w-full"
                    onClick={() => handleBuy(pack.id)}
                    disabled={purchasing === pack.id || (isIntro && !canBuyIntro)}
                  >
                    {purchasing === pack.id
                      ? 'Redirecting...'
                      : isMembership
                        ? 'Subscribe'
                        : 'Buy Now'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
