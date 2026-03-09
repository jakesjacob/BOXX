import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * GET /api/admin/packs — Get all class packs (admin)
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
      .from('class_packs')
      .select('*')
      .order('display_order', { ascending: true })

    if (error) {
      console.error('[admin/packs] Error:', error)
      return NextResponse.json({ error: 'Failed to load packs' }, { status: 500 })
    }

    return NextResponse.json({ packs: data || [] })
  } catch (error) {
    console.error('[admin/packs] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

const updatePackSchema = z.object({
  id: z.string().uuid(),
  stripe_price_id: z.string().optional(),
})

/**
 * PUT /api/admin/packs — Update a pack's Stripe Price ID
 */
export async function PUT(request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = updatePackSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { id, stripe_price_id } = parsed.data

    const { error } = await supabaseAdmin
      .from('class_packs')
      .update({ stripe_price_id: stripe_price_id || null })
      .eq('id', id)

    if (error) {
      console.error('[admin/packs] Update error:', error)
      return NextResponse.json({ error: 'Failed to update pack' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[admin/packs] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
