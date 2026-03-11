import { getStripeAsync, getWebhookSecret } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendPackPurchaseConfirmation } from '@/lib/email'
import { NextResponse } from 'next/server'

/**
 * POST /api/stripe/webhook — Handle Stripe webhook events
 * Verifies signature, processes payment events, allocates credits
 */
export async function POST(request) {
  try {
    const body = await request.text()
    const sig = request.headers.get('stripe-signature')

    if (!sig) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    // Verify webhook signature
    const stripe = await getStripeAsync()
    const webhookSecret = await getWebhookSecret()
    if (!stripe || !webhookSecret) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    }

    let event
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } catch (err) {
      console.error('[stripe/webhook] Signature verification failed:', err.message)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      console.error('[stripe/webhook] Database unavailable')
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutCompleted(event.data.object)
        break
      }
      case 'invoice.payment_succeeded': {
        await handleInvoiceSucceeded(event.data.object)
        break
      }
      case 'invoice.payment_failed': {
        await handleInvoiceFailed(event.data.object)
        break
      }
      case 'customer.subscription.deleted': {
        await handleSubscriptionDeleted(event.data.object)
        break
      }
      default:
        console.log(`[stripe/webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[stripe/webhook] Error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

/**
 * Handle successful checkout — allocate credits to user
 */
async function handleCheckoutCompleted(session) {
  const { userId, packId } = session.metadata || {}
  if (!userId || !packId) {
    console.error('[stripe/webhook] Missing metadata in checkout session')
    return
  }

  const paymentId = session.payment_intent || session.subscription || session.id

  // Idempotency: check if credits already allocated for this payment
  const { data: existing } = await supabaseAdmin
    .from('user_credits')
    .select('id')
    .eq('stripe_payment_id', paymentId)
    .limit(1)

  if (existing && existing.length > 0) {
    console.log('[stripe/webhook] Credits already allocated for payment:', paymentId)
    return
  }

  // Get pack details
  const { data: pack } = await supabaseAdmin
    .from('class_packs')
    .select('*')
    .eq('id', packId)
    .single()

  if (!pack) {
    console.error('[stripe/webhook] Pack not found:', packId)
    return
  }

  // Calculate expiry date
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + pack.validity_days)

  // Insert user credits (unique constraint on stripe_payment_id prevents duplicates)
  const { error } = await supabaseAdmin.from('user_credits').insert({
    user_id: userId,
    class_pack_id: packId,
    credits_total: pack.credits, // null for unlimited
    credits_remaining: pack.credits, // null for unlimited
    expires_at: expiresAt.toISOString(),
    stripe_payment_id: paymentId,
    stripe_sub_id: session.subscription || null,
    status: 'active',
  })

  if (error) {
    // Unique constraint violation = already processed (safe to ignore)
    if (error.code === '23505') {
      console.log('[stripe/webhook] Duplicate webhook, already processed:', paymentId)
      return
    }
    console.error('[stripe/webhook] Failed to allocate credits:', error)
    return
  }

  console.log(`[stripe/webhook] Credits allocated: user=${userId}, pack=${pack.name}`)

  // Send pack purchase confirmation email (non-blocking)
  const { data: purchaseUser } = await supabaseAdmin
    .from('users')
    .select('email, name')
    .eq('id', userId)
    .single()

  if (purchaseUser?.email) {
    sendPackPurchaseConfirmation({
      to: purchaseUser.email,
      name: purchaseUser.name,
      packName: pack.name,
      credits: pack.credits || 'Unlimited',
      validityDays: pack.validity_days,
      expiresAt: expiresAt.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      }),
    }).catch((err) => console.error('[stripe/webhook] Purchase email failed:', err))
  }
}

/**
 * Handle subscription renewal — extend expiry on unlimited pack
 */
async function handleInvoiceSucceeded(invoice) {
  // Skip the first invoice (handled by checkout.session.completed)
  if (invoice.billing_reason === 'subscription_create') return

  const subscriptionId = invoice.subscription
  if (!subscriptionId) return

  // Find the user's credit record for this subscription
  const { data: credit } = await supabaseAdmin
    .from('user_credits')
    .select('*, class_packs(*)')
    .eq('stripe_sub_id', subscriptionId)
    .eq('status', 'active')
    .single()

  if (!credit) {
    console.error('[stripe/webhook] No active credit for subscription:', subscriptionId)
    return
  }

  // Extend expiry date
  const newExpiry = new Date()
  newExpiry.setDate(newExpiry.getDate() + (credit.class_packs?.validity_days || 30))

  await supabaseAdmin
    .from('user_credits')
    .update({ expires_at: newExpiry.toISOString() })
    .eq('id', credit.id)

  console.log(`[stripe/webhook] Subscription renewed: credit=${credit.id}`)
}

/**
 * Handle failed subscription payment
 */
async function handleInvoiceFailed(invoice) {
  const subscriptionId = invoice.subscription
  if (!subscriptionId) return

  // Find the user for this subscription
  const { data: credit } = await supabaseAdmin
    .from('user_credits')
    .select('user_id, users(email, name)')
    .eq('stripe_sub_id', subscriptionId)
    .single()

  if (credit) {
    console.log(`[stripe/webhook] Payment failed for user: ${credit.user_id}`)
    // TODO: Phase 6 — Send "update payment method" email via Resend
  }
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionDeleted(subscription) {
  const { error } = await supabaseAdmin
    .from('user_credits')
    .update({ status: 'cancelled' })
    .eq('stripe_sub_id', subscription.id)

  if (error) {
    console.error('[stripe/webhook] Failed to cancel credit:', error)
    return
  }

  console.log(`[stripe/webhook] Subscription cancelled: ${subscription.id}`)
  // TODO: Phase 6 — Send "membership ended" email via Resend
}
