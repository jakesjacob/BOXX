import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
const MAX_SIZE = 2 * 1024 * 1024 // 2MB

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const tenantId = formData.get('tenantId')

    if (!file || !tenantId) {
      return NextResponse.json({ error: 'File and tenantId are required' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, WebP, or SVG.' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum 2MB.' }, { status: 400 })
    }

    // Sanitize filename
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const filename = `${tenantId}/logo.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabaseAdmin.storage
      .from('tenant-logos')
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('[onboarding/upload-logo] Upload error:', uploadError)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('tenant-logos')
      .getPublicUrl(filename)

    // Update tenant logo_url
    await supabaseAdmin
      .from('tenants')
      .update({ logo_url: publicUrl })
      .eq('id', tenantId)

    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    console.error('[onboarding/upload-logo] Error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
