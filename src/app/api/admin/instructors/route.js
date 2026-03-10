import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * GET /api/admin/instructors — Get all instructors
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session || (session.user.role !== 'owner' && session.user.role !== 'admin' && session.user.role !== 'employee')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { data, error } = await supabaseAdmin
      .from('instructors')
      .select('*')
      .order('name')

    if (error) {
      console.error('[admin/instructors] Error:', error)
      return NextResponse.json({ error: 'Failed to load instructors' }, { status: 500 })
    }

    return NextResponse.json({ instructors: data || [] })
  } catch (error) {
    console.error('[admin/instructors] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  bio: z.string().optional(),
  instagram_url: z.string().optional(),
})

/**
 * POST /api/admin/instructors — Create an instructor
 */
export async function POST(request) {
  try {
    const session = await auth()
    if (!session || (session.user.role !== 'owner' && session.user.role !== 'admin' && session.user.role !== 'employee')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    // Check platform instructor limit
    const { checkInstructorLimit } = await import('@/lib/platform-limits')
    const { allowed: instrAllowed, reason: instrReason } = await checkInstructorLimit()
    if (!instrAllowed) {
      return NextResponse.json({ error: instrReason }, { status: 403 })
    }

    const { data: instructor, error } = await supabaseAdmin
      .from('instructors')
      .insert({
        name: parsed.data.name,
        bio: parsed.data.bio || null,
        instagram_url: parsed.data.instagram_url || null,
        active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('[admin/instructors] Create error:', error)
      return NextResponse.json({ error: 'Failed to create instructor' }, { status: 500 })
    }

    return NextResponse.json({ instructor })
  } catch (error) {
    console.error('[admin/instructors] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

const updateSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID'),
  name: z.string().min(1).optional(),
  bio: z.string().nullable().optional(),
  instagram_url: z.string().nullable().optional(),
  active: z.boolean().optional(),
})

/**
 * PUT /api/admin/instructors — Update an instructor
 */
export async function PUT(request) {
  try {
    const session = await auth()
    if (!session || (session.user.role !== 'owner' && session.user.role !== 'admin' && session.user.role !== 'employee')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { id, ...updates } = parsed.data

    // K3: Prevent deactivating if future active classes exist
    if (updates.active === false) {
      const { count } = await supabaseAdmin
        .from('class_schedule')
        .select('id', { count: 'exact', head: true })
        .eq('instructor_id', id)
        .eq('status', 'active')
        .gt('starts_at', new Date().toISOString())

      if (count > 0) {
        return NextResponse.json(
          { error: `Cannot deactivate: ${count} upcoming class${count !== 1 ? 'es' : ''} assigned to this instructor. Reassign them first.` },
          { status: 409 }
        )
      }
    }

    const { data: instructor, error } = await supabaseAdmin
      .from('instructors')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[admin/instructors] Update error:', error)
      return NextResponse.json({ error: 'Failed to update instructor' }, { status: 500 })
    }

    return NextResponse.json({ instructor })
  } catch (error) {
    console.error('[admin/instructors] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
