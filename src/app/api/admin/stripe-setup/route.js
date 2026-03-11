import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'

const setupSchema = z.object({
  secretKey: z.string().min(1, 'Secret key is required'),
})

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

/**
 * POST /api/admin/stripe-setup — Save Stripe secret key and auto-register webhook
 *
 * 1. Validates the key by calling Stripe API
 * 2. Creates/updates a webhook endpoint pointing to /api/stripe/webhook
 * 3. Stores secret key + webhook signing secret in studio_settings
 */
export async function POST(request) {
  try {
    const session = await auth()
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'owner')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const body = await request.json()
    const parsed = setupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { secretKey } = parsed.data

    // Validate the key by making a test API call
    let stripe
    try {
      stripe = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' })
      await stripe.balance.retrieve()
    } catch (err) {
      console.error('[stripe-setup] Invalid key:', err.message)
      return NextResponse.json({ error: 'Invalid Stripe key. Please check and try again.' }, { status: 400 })
    }

    // Build the webhook URL
    const webhookUrl = `${APP_URL}/api/stripe/webhook`

    // Check if we already have a webhook for this URL
    let webhookSecret = null
    try {
      const existing = await stripe.webhookEndpoints.list({ limit: 100 })
      const match = existing.data.find((wh) => wh.url === webhookUrl && wh.status !== 'disabled')

      if (match) {
        // Webhook already exists — delete and recreate to get a fresh secret
        await stripe.webhookEndpoints.del(match.id)
      }

      // Create webhook endpoint
      const webhook = await stripe.webhookEndpoints.create({
        url: webhookUrl,
        enabled_events: [
          'checkout.session.completed',
          'invoice.payment_succeeded',
          'invoice.payment_failed',
          'customer.subscription.deleted',
        ],
      })

      webhookSecret = webhook.secret
    } catch (err) {
      console.error('[stripe-setup] Webhook creation failed:', err.message)
      // Still save the key even if webhook fails — they can set it up manually
    }

    // Save to studio_settings
    const settings = [
      { key: 'stripe_secret_key', value: secretKey },
    ]
    if (webhookSecret) {
      settings.push({ key: 'stripe_webhook_secret', value: webhookSecret })
    }

    const { error: dbError } = await supabaseAdmin
      .from('studio_settings')
      .upsert(settings)

    if (dbError) {
      console.error('[stripe-setup] DB error:', dbError)
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      webhookConfigured: !!webhookSecret,
      webhookUrl,
    })
  } catch (error) {
    console.error('[stripe-setup] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
