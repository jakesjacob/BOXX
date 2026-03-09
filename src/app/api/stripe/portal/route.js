import { auth } from '@/lib/auth'
import { getClientStripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * POST /api/stripe/portal — Create a Stripe Customer Portal session
 * Used by Monthly Unlimited members to manage/cancel their subscription
 */
export async function POST(request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // Get user's Stripe customer ID
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('stripe_customer_id')
      .eq('id', session.user.id)
      .single()

    if (!user?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No payment account found. Purchase a class pack first.' },
        { status: 400 }
      )
    }

    const clientStripe = await getClientStripe()
    if (!clientStripe) {
      return NextResponse.json(
        { error: 'Payments are not configured.' },
        { status: 400 }
      )
    }

    const portalSession = await clientStripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${APP_URL}/dashboard`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    console.error('[stripe/portal] Error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
