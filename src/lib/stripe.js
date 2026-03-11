import Stripe from 'stripe'

// Stripe instance using the studio's own API key (direct integration)
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
