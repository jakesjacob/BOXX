import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { rateLimit } from '@/lib/rate-limit'
import { getVerticalDefaults } from '@/lib/vertical-defaults'

const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100 })

// Base schema (shared fields)
const baseSchema = z.object({
  // Account
  ownerName: z.string().min(2).max(100),
  ownerEmail: z.string().email().max(255),

  // Studio
  studioName: z.string().min(2).max(100),
  slug: z.string().min(3).max(50).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  vertical: z.string().default('other'),
  timezone: z.string().default('UTC'),
  currency: z.string().max(3).default('USD'),

  // Location
  locationName: z.string().min(1).max(100).optional(),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),

  // Brand
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#3b82f6'),
  logoUrl: z.string().url().optional().nullable(),

  // Google auth (optional — present when user signed up via Google OAuth)
  googleUserId: z.string().uuid().optional(),
  password: z.string().min(8).max(128).optional(),
}).refine(data => data.password || data.googleUserId, {
  message: 'Either password or Google authentication is required',
  path: ['password'],
})

export async function POST(request) {
  // Rate limit by IP
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    await limiter.check(15, ip) // 15 signups per minute per IP
  } catch {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const parsed = baseSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.errors[0]
      return NextResponse.json({ error: firstError.message, field: firstError.path[0] }, { status: 400 })
    }

    const data = parsed.data
    const isGoogleAuth = !!data.googleUserId

    // Check slug availability
    const { data: existingTenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('slug', data.slug)
      .single()

    if (existingTenant) {
      return NextResponse.json({ error: 'This studio URL is already taken', field: 'slug' }, { status: 409 })
    }

    // For Google auth: verify the user exists and get their info
    let googleUser = null
    if (isGoogleAuth) {
      const { data: gUser } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', data.googleUserId)
        .single()

      if (!gUser) {
        return NextResponse.json({ error: 'Google account not found. Please try again.' }, { status: 400 })
      }
      googleUser = gUser
    } else {
      // For email/password: check email not already in use
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', data.ownerEmail.toLowerCase())
        .single()

      if (existingUser) {
        return NextResponse.json({ error: 'An account with this email already exists', field: 'ownerEmail' }, { status: 409 })
      }
    }

    // Hash password (only for email/password signups)
    const passwordHash = data.password ? await bcrypt.hash(data.password, 12) : null

    // Calculate trial end (14 days)
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14)

    // 1. Create tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({
        name: data.studioName,
        slug: data.slug,
        vertical: data.vertical,
        plan: 'free',
        trial_ends_at: trialEndsAt.toISOString(),
        timezone: data.timezone,
        currency: data.currency,
        primary_color: data.primaryColor,
        logo_url: data.logoUrl || null,
        is_active: true,
      })
      .select()
      .single()

    if (tenantError) {
      console.error('[onboarding] Tenant creation failed:', tenantError)
      return NextResponse.json({ error: 'Failed to create studio' }, { status: 500 })
    }

    // 2. Create location
    const { data: location } = await supabaseAdmin
      .from('locations')
      .insert({
        tenant_id: tenant.id,
        name: data.locationName || data.studioName,
        address: data.address || null,
        city: data.city || null,
        country: data.country || null,
        phone: data.phone || null,
        timezone: data.timezone,
        is_active: true,
      })
      .select()
      .single()

    // 3. Create or update owner user
    let owner
    if (isGoogleAuth) {
      // Update existing Google user: move to new tenant, promote to owner
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          tenant_id: tenant.id,
          name: data.ownerName,
          role: 'owner',
        })
        .eq('id', googleUser.id)
        .select()
        .single()

      if (updateError) {
        await supabaseAdmin.from('tenants').delete().eq('id', tenant.id)
        console.error('[onboarding] Google user update failed:', updateError)
        return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
      }
      owner = updated
    } else {
      // Create new user with email/password
      const { data: newOwner, error: ownerError } = await supabaseAdmin
        .from('users')
        .insert({
          tenant_id: tenant.id,
          email: data.ownerEmail.toLowerCase(),
          name: data.ownerName,
          password_hash: passwordHash,
          role: 'owner',
        })
        .select()
        .single()

      if (ownerError) {
        await supabaseAdmin.from('tenants').delete().eq('id', tenant.id)
        console.error('[onboarding] Owner creation failed:', ownerError)
        return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
      }
      owner = newOwner
    }

    // 4. Create staff_tenants entry
    await supabaseAdmin.from('staff_tenants').insert({
      user_id: owner.id,
      tenant_id: tenant.id,
      role: 'owner',
    })

    // 5. Enable all feature flags for trial (same as paid plans)
    const { data: flags } = await supabaseAdmin.from('feature_flags').select('key')
    if (flags?.length) {
      await supabaseAdmin.from('tenant_feature_flags').insert(
        flags.map(f => ({ tenant_id: tenant.id, flag_key: f.key, enabled: true }))
      )
    }

    // 6. Seed vertical defaults
    const defaults = getVerticalDefaults(data.vertical)

    // Class types
    if (defaults.classTypes?.length) {
      await supabaseAdmin.from('class_types').insert(
        defaults.classTypes.map(ct => ({
          tenant_id: tenant.id,
          name: ct.name,
          description: ct.description,
          color: ct.color,
          duration_mins: ct.duration_mins,
          is_private: ct.is_private || false,
          active: true,
        }))
      )
    }

    // Packs
    if (defaults.packs?.length) {
      await supabaseAdmin.from('class_packs').insert(
        defaults.packs.map((p, i) => ({
          tenant_id: tenant.id,
          name: p.name,
          credits: p.credits,
          validity_days: p.validity_days,
          price_thb: p.price_thb,
          badge_text: p.badge_text || null,
          active: true,
          display_order: i,
        }))
      )
    }

    // Studio settings
    if (defaults.settings) {
      await supabaseAdmin.from('studio_settings').insert(
        Object.entries(defaults.settings).map(([key, value]) => ({
          tenant_id: tenant.id,
          key,
          value,
        }))
      )
    }

    // Add studio_name setting
    await supabaseAdmin.from('studio_settings').upsert({
      tenant_id: tenant.id,
      key: 'studio_name',
      value: data.studioName,
    })

    // 7. Send welcome email (non-blocking)
    try {
      const { sendWelcomeEmail } = await import('@/lib/email')
      sendWelcomeEmail({ to: data.ownerEmail, name: data.ownerName }).catch(() => {})
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        trialEndsAt: tenant.trial_ends_at,
      },
      location: location ? { id: location.id, name: location.name } : null,
      owner: { id: owner.id, email: owner.email },
    })
  } catch (err) {
    console.error('[onboarding] Unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
