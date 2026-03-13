import { requireAuth } from '@/lib/api-helpers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const leaveSchema = z.object({
  classScheduleId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID'),
})

/**
 * POST /api/waitlist/leave — Leave the waitlist for a class
 */
export async function POST(request) {
  try {
    const authResult = await requireAuth()
    if (authResult.response) return authResult.response
    const { session, tenantId } = authResult

    const body = await request.json()
    const parsed = leaveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { classScheduleId } = parsed.data
    const userId = session.user.id

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // Get user's waitlist entry
    const { data: entry } = await supabaseAdmin
      .from('waitlist')
      .select('id, position')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('class_schedule_id', classScheduleId)
      .single()

    if (!entry) {
      return NextResponse.json({ error: 'You are not on the waitlist' }, { status: 400 })
    }

    // Delete the entry
    const { error } = await supabaseAdmin
      .from('waitlist')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', entry.id)

    if (error) {
      console.error('[waitlist/leave] Error:', error)
      return NextResponse.json({ error: 'Failed to leave waitlist' }, { status: 500 })
    }

    // Batch-decrement positions for those behind this user using RPC or parallel updates
    const { data: behind } = await supabaseAdmin
      .from('waitlist')
      .select('id, position')
      .eq('tenant_id', tenantId)
      .eq('class_schedule_id', classScheduleId)
      .gt('position', entry.position)
      .order('position', { ascending: true })

    if (behind && behind.length > 0) {
      await Promise.all(
        behind.map((w) =>
          supabaseAdmin
            .from('waitlist')
            .update({ position: w.position - 1 })
            .eq('tenant_id', tenantId)
            .eq('id', w.id)
        )
      )
    }

    return NextResponse.json({ message: 'Removed from waitlist' })
  } catch (error) {
    console.error('[waitlist/leave] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
