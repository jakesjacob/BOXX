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
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'owner')) {
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

const createPackSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  credits: z.number().int().min(1).nullable(),
  validity_days: z.number().int().min(1),
  price_thb: z.number().int().min(0),
  is_membership: z.boolean().optional(),
  is_intro: z.boolean().optional(),
  badge_text: z.string().nullable().optional(),
  display_order: z.number().int().optional(),
})

/**
 * POST /api/admin/packs — Create a new pack
 */
export async function POST(request) {
  try {
    const session = await auth()
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'owner')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const body = await request.json()
    const parsed = createPackSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    // Check platform pack limit
    const { checkPackLimit } = await import('@/lib/platform-limits')
    const { allowed: packAllowed, reason: packReason } = await checkPackLimit()
    if (!packAllowed) {
      return NextResponse.json({ error: packReason }, { status: 403 })
    }

    const { data: pack, error } = await supabaseAdmin
      .from('class_packs')
      .insert({
        ...parsed.data,
        active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('[admin/packs] Create error:', error)
      return NextResponse.json({ error: 'Failed to create pack' }, { status: 500 })
    }

    return NextResponse.json({ pack })
  } catch (error) {
    console.error('[admin/packs] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

const updatePackSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID'),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  credits: z.number().int().min(1).nullable().optional(),
  validity_days: z.number().int().min(1).optional(),
  price_thb: z.number().int().min(0).optional(),
  is_membership: z.boolean().optional(),
  is_intro: z.boolean().optional(),
  badge_text: z.string().nullable().optional(),
  active: z.boolean().optional(),
  display_order: z.number().int().optional(),
  stripe_price_id: z.string().nullable().optional(),
})

/**
 * PUT /api/admin/packs — Update a pack
 */
export async function PUT(request) {
  try {
    const session = await auth()
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'owner')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const body = await request.json()
    const parsed = updatePackSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { id, ...updates } = parsed.data

    // K4: Prevent deactivating if members have active credits from this pack
    if (updates.active === false) {
      const { count } = await supabaseAdmin
        .from('user_credits')
        .select('id', { count: 'exact', head: true })
        .eq('class_pack_id', id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .gt('credits_remaining', 0)

      if (count > 0) {
        return NextResponse.json(
          { error: `Cannot deactivate: ${count} member${count !== 1 ? 's' : ''} still ${count !== 1 ? 'have' : 'has'} active credits from this pack.` },
          { status: 409 }
        )
      }
    }

    const { data: pack, error } = await supabaseAdmin
      .from('class_packs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[admin/packs] Update error:', error)
      return NextResponse.json({ error: 'Failed to update pack' }, { status: 500 })
    }

    return NextResponse.json({ pack })
  } catch (error) {
    console.error('[admin/packs] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
