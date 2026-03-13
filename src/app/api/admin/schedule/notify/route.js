import { requireStaff } from '@/lib/api-helpers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendClassChanged } from '@/lib/email'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const notifySchema = z.object({
  classId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid ID'),
  changes: z.array(z.string()).optional(),
})

/**
 * POST /api/admin/schedule/notify — Notify booked members about class changes
 */
export async function POST(request) {
  try {
    const result = await requireStaff(request)
    if (result.response) return result.response
    const { session, tenantId } = result

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const body = await request.json()
    const parsed = notifySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { classId, changes } = parsed.data

    // Get class details
    const { data: cls } = await supabaseAdmin
      .from('class_schedule')
      .select('*, class_types(name), instructors(name)')
      .eq('tenant_id', tenantId)
      .eq('id', classId)
      .single()

    if (!cls) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    // Get booked members
    const { data: bookings } = await supabaseAdmin
      .from('bookings')
      .select('users(id, name, email)')
      .eq('tenant_id', tenantId)
      .eq('class_schedule_id', classId)
      .eq('status', 'confirmed')

    const members = (bookings || []).map((b) => b.users).filter(Boolean)

    if (members.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No members to notify' })
    }

    // Send emails to all booked members
    const startDate = new Date(cls.starts_at)
    const dateStr = startDate.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok',
    })
    const timeStr = startDate.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok',
    })

    const emailPromises = members.map((member) =>
      sendClassChanged({
        to: member.email,
        name: member.name,
        className: cls.class_types?.name || 'Class',
        changes: changes || ['Class details have been updated'],
        date: dateStr,
        time: timeStr,
      }).catch((err) => console.error(`[notify] Email failed for ${member.email}:`, err))
    )

    await Promise.allSettled(emailPromises)

    await supabaseAdmin.from('admin_audit_log').insert({
      tenant_id: tenantId,
      admin_id: session.user.id,
      action: 'notify_class_change',
      target_type: 'class_schedule',
      target_id: classId,
      details: { className: cls.class_types?.name, startsAt: cls.starts_at, memberCount: members.length, changes },
    })

    return NextResponse.json({
      sent: members.length,
      message: `Notification sent to ${members.length} member${members.length !== 1 ? 's' : ''}`,
    })
  } catch (error) {
    console.error('[admin/schedule/notify] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
