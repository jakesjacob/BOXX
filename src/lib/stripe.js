import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'

// Cache Stripe instances per tenant
const _stripeCache = new Map()

// Sync Stripe instance (env var only — for webhook signature verification)
let _stripe = null

/**
 * Get Stripe secret key — checks studio_settings first, falls back to env var
 */
async function getStripeSecretKey(tenantId = DEFAULT_TENANT_ID) {
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from('studio_settings')
      .select('value')
      .eq('tenant_id', tenantId)
      .eq('key', 'stripe_secret_key')
      .single()

    if (data?.value) return data.value
  }

  return process.env.STRIPE_SECRET_KEY || null
}

/**
 * Get Stripe webhook secret — checks studio_settings first, falls back to env var
 */
export async function getWebhookSecret(tenantId = DEFAULT_TENANT_ID) {
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from('studio_settings')
      .select('value')
      .eq('tenant_id', tenantId)
      .eq('key', 'stripe_webhook_secret')
      .single()

    if (data?.value) return data.value
  }

  return process.env.STRIPE_WEBHOOK_SECRET || null
}

/**
 * Get a Stripe instance (async — checks DB settings first)
 */
export async function getStripeAsync(tenantId = DEFAULT_TENANT_ID) {
  const key = await getStripeSecretKey(tenantId)
  if (!key) return null

  // Reuse cached instance if same key
  const cached = _stripeCache.get(key)
  if (cached) return cached

  const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' })
  _stripeCache.set(key, stripe)
  return stripe
}

/**
 * Sync getter — uses env var only (for webhook signature verification)
 */
export function getStripe() {
  if (!_stripe && process.env.STRIPE_SECRET_KEY) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
    })
  }
  return _stripe
}

/**
 * Check if Stripe is configured (has a secret key in DB or env)
 */
export async function isStripeConfigured(tenantId = DEFAULT_TENANT_ID) {
  const key = await getStripeSecretKey(tenantId)
  return !!key
}
