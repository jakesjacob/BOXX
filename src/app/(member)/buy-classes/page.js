'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
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
  const router = useRouter()
  const [packs, setPacks] = useState([])
  const [activeCredits, setActiveCredits] = useState([])
  const [purchaseHistory, setPurchaseHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(null)
  const [success, setSuccess] = useState(false)
  const [toast, setToast] = useState(null)
  const [confirmPack, setConfirmPack] = useState(null)

  useEffect(() => {
    if (searchParams.get('success') === 'true') setSuccess(true)
  }, [searchParams])

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/packs')
        if (res.ok) {
          const data = await res.json()
          setPacks(data.packs || [])
          setActiveCredits(data.activeCredits || [])
          setPurchaseHistory(data.purchaseHistory || [])
        }
      } catch (err) {
        console.error('Failed to fetch packs:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [success])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  async function handleBuy(packId) {
    setConfirmPack(null)
    setPurchasing(packId)
    try {
      const res = await fetch('/api/packs/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ message: data.error || 'Something went wrong', type: 'error' })
        return
      }
      router.push('/dashboard?purchased=true')
    } catch (err) {
      setToast({ message: 'Something went wrong. Please try again.', type: 'error' })
    } finally {
      setPurchasing(null)
    }
  }

  const hasActiveCredits = activeCredits.length > 0
  const totalCreditsRemaining = activeCredits.reduce((sum, c) => {
    if (c.credits_remaining === null) return Infinity
    return sum + (c.credits_remaining || 0)
  }, 0)

  // Find highest-credit pack for savings calculation (anchor price)
  const maxPricePerClass = packs.reduce((max, p) => {
    if (!p.credits || !p.price_thb) return max
    const ppc = p.price_thb / p.credits
    return ppc > max ? ppc : max
  }, 0)

  return (
    <div className="max-w-4xl mx-auto">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={cn(
              'fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 px-4 py-3 rounded-lg border flex items-center justify-between gap-3 shadow-lg backdrop-blur-sm sm:max-w-sm',
              toast.type === 'error'
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : 'bg-green-500/10 border-green-500/20 text-green-400'
            )}
          >
            <span className="text-sm">{toast.message}</span>
            <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">Choose Your Pack</h1>
        <p className="text-muted mt-3 max-w-md mx-auto">
          Invest in yourself. Every pack gives you access to world-class boxing and PT sessions with UK-qualified coaches.
        </p>
      </div>

      {/* Success message */}
      {success && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8 p-5 bg-green-600/10 border border-green-600/20 rounded-xl text-center"
        >
          <p className="text-green-400 font-semibold text-lg">Payment Successful!</p>
          <p className="text-green-400/70 text-sm mt-1">Your credits are ready. Book your next class now.</p>
          <Button className="mt-4" onClick={() => router.push('/dashboard')}>
            Go to Schedule
          </Button>
        </motion.div>
      )}

      {/* Active credits banner */}
      {hasActiveCredits && !success && (
        <div className="mb-8 p-4 bg-accent/5 border border-accent/20 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
            <span className="text-accent font-bold text-sm">
              {totalCreditsRemaining === Infinity ? '∞' : totalCreditsRemaining}
            </span>
          </div>
          <div>
            <p className="text-sm text-foreground font-medium">
              {totalCreditsRemaining === Infinity ? 'Unlimited' : totalCreditsRemaining} credit{totalCreditsRemaining !== 1 ? 's' : ''} remaining
            </p>
            <p className="text-xs text-muted">You can purchase additional packs anytime</p>
          </div>
        </div>
      )}

      {/* Pack cards */}
      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-80 bg-card border border-card-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 items-start">
          {packs.map((pack, idx) => {
            const isIntro = pack.is_intro
            const isMembership = pack.is_membership
            const canBuyIntro = isIntro && !hasActiveCredits
            const isMostPopular = pack.badge_text?.toLowerCase().includes('popular') || (!isIntro && !isMembership && idx === 1)
            const isBestValue = pack.badge_text?.toLowerCase().includes('value') || (!isIntro && !isMembership && packs.length > 2 && idx === packs.length - 1)

            // Hide intro pack if user already has credits
            if (isIntro && hasActiveCredits) return null

            const pricePerClass = pack.credits ? Math.round(pack.price_thb / pack.credits) : null
            const savingsPercent = pack.credits && maxPricePerClass > 0
              ? Math.round((1 - (pack.price_thb / pack.credits) / maxPricePerClass) * 100)
              : 0

            const badgeText = pack.badge_text || (isMostPopular ? 'Most Popular' : isBestValue ? 'Best Value' : null)

            return (
              <motion.div
                key={pack.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card
                  className={cn(
                    'relative flex flex-col overflow-hidden transition-all hover:translate-y-[-2px]',
                    isMostPopular
                      ? 'ring-2 ring-accent shadow-lg shadow-accent/10'
                      : 'hover:border-accent/30'
                  )}
                >
                  {/* Badge */}
                  {badgeText && (
                    <div className={cn(
                      'text-center py-1.5 text-xs font-bold uppercase tracking-wider',
                      isMostPopular
                        ? 'bg-accent text-background'
                        : 'bg-accent/10 text-accent'
                    )}>
                      {badgeText}
                    </div>
                  )}

                  <div className="p-6 flex-1 flex flex-col">
                    {/* Pack name */}
                    <h3 className="text-lg font-bold text-foreground">{pack.name}</h3>
                    {pack.description && (
                      <p className="text-sm text-muted mt-1">{pack.description}</p>
                    )}

                    {/* Price */}
                    <div className="mt-5 mb-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold text-foreground">
                          ฿{pack.price_thb.toLocaleString()}
                        </span>
                        {isMembership && <span className="text-sm text-muted">/month</span>}
                      </div>

                      {/* Per-class price */}
                      {pricePerClass && (
                        <p className="text-sm text-muted mt-1">
                          ฿{pricePerClass.toLocaleString()} per class
                          {savingsPercent > 0 && (
                            <span className="ml-2 text-green-400 font-medium">Save {savingsPercent}%</span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="mt-5 space-y-2.5 flex-1">
                      <li className="flex items-center gap-2.5 text-sm text-foreground/80">
                        <svg className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {pack.credits === null ? 'Unlimited classes' : `${pack.credits} class${pack.credits !== 1 ? 'es' : ''}`}
                      </li>
                      <li className="flex items-center gap-2.5 text-sm text-foreground/80">
                        <svg className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Valid for {pack.validity_days} days
                      </li>
                      <li className="flex items-center gap-2.5 text-sm text-foreground/80">
                        <svg className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        All class types included
                      </li>
                      {isMembership && (
                        <li className="flex items-center gap-2.5 text-sm text-foreground/80">
                          <svg className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Auto-renews monthly
                        </li>
                      )}
                      <li className="flex items-center gap-2.5 text-sm text-foreground/80">
                        <svg className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Small groups, max 6
                      </li>
                    </ul>

                    {/* CTA */}
                    <Button
                      className={cn(
                        'w-full mt-6',
                        isMostPopular && 'bg-accent text-background hover:bg-accent-dim'
                      )}
                      variant={isMostPopular ? 'default' : 'outline'}
                      size="lg"
                      onClick={() => setConfirmPack(pack)}
                      disabled={purchasing === pack.id || (isIntro && !canBuyIntro)}
                    >
                      {purchasing === pack.id
                        ? 'Processing...'
                        : isMembership
                          ? 'Subscribe Now'
                          : 'Get Started'}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Social proof */}
      <div className="mt-12 text-center">
        <p className="text-muted text-sm">
          Join the BOXX community &middot; UK-qualified coaches &middot; Chiang Mai&apos;s first luxury boxing studio
        </p>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmPack} onOpenChange={(open) => !open && setConfirmPack(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>Review your selection before purchasing</DialogDescription>
          </DialogHeader>

          {confirmPack && (
            <div className="py-4 space-y-4">
              <div className="p-4 bg-card border border-card-border rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{confirmPack.name}</span>
                  <span className="text-2xl font-bold text-foreground">฿{confirmPack.price_thb.toLocaleString()}</span>
                </div>
                <div className="text-sm text-muted mt-2 space-y-1">
                  <p>
                    {confirmPack.credits === null
                      ? 'Unlimited classes'
                      : `${confirmPack.credits} class credit${confirmPack.credits !== 1 ? 's' : ''}`}
                  </p>
                  <p>Valid for {confirmPack.validity_days} days from purchase</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmPack(null)}>Cancel</Button>
            <Button
              onClick={() => confirmPack && handleBuy(confirmPack.id)}
              disabled={purchasing === confirmPack?.id}
            >
              {purchasing === confirmPack?.id ? 'Processing...' : 'Confirm Purchase'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase History */}
      {!loading && purchaseHistory.length > 0 && (
        <div className="mt-16">
          <h2 className="text-lg font-bold text-foreground mb-4">Purchase History</h2>
          <div className="border border-card-border rounded-xl overflow-hidden">
            {purchaseHistory.map((purchase, idx) => {
              const isExpired = new Date(purchase.expires_at) < new Date()
              const isActive = purchase.status === 'active' && !isExpired
              const isFullyUsed = !isActive && purchase.credits_remaining === 0
              const isUnlimited = purchase.credits_total === null
              const purchaseDate = new Date(purchase.purchased_at || purchase.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Bangkok',
              })
              const expiryDate = new Date(purchase.expires_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Bangkok',
              })

              return (
                <div
                  key={purchase.id}
                  className={cn(
                    'flex items-center justify-between gap-4 px-4 py-3',
                    idx !== purchaseHistory.length - 1 && 'border-b border-card-border'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {purchase.class_packs?.name || 'Unknown Pack'}
                      </p>
                      {isActive ? (
                        <span className="shrink-0 text-[10px] font-medium text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">Active</span>
                      ) : isExpired ? (
                        <span className="shrink-0 text-[10px] font-medium text-muted bg-card px-1.5 py-0.5 rounded">Expired</span>
                      ) : isFullyUsed ? (
                        <span className="shrink-0 text-[10px] font-medium text-muted bg-card px-1.5 py-0.5 rounded">Used</span>
                      ) : (
                        <span className="shrink-0 text-[10px] font-medium text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">Inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-0.5">{purchaseDate} &middot; Expires {expiryDate}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-foreground">
                      {purchase.class_packs?.price_thb ? `฿${purchase.class_packs.price_thb.toLocaleString()}` : '—'}
                    </p>
                    <p className="text-xs text-muted">
                      {isUnlimited ? 'Unlimited' : `${purchase.credits_remaining}/${purchase.credits_total} left`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
