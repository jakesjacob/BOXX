import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * GET /api/admin/schedule?start=ISO&end=ISO — Get all classes for admin view
 */
export async function GET(request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!start || !end) {
      return NextResponse.json({ error: 'start and end params required' }, { status: 400 })
    }

    const { data: classes, error } = await supabaseAdmin
      .from('class_schedule')
      .select(`
        *,
        class_types(id, name, description, duration_mins, color, icon, is_private),
        instructors(id, name, photo_url)
      `)
      .gte('starts_at', new Date(start).toISOString())
      .lte('starts_at', new Date(end).toISOString())
      .order('starts_at', { ascending: true })

    if (error) {
      console.error('[admin/schedule] Error:', error)
      return NextResponse.json({ error: 'Failed to load schedule' }, { status: 500 })
    }

    // Get booking counts for each class
    const classIds = (classes || []).map((c) => c.id)
    let bookingCounts = {}
    let rosterByClass = {}
    let waitlistByClass = {}

    if (classIds.length > 0) {
      const [bookingsRes, waitlistRes] = await Promise.all([
        supabaseAdmin
          .from('bookings')
          .select('class_schedule_id, status, users(id, name, avatar_url, email)')
          .in('class_schedule_id', classIds)
          .eq('status', 'confirmed'),
        supabaseAdmin
          .from('waitlist')
          .select('class_schedule_id, position, users(id, name, avatar_url, email)')
          .in('class_schedule_id', classIds)
          .order('position', { ascending: true }),
      ])

      const bookings = bookingsRes.data || []

      bookings.forEach((b) => {
        bookingCounts[b.class_schedule_id] = (bookingCounts[b.class_schedule_id] || 0) + 1
      })

      // Build roster per class
      bookings.forEach((b) => {
        if (!rosterByClass[b.class_schedule_id]) rosterByClass[b.class_schedule_id] = []
        rosterByClass[b.class_schedule_id].push({
          id: b.users?.id,
          name: b.users?.name,
          avatar_url: b.users?.avatar_url,
          email: b.users?.email,
          status: b.status,
        })
      })

      // Build waitlist per class
      ;(waitlistRes.data || []).forEach((w) => {
        if (!waitlistByClass[w.class_schedule_id]) waitlistByClass[w.class_schedule_id] = []
        waitlistByClass[w.class_schedule_id].push({
          id: w.users?.id,
          name: w.users?.name,
          avatar_url: w.users?.avatar_url,
          email: w.users?.email,
          position: w.position,
        })
      })
    }

    const enriched = (classes || []).map((cls) => ({
      ...cls,
      booked_count: bookingCounts[cls.id] || 0,
      roster: rosterByClass[cls.id] || [],
      waitlist: waitlistByClass[cls.id] || [],
    }))

    return NextResponse.json({ classes: enriched })
  } catch (error) {
    console.error('[admin/schedule] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

const createClassSchema = z.object({
  classTypeId: z.string().min(1),
  instructorId: z.string().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  capacity: z.number().int().min(1).max(50).optional(),
  notes: z.string().optional(),
})

/**
 * POST /api/admin/schedule — Create a new class
 */
export async function POST(request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const body = await request.json()
    const parsed = createClassSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { classTypeId, instructorId, startsAt, endsAt, capacity, notes } = parsed.data

    const { data: cls, error } = await supabaseAdmin
      .from('class_schedule')
      .insert({
        class_type_id: classTypeId,
        instructor_id: instructorId,
        starts_at: startsAt,
        ends_at: endsAt,
        capacity: capacity || 6,
        notes: notes || null,
        status: 'active',
      })
      .select('*, class_types(id, name, color), instructors(id, name)')
      .single()

    if (error) {
      console.error('[admin/schedule] Create error:', error)
      return NextResponse.json({ error: 'Failed to create class' }, { status: 500 })
    }

    // Audit log
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: session.user.id,
      action: 'create_class',
      target_type: 'class_schedule',
      target_id: cls.id,
      details: { classTypeId, instructorId, startsAt },
    })

    return NextResponse.json({ class: cls })
  } catch (error) {
    console.error('[admin/schedule] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

const updateClassSchema = z.object({
  id: z.string().min(1),
  classTypeId: z.string().min(1).optional(),
  instructorId: z.string().min(1).optional(),
  startsAt: z.string().min(1).optional(),
  endsAt: z.string().min(1).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  notes: z.string().nullable().optional(),
})

/**
 * PUT /api/admin/schedule — Update an existing class
 */
export async function PUT(request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const body = await request.json()
    const parsed = updateClassSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { id, classTypeId, instructorId, startsAt, endsAt, capacity, notes } = parsed.data

    const updates = {}
    if (classTypeId) {
      updates.class_type_id = classTypeId
    }
    if (instructorId) updates.instructor_id = instructorId
    if (startsAt) updates.starts_at = startsAt
    if (endsAt) updates.ends_at = endsAt
    if (capacity !== undefined) updates.capacity = capacity
    if (notes !== undefined) updates.notes = notes

    const { data: cls, error } = await supabaseAdmin
      .from('class_schedule')
      .update(updates)
      .eq('id', id)
      .select('*, class_types(id, name, color), instructors(id, name)')
      .single()

    if (error) {
      console.error('[admin/schedule] Update error:', error)
      return NextResponse.json({ error: 'Failed to update class' }, { status: 500 })
    }

    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: session.user.id,
      action: 'update_class',
      target_type: 'class_schedule',
      target_id: id,
      details: updates,
    })

    return NextResponse.json({ class: cls })
  } catch (error) {
    console.error('[admin/schedule] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
