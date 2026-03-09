import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * GET /api/admin/settings — Get all studio settings
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { data, error } = await supabaseAdmin
      .from('studio_settings')
      .select('key, value')

    if (error) {
      console.error('[admin/settings] Error:', error)
      return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
    }

    const settings = Object.fromEntries((data || []).map((r) => [r.key, r.value]))
    return NextResponse.json({ settings })
  } catch (error) {
    console.error('[admin/settings] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

const updateSchema = z.record(z.string(), z.string())

/**
 * PUT /api/admin/settings — Update studio settings
 */
export async function PUT(request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // Prevent updating sensitive Stripe settings via this endpoint
    const protectedKeys = ['stripe_account_id', 'stripe_access_token']
    const updates = Object.entries(parsed.data)
      .filter(([key]) => !protectedKeys.includes(key))
      .map(([key, value]) => ({ key, value }))

    if (updates.length > 0) {
      const { error } = await supabaseAdmin
        .from('studio_settings')
        .upsert(updates)

      if (error) {
        console.error('[admin/settings] Update error:', error)
        return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[admin/settings] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
