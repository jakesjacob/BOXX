import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Platform Stripe instance (your agency account — used only for Connect OAuth)
// Lazy-initialized to avoid build-time errors when env vars are missing
let _stripe = null
export function getStripe() {
  if (!_stripe && process.env.STRIPE_SECRET_KEY) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
    })
  }
  return _stripe
}


/**
 * Get the connected Stripe account details from studio_settings
 */
export async function getConnectedAccount() {
  if (!supabaseAdmin) return null

  const { data } = await supabaseAdmin
    .from('studio_settings')
    .select('key, value')
    .in('key', ['stripe_account_id', 'stripe_access_token'])

  if (!data || data.length === 0) return null

  const settings = Object.fromEntries(data.map((r) => [r.key, r.value]))

  if (!settings.stripe_account_id || !settings.stripe_access_token) return null

  return {
    accountId: settings.stripe_account_id,
    accessToken: settings.stripe_access_token,
  }
}

/**
 * Get a Stripe instance using the connected account's access token
 * All charges/checkouts use this — money goes directly to the client
 */
export async function getClientStripe() {
  const account = await getConnectedAccount()
  if (!account) return null

  return new Stripe(account.accessToken, {
    apiVersion: '2024-12-18.acacia',
  })
}

/**
 * Get a studio setting value
 */
export async function getStudioSetting(key) {
  if (!supabaseAdmin) return null

  const { data } = await supabaseAdmin
    .from('studio_settings')
    .select('value')
    .eq('key', key)
    .single()

  return data?.value || null
}

/**
 * Update a studio setting
 */
export async function setStudioSetting(key, value) {
  if (!supabaseAdmin) return false

  const { error } = await supabaseAdmin
    .from('studio_settings')
    .upsert({ key, value })

  return !error
}
