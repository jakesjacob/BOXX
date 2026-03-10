import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendPackPurchaseConfirmation } from '@/lib/email'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const purchaseSchema = z.object({
  packId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID'),
})

/**
 * POST /api/packs/purchase — Direct purchase (no Stripe)
 * Creates user_credits immediately. Temporary until Stripe is live.
 */
export async function POST(request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Direct purchase must be explicitly enabled — otherwise use Stripe checkout
    if (process.env.ENABLE_DIRECT_PURCHASE !== 'true') {
      return NextResponse.json({ error: 'Direct purchase is disabled. Please use the checkout flow.' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = purchaseSchema.safeParse(body)
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

    // Intro pack enforcement
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

    // Create credits
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + pack.validity_days)

    const { data: credit, error: creditError } = await supabaseAdmin
      .from('user_credits')
      .insert({
        user_id: session.user.id,
        class_pack_id: pack.id,
        credits_total: pack.credits,
        credits_remaining: pack.credits,
        expires_at: expiresAt.toISOString(),
        stripe_payment_id: `direct_${Date.now()}`,
        status: 'active',
      })
      .select()
      .single()

    if (creditError) {
      console.error('[packs/purchase] Error:', creditError)
      return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 })
    }

    // Send purchase confirmation email (non-blocking)
    const { data: purchaseUser } = await supabaseAdmin
      .from('users')
      .select('email, name')
      .eq('id', session.user.id)
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
      }).catch((err) => console.error('[packs/purchase] Email failed:', err))
    }

    return NextResponse.json({
      credit,
      message: `${pack.name} purchased! ${pack.credits || 'Unlimited'} credits added.`,
    })
  } catch (error) {
    console.error('[packs/purchase] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
