import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendAdminDirectEmail } from '@/lib/email'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const composeSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
})

/**
 * POST /api/admin/emails — Send a direct email to a member
 */
export async function POST(request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin' && session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = composeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { to, subject, body: emailBody } = parsed.data

    await sendAdminDirectEmail({ to, subject, body: emailBody })

    // Audit log
    if (supabaseAdmin) {
      await supabaseAdmin.from('admin_audit_log').insert({
        admin_id: session.user.id,
        action: 'send_direct_email',
        target_type: 'user',
        target_id: null,
        details: { to, subject },
      })
    }

    return NextResponse.json({ success: true, message: 'Email sent successfully' })
  } catch (error) {
    console.error('[admin/emails] Error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
