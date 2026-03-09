import { auth } from '@/lib/auth'
import { getStripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * GET /api/stripe/connect/callback — Handle Stripe Connect OAuth callback
 */
export async function GET(request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.redirect(`${APP_URL}/login`)
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // User denied access or error occurred
    if (error) {
      console.error('[stripe/connect/callback] OAuth error:', error)
      return NextResponse.redirect(`${APP_URL}/admin/settings?tab=payments&error=denied`)
    }

    // CSRF check — state must match admin user ID
    if (state !== session.user.id) {
      console.error('[stripe/connect/callback] State mismatch')
      return NextResponse.redirect(`${APP_URL}/admin/settings?tab=payments&error=invalid`)
    }

    if (!code) {
      return NextResponse.redirect(`${APP_URL}/admin/settings?tab=payments&error=no_code`)
    }

    // Exchange authorization code for access token
    const response = await getStripe().oauth.token({
      grant_type: 'authorization_code',
      code,
    })

    if (!supabaseAdmin) {
      return NextResponse.redirect(`${APP_URL}/admin/settings?tab=payments&error=db`)
    }

    // Save connected account details to studio_settings
    await supabaseAdmin
      .from('studio_settings')
      .upsert([
        { key: 'stripe_account_id', value: response.stripe_user_id },
        { key: 'stripe_access_token', value: response.access_token },
      ])

    return NextResponse.redirect(`${APP_URL}/admin/settings?tab=payments&connected=true`)
  } catch (error) {
    console.error('[stripe/connect/callback] Error:', error)
    return NextResponse.redirect(`${APP_URL}/admin/settings?tab=payments&error=failed`)
  }
}
