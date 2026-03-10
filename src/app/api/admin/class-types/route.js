import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * GET /api/admin/class-types — List all class types
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin' && session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { data, error } = await supabaseAdmin
      .from('class_types')
      .select('*')
      .order('name')

    if (error) {
      console.error('[admin/class-types] Error:', error)
      return NextResponse.json({ error: 'Failed to load class types' }, { status: 500 })
    }

    return NextResponse.json({ classTypes: data || [] })
  } catch (error) {
    console.error('[admin/class-types] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  duration_mins: z.number().int().min(1).max(300).optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(10).optional(),
  is_private: z.boolean().optional(),
})

/**
 * POST /api/admin/class-types — Create a new class type
 */
export async function POST(request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin' && session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { data: ct, error } = await supabaseAdmin
      .from('class_types')
      .insert({
        name: parsed.data.name,
        description: parsed.data.description || null,
        duration_mins: parsed.data.duration_mins || 60,
        color: parsed.data.color || '#c8a750',
        icon: parsed.data.icon || null,
        is_private: parsed.data.is_private || false,
        active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('[admin/class-types] Create error:', error)
      return NextResponse.json({ error: 'Failed to create class type' }, { status: 500 })
    }

    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: session.user.id,
      action: 'create_class_type',
      target_type: 'class_types',
      target_id: ct.id,
      details: { name: ct.name, is_private: ct.is_private },
    })

    return NextResponse.json({ classType: ct })
  } catch (error) {
    console.error('[admin/class-types] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  duration_mins: z.number().int().min(1).max(300).optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(10).nullable().optional(),
  is_private: z.boolean().optional(),
  active: z.boolean().optional(),
})

/**
 * PUT /api/admin/class-types — Update a class type
 */
export async function PUT(request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin' && session.user.role !== 'employee') {
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

    const { data: ct, error } = await supabaseAdmin
      .from('class_types')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[admin/class-types] Update error:', error)
      return NextResponse.json({ error: 'Failed to update class type' }, { status: 500 })
    }

    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: session.user.id,
      action: 'update_class_type',
      target_type: 'class_types',
      target_id: id,
      details: updates,
    })

    return NextResponse.json({ classType: ct })
  } catch (error) {
    console.error('[admin/class-types] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
