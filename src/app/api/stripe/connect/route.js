import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * GET /api/stripe/connect — Redirect admin to Stripe Connect OAuth
 */
export async function GET(request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.STRIPE_CLIENT_ID || '',
      scope: 'read_write',
      redirect_uri: `${APP_URL}/api/stripe/connect/callback`,
      state: session.user.id,
    })

    return NextResponse.redirect(`https://connect.stripe.com/oauth/authorize?${params}`)
  } catch (error) {
    console.error('[stripe/connect] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

/**
 * DELETE /api/stripe/connect — Disconnect Stripe account
 */
export async function DELETE(request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // Clear Stripe settings
    await supabaseAdmin
      .from('studio_settings')
      .upsert([
        { key: 'stripe_account_id', value: '' },
        { key: 'stripe_access_token', value: '' },
      ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[stripe/connect] Disconnect error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
