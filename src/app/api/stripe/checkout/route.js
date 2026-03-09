import { auth } from '@/lib/auth'
import { getClientStripe, getConnectedAccount } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const checkoutSchema = z.object({
  packId: z.string().uuid(),
})

/**
 * POST /api/stripe/checkout — Create a Stripe Checkout session for a class pack
 */
export async function POST(request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = checkoutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { packId } = parsed.data

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // Get the class pack
    const { data: pack, error: packError } = await supabaseAdmin
      .from('class_packs')
      .select('*')
      .eq('id', packId)
      .eq('active', true)
      .single()

    if (packError || !pack) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 })
    }

    // Intro pack enforcement — only for new customers
    if (pack.is_intro) {
      const { data: priorCredits } = await supabaseAdmin
        .from('user_credits')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1)

      if (priorCredits && priorCredits.length > 0) {
        return NextResponse.json(
          { error: 'This offer is for new customers only.' },
          { status: 400 }
        )
      }
    }

    // Check Stripe Price ID is configured
    if (!pack.stripe_price_id) {
      return NextResponse.json(
        { error: 'This pack is not yet available for purchase. Please contact the studio.' },
        { status: 400 }
      )
    }

    // Get connected Stripe account
    const clientStripe = await getClientStripe()
    if (!clientStripe) {
      return NextResponse.json(
        { error: 'Payments are not set up yet. Please contact the studio.' },
        { status: 400 }
      )
    }

    // Get or create Stripe customer for this user
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('stripe_customer_id, email, name')
      .eq('id', session.user.id)
      .single()

    let customerId = user?.stripe_customer_id

    if (!customerId) {
      const customer = await clientStripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: session.user.id },
      })
      customerId = customer.id

      await supabaseAdmin
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', session.user.id)
    }

    // Create Checkout Session
    const checkoutSession = await clientStripe.checkout.sessions.create({
      mode: pack.is_membership ? 'subscription' : 'payment',
      customer: customerId,
      line_items: [{ price: pack.stripe_price_id, quantity: 1 }],
      metadata: {
        userId: session.user.id,
        packId: pack.id,
      },
      success_url: `${APP_URL}/buy-classes?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/buy-classes`,
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error('[stripe/checkout] Error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
