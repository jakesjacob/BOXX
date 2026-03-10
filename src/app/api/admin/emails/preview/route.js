import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { renderEmailPreview } from '@/lib/email'

/**
 * GET /api/admin/emails/preview?slug=booking_confirmation
 * Returns rendered HTML for a given email type with sample data
 */
export async function GET(request) {
  try {
    const session = await auth()
    if (!session || !['admin', 'employee'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')
    if (!slug) {
      return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 })
    }

    // Load custom subject/body from settings if they exist
    let customSubject = null
    let customBody = null
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from('studio_settings')
        .select('key, value')
        .in('key', [`email_${slug}_subject`, `email_${slug}_body`])
      if (data) {
        for (const row of data) {
          if (row.key === `email_${slug}_subject`) customSubject = row.value
          if (row.key === `email_${slug}_body`) customBody = row.value
        }
      }
    }

    const html = renderEmailPreview(slug, customSubject, customBody)
    if (!html) {
      return NextResponse.json({ error: 'Unknown email type' }, { status: 404 })
    }

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    console.error('[admin/emails/preview] Error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
