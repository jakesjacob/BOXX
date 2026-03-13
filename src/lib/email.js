import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const FROM = process.env.EMAIL_FROM || 'BOXX Thailand <noreply@boxxthailand.com>'
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://boxxthailand.com'

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'

// HTML-encode user-provided values to prevent XSS/injection in emails
function escapeHtml(str) {
  if (!str) return ''
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// ─── Email logging helper ───────────────────────────────────────────────────

async function logEmail({ emailType, recipient, subject, status, error, resendId, tenantId }) {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    if (!supabaseAdmin) return
    await supabaseAdmin.from('email_log').insert({
      tenant_id: tenantId || null,
      email_type: emailType,
      recipient,
      subject: subject || null,
      status,
      error: error || null,
      resend_id: resendId || null,
    })
  } catch {
    // Logging should never break email sending
  }
}

async function sendAndLog({ emailType, to, subject, html, tenantId }) {
  if (!resend) {
    await logEmail({ emailType, recipient: to, subject, status: 'skipped', error: 'No RESEND_API_KEY', tenantId })
    return
  }

  // Check email rate limits before sending
  try {
    const { checkEmailLimit } = await import('@/lib/platform-limits')
    const { allowed, reason } = await checkEmailLimit()
    if (!allowed) {
      await logEmail({ emailType, recipient: to, subject, status: 'rate_limited', error: reason, tenantId })
      console.warn(`[email] Rate limited: ${reason}`)
      return
    }
  } catch {
    // Don't block sending if limit check fails
  }

  try {
    const result = await resend.emails.send({ from: FROM, to, subject, html })
    if (result?.error) {
      const errMsg = result.error.message || JSON.stringify(result.error)
      console.error(`[email] Resend error for ${emailType}:`, errMsg)
      await logEmail({ emailType, recipient: to, subject, status: 'failed', error: errMsg, tenantId })
      return
    }
    await logEmail({ emailType, recipient: to, subject, status: 'sent', resendId: result?.data?.id, tenantId })
    // Track the send for platform limits
    try {
      const { trackEmailSent } = await import('@/lib/platform-limits')
      await trackEmailSent()
    } catch {
      // Non-critical
    }
  } catch (err) {
    await logEmail({ emailType, recipient: to, subject, status: 'failed', error: err.message || String(err), tenantId })
    throw err
  }
}

// ─── Shared email template wrapper (Mailchimp-style dark theme) ──────────────

function emailTemplate({ heading, body, ctaUrl, ctaText, brand }) {
  const b = brand || {}
  const studioName = b.studioName || 'BOXX'
  const primaryColor = b.primaryColor || '#c8a750'
  const bgColor = b.background || '#0a0a0a'
  const cardColor = b.surface || '#111111'
  const borderColor = b.border || '#1a1a1a'

  const ctaBlock = ctaUrl && ctaText ? `
    <div style="text-align:center;margin:32px 0 16px;">
      <a href="${ctaUrl}" style="display:inline-block;padding:14px 32px;background:${primaryColor};color:${bgColor};font-weight:700;font-size:15px;text-decoration:none;border-radius:6px;letter-spacing:0.02em;">${ctaText}</a>
    </div>` : ''

  const logoBlock = b.logoUrl
    ? `<img src="${b.logoUrl}" alt="${escapeHtml(studioName)}" style="max-height:48px;max-width:200px;" />`
    : `<div style="display:inline-block;padding:12px 24px;border:2px solid ${primaryColor};border-radius:4px;">
        <span style="font-size:28px;font-weight:800;color:#f5f5f5;letter-spacing:0.12em;">${escapeHtml(studioName)}</span>
      </div>`

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body style="margin:0;padding:0;background:${bgColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
    <!-- Logo -->
    <div style="text-align:center;margin-bottom:32px;">
      ${logoBlock}
    </div>

    <!-- Main card -->
    <div style="background:${cardColor};border:1px solid ${borderColor};border-radius:8px;overflow:hidden;">
      <!-- Accent bar -->
      <div style="height:3px;background:linear-gradient(90deg,${primaryColor},${primaryColor}80);"></div>

      <div style="padding:40px 32px;">
        <h1 style="font-size:22px;font-weight:700;color:${primaryColor};margin:0 0 24px 0;letter-spacing:0.01em;">${heading}</h1>
        <div style="color:#e0e0e0;font-size:15px;line-height:1.7;">
          ${body}
        </div>
        ${ctaBlock}
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:32px;padding-top:24px;border-top:1px solid ${borderColor};">
      <p style="color:#555;font-size:12px;margin:0;">${escapeHtml(studioName)}</p>
      <p style="color:#333;font-size:10px;margin-top:16px;">You received this email because you have an account with ${escapeHtml(studioName)}.</p>
    </div>
  </div>
</body>
</html>`
}

// ─── Helper for detail tables ────────────────────────────────────────────────

function detailTable(rows) {
  return `<table style="margin:24px 0;border-collapse:collapse;width:100%;">
    ${rows.map(([label, value]) => `<tr>
      <td style="padding:6px 16px 6px 0;color:#888;font-size:14px;white-space:nowrap;vertical-align:top;">${label}</td>
      <td style="padding:6px 0;font-weight:600;color:#f5f5f5;">${value}</td>
    </tr>`).join('')}
  </table>`
}

// ─── Email enabled check ────────────────────────────────────────────────────
// Checks studio_settings for email_{slug}_enabled. Defaults to enabled.

async function isEmailEnabled(slug, tenantId = DEFAULT_TENANT_ID) {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    if (!supabaseAdmin) return true
    const { data } = await supabaseAdmin
      .from('studio_settings')
      .select('value')
      .eq('tenant_id', tenantId)
      .eq('key', `email_${slug}_enabled`)
      .single()
    if (data && data.value === 'false') return false
  } catch {
    // If lookup fails, default to enabled
  }
  return true
}

// ─── Load custom message for an email slug ──────────────────────────────────

async function getCustomMessage(slug, tenantId = DEFAULT_TENANT_ID) {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    if (!supabaseAdmin) return {}
    const { data } = await supabaseAdmin
      .from('studio_settings')
      .select('key, value')
      .eq('tenant_id', tenantId)
      .in('key', [`email_${slug}_subject`, `email_${slug}_body`])
    if (!data) return {}
    const result = {}
    for (const row of data) {
      if (row.key === `email_${slug}_subject` && row.value) result.subject = row.value
      if (row.key === `email_${slug}_body` && row.value) result.body = row.value
    }
    return result
  } catch {
    return {}
  }
}

// ─── Preview renderer (sample data for each email type) ─────────────────────

const SAMPLE_DATA = {
  booking_confirmation: { name: 'Sarah', className: 'Group Class', instructor: 'Coach', date: 'Monday 15 Jan', time: '09:00' },
  class_reminder: { name: 'Sarah', className: 'Group Class', instructor: 'Coach', time: '09:00' },
  waitlist_promotion: { name: 'Sarah', className: 'Advanced Class', date: 'Tuesday 16 Jan', time: '17:00' },
  credit_expiry_warning: { name: 'Sarah', packName: '10-Class Pack', creditsRemaining: 3, expiresAt: '18 Jan 2025' },
  welcome: { name: 'Sarah' },
  cancellation_confirmation: { name: 'Sarah', className: 'Group Class', date: 'Monday 15 Jan', time: '09:00', creditRefunded: true },
  class_cancelled_admin: { name: 'Sarah', className: 'Strength & Conditioning', date: 'Wednesday 17 Jan', time: '18:00' },
  pack_purchase_confirmation: { name: 'Sarah', packName: '10-Class Pack', credits: 10, validityDays: 60, expiresAt: '15 Mar 2025' },
  credits_low_warning: { name: 'Sarah', creditsRemaining: 1, packName: '10-Class Pack' },
  class_changed: { name: 'Sarah', className: 'Group Class', changes: ['Time changed from 09:00 to 10:00', 'Instructor changed to Coach Mike'], date: 'Monday 15 Jan', time: '10:00' },
  removed_from_class: { name: 'Sarah', className: 'Advanced Class', date: 'Tuesday 16 Jan', time: '17:00', creditRefunded: true },
  admin_cancelled_booking: { name: 'Sarah', className: 'Group Class', date: 'Monday 15 Jan', time: '09:00', creditRefunded: true },
  admin_direct: { subject: 'Studio Update', body: 'Hi Sarah,\n\nJust wanted to let you know about our new class schedule starting next week.\n\nBest,\nThe Studio Team' },
  private_class_invitation: { name: 'Sarah', className: 'Private PT Session', instructor: 'Coach', date: 'Thursday 18 Jan', time: '14:00' },
}

// Default subjects and headings for each email type
const EMAIL_DEFAULTS = {
  booking_confirmation: { subject: 'Booking Confirmed — {{class}}', heading: "You're In" },
  class_reminder: { subject: 'Reminder: {{class}} in 1 hour', heading: 'Class in 1 Hour' },
  waitlist_promotion: { subject: 'Spot Available — {{class}}', heading: "You're Off the Waitlist" },
  credit_expiry_warning: { subject: 'Credits Expiring Soon — {{pack}}', heading: 'Credits Expiring' },
  welcome: { subject: 'Welcome!', heading: 'Welcome!' },
  cancellation_confirmation: { subject: 'Booking Cancelled — {{class}}', heading: 'Booking Cancelled' },
  class_cancelled_admin: { subject: 'Class Cancelled — {{class}}', heading: 'Class Cancelled' },
  pack_purchase_confirmation: { subject: 'Pack Purchased — {{pack}}', heading: 'Pack Purchased' },
  credits_low_warning: { subject: 'Low Credits — {{credits}} remaining', heading: 'Credits Running Low' },
  class_changed: { subject: 'Class Updated — {{class}}', heading: 'Class Updated' },
  removed_from_class: { subject: 'Removed from {{class}}', heading: 'Booking Removed' },
  admin_cancelled_booking: { subject: 'Booking Cancelled — {{class}}', heading: 'Booking Cancelled' },
  admin_direct: { subject: '{{subject}}', heading: '{{subject}}' },
  private_class_invitation: { subject: 'Private Class Invitation — {{class}}', heading: "You're Invited" },
}

/**
 * Render a preview of an email with sample data.
 * Accepts optional custom subject/body overrides.
 */
export function renderEmailPreview(slug, customSubject, customBody) {
  const sample = SAMPLE_DATA[slug]
  if (!sample) return null

  const builders = {
    booking_confirmation: (s) => ({
      heading: "You're In",
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>${detailTable([['Class', s.className], ['Coach', s.instructor], ['Date', s.date], ['Time', s.time]])}`
        : `<p>Hey ${s.name},</p><p>Your spot is confirmed.</p>${detailTable([['Class', s.className], ['Coach', s.instructor], ['Date', s.date], ['Time', s.time]])}<p style="color:#888;font-size:14px;">See you there!</p>`,
      ctaUrl: '${BASE_URL}/dashboard',
      ctaText: 'View My Bookings',
    }),
    class_reminder: (s) => ({
      heading: 'Class in 1 Hour',
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>`
        : `<p>Hey ${s.name},</p><p>Just a heads up — <strong>${s.className}</strong> with ${s.instructor} starts at <strong>${s.time}</strong>.</p><p style="color:#888;font-size:14px;">Arrive 5–10 minutes early. Don't forget your wraps and water.</p>`,
    }),
    waitlist_promotion: (s) => ({
      heading: "You're Off the Waitlist",
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>`
        : `<p>Hey ${s.name},</p><p>A spot opened up in <strong>${s.className}</strong> on <strong>${s.date}</strong> at <strong>${s.time}</strong>.</p><p>You've been automatically booked in. A credit has been deducted from your pack.</p><p style="color:#888;font-size:14px;">If you can no longer make it, cancel from your dashboard before the class starts.</p>`,
      ctaUrl: '${BASE_URL}/dashboard',
      ctaText: 'View My Bookings',
    }),
    credit_expiry_warning: (s) => ({
      heading: 'Credits Expiring',
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>`
        : `<p>Hey ${s.name},</p><p>Your <strong>${s.packName}</strong> pack has <strong>${s.creditsRemaining} credits</strong> remaining and expires on <strong>${s.expiresAt}</strong>.</p><p>Book a class before they expire!</p>`,
      ctaUrl: '${BASE_URL}/dashboard',
      ctaText: 'Book a Class',
    }),
    welcome: (s) => ({
      heading: 'Welcome!',
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>`
        : `<p>Hey ${s.name},</p><p>Thanks for joining! Your account is all set up and ready to go.</p><p>Here's how to get started:</p><table style="margin:20px 0;border-collapse:collapse;"><tr><td style="padding:8px 12px 8px 0;color:#c8a750;font-weight:700;font-size:18px;vertical-align:top;">1</td><td style="padding:8px 0;color:#e0e0e0;">Browse available classes on your dashboard</td></tr><tr><td style="padding:8px 12px 8px 0;color:#c8a750;font-weight:700;font-size:18px;vertical-align:top;">2</td><td style="padding:8px 0;color:#e0e0e0;">Purchase a class pack to get credits</td></tr><tr><td style="padding:8px 12px 8px 0;color:#c8a750;font-weight:700;font-size:18px;vertical-align:top;">3</td><td style="padding:8px 0;color:#e0e0e0;">Book your first class and show up ready</td></tr></table>`,
      ctaUrl: '${BASE_URL}/dashboard',
      ctaText: 'Go to Dashboard',
    }),
    cancellation_confirmation: (s) => ({
      heading: 'Booking Cancelled',
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>${detailTable([['Class', s.className], ['Date', s.date], ['Time', s.time], ['Credit', 'Refunded to your pack']])}`
        : `<p>Hey ${s.name},</p><p>Your booking has been cancelled.</p>${detailTable([['Class', s.className], ['Date', s.date], ['Time', s.time], ['Credit', 'Refunded to your pack']])}`,
      ctaUrl: '${BASE_URL}/dashboard',
      ctaText: 'Book Another Class',
    }),
    class_cancelled_admin: (s) => ({
      heading: 'Class Cancelled',
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>`
        : `<p>Hey ${s.name},</p><p>Unfortunately, <strong>${s.className}</strong> on <strong>${s.date}</strong> at <strong>${s.time}</strong> has been cancelled.</p><p>Your credit has been automatically refunded to your pack.</p><p style="color:#888;font-size:14px;">We apologise for the inconvenience. Check the schedule for other available classes.</p>`,
      ctaUrl: '${BASE_URL}/dashboard',
      ctaText: 'View Schedule',
    }),
    pack_purchase_confirmation: (s) => ({
      heading: 'Pack Purchased',
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>${detailTable([['Pack', s.packName], ['Credits', `${s.credits} classes`], ['Valid for', `${s.validityDays} days`], ['Expires', s.expiresAt]])}`
        : `<p>Hey ${s.name},</p><p>Your purchase is confirmed.</p>${detailTable([['Pack', s.packName], ['Credits', `${s.credits} classes`], ['Valid for', `${s.validityDays} days`], ['Expires', s.expiresAt]])}<p>You're all set — book your next class now!</p>`,
      ctaUrl: '${BASE_URL}/dashboard',
      ctaText: 'Book a Class',
    }),
    credits_low_warning: (s) => ({
      heading: 'Credits Running Low',
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>`
        : `<p>Hey ${s.name},</p><p>You have <strong>${s.creditsRemaining} credit</strong> remaining in your <strong>${s.packName}</strong> pack.</p><p>Top up now so you don't miss out on classes.</p>`,
      ctaUrl: '${BASE_URL}/buy-classes',
      ctaText: 'Buy More Credits',
    }),
    class_changed: (s) => ({
      heading: 'Class Updated',
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>`
        : `<p>Hey ${s.name},</p><p>There's been an update to your upcoming class:</p>${detailTable([['Class', s.className], ['Date', s.date], ['Time', s.time]])}<p><strong>What changed:</strong></p><ul style="padding-left:20px;color:#e0e0e0;">${s.changes.map(c => `<li style="padding:2px 0;">${c}</li>`).join('')}</ul><p style="color:#888;font-size:14px;">If you can no longer make it, you can cancel from your dashboard.</p>`,
      ctaUrl: '${BASE_URL}/dashboard',
      ctaText: 'View My Bookings',
    }),
    removed_from_class: (s) => ({
      heading: 'Booking Removed',
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>`
        : `<p>Hey ${s.name},</p><p>You have been removed from <strong>${s.className}</strong> on <strong>${s.date}</strong> at <strong>${s.time}</strong>.</p><p>Your credit has been refunded to your pack.</p><p style="color:#888;font-size:14px;">If you have questions, contact the studio.</p>`,
      ctaUrl: '${BASE_URL}/dashboard',
      ctaText: 'View Schedule',
    }),
    admin_cancelled_booking: (s) => ({
      heading: 'Booking Cancelled',
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>`
        : `<p>Hey ${s.name},</p><p>Your booking for <strong>${s.className}</strong> on <strong>${s.date}</strong> at <strong>${s.time}</strong> has been cancelled by the studio.</p><p>Your credit has been refunded to your pack.</p><p style="color:#888;font-size:14px;">If you have questions, contact the studio.</p>`,
      ctaUrl: '${BASE_URL}/dashboard',
      ctaText: 'View Schedule',
    }),
    admin_direct: (s) => ({
      heading: s.customBody ? 'Studio Update' : s.subject,
      body: s.customBody
        ? `<div style="white-space:pre-wrap;">${s.customBody}</div>`
        : `<div style="white-space:pre-wrap;">${s.body}</div>`,
    }),
    private_class_invitation: (s) => ({
      heading: "You're Invited",
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>${detailTable([['Class', s.className], ['Coach', s.instructor], ['Date', s.date], ['Time', s.time]])}`
        : `<p>Hey ${s.name},</p><p>You've been added to a private class:</p>${detailTable([['Class', s.className], ['Coach', s.instructor], ['Date', s.date], ['Time', s.time]])}<p style="color:#888;font-size:14px;">This is a private session.</p>`,
      ctaUrl: '${BASE_URL}/dashboard',
      ctaText: 'View My Bookings',
    }),
  }

  const builder = builders[slug]
  if (!builder) return null

  const sampleWithCustom = { ...sample, customBody: customBody || null }
  const { heading, body, ctaUrl, ctaText } = builder(sampleWithCustom)

  return emailTemplate({
    heading: customSubject || heading,
    body,
    ctaUrl,
    ctaText,
  })
}

// ─── Export defaults for admin page ─────────────────────────────────────────

export { EMAIL_DEFAULTS }

// ─── 1. Booking Confirmation ─────────────────────────────────────────────────

export async function sendBookingConfirmation({ to, name, className, instructor, date, time, tenantId }) {
  if (!(await isEmailEnabled('booking_confirmation', tenantId))) return
  const custom = await getCustomMessage('booking_confirmation', tenantId)
  const subject = custom.subject || `Booking Confirmed — ${className}`
  await sendAndLog({
    emailType: 'booking_confirmation',
    to,
    subject,
    tenantId,
    html: emailTemplate({
      heading: "You're In",
      body: custom.body
        ? `<p>${custom.body.replace(/\n/g, '</p><p>')}</p>${detailTable([['Class', className], ['Coach', instructor || 'TBA'], ['Date', date], ['Time', time]])}`
        : `
        <p>Hey ${name || 'there'},</p>
        <p>Your spot is confirmed.</p>
        ${detailTable([
          ['Class', className],
          ['Coach', instructor || 'TBA'],
          ['Date', date],
          ['Time', time],
        ])}
        <p style="color:#888;font-size:14px;">See you there!</p>
      `,
      ctaUrl: '${BASE_URL}/dashboard',
      ctaText: 'View My Bookings',
    }),
  })
}

// ─── 2. Class Reminder (1 hour before) ───────────────────────────────────────

export async function sendClassReminder({ to, name, className, instructor, time, tenantId }) {
  if (!(await isEmailEnabled('class_reminder', tenantId))) return
  const custom = await getCustomMessage('class_reminder', tenantId)
  const subject = custom.subject || `Reminder: ${className} in 1 hour`
  await sendAndLog({
    emailType: 'class_reminder',
    to,
    subject,
    tenantId,
    html: emailTemplate({
      heading: 'Class in 1 Hour',
      body: custom.body
        ? `<p>${custom.body.replace(/\n/g, '</p><p>')}</p>`
        : `
        <p>Hey ${name || 'there'},</p>
        <p>Just a heads up — <strong>${className}</strong>${instructor ? ` with ${instructor}` : ''} starts at <strong>${time}</strong>.</p>
        <p style="color:#888;font-size:14px;">Arrive 5–10 minutes early. Don't forget your wraps and water.</p>
      `,
    }),
  })
}

// ─── 3. Waitlist Promotion ───────────────────────────────────────────────────

export async function sendWaitlistPromotion({ to, name, className, date, time, tenantId }) {
  if (!(await isEmailEnabled('waitlist_promotion', tenantId))) return
  const custom = await getCustomMessage('waitlist_promotion', tenantId)
  const subject = custom.subject || `Spot Available — ${className}`
  await sendAndLog({
    emailType: 'waitlist_promotion',
    to,
    subject,
    tenantId,
    html: emailTemplate({
      heading: "You're Off the Waitlist",
      body: custom.body
        ? `<p>${custom.body.replace(/\n/g, '</p><p>')}</p>`
        : `
        <p>Hey ${name || 'there'},</p>
        <p>A spot opened up in <strong>${className}</strong> on <strong>${date}</strong> at <strong>${time}</strong>.</p>
        <p>You've been automatically booked in. A credit has been deducted from your pack.</p>
        <p style="color:#888;font-size:14px;">If you can no longer make it, cancel from your dashboard before the class starts.</p>
      `,
      ctaUrl: '${BASE_URL}/dashboard',
      ctaText: 'View My Bookings',
    }),
  })
}

// ─── 4. Credit Expiry Warning ────────────────────────────────────────────────

export async function sendCreditExpiryWarning({ to, name, packName, creditsRemaining, expiresAt, tenantId }) {
  if (!(await isEmailEnabled('credit_expiry_warning', tenantId))) return
  const custom = await getCustomMessage('credit_expiry_warning', tenantId)
  const subject = custom.subject || `Credits Expiring Soon — ${packName}`
  await sendAndLog({
    emailType: 'credit_expiry_warning',
    to,
    subject,
    tenantId,
    html: emailTemplate({
      heading: 'Credits Expiring',
      body: custom.body
        ? `<p>${custom.body.replace(/\n/g, '</p><p>')}</p>`
        : `
        <p>Hey ${name || 'there'},</p>
        <p>Your <strong>${packName}</strong> pack has <strong>${creditsRemaining} credit${creditsRemaining !== 1 ? 's' : ''}</strong> remaining and expires on <strong>${expiresAt}</strong>.</p>
        <p>Book a class before they expire!</p>
      `,
      ctaUrl: '${BASE_URL}/dashboard',
      ctaText: 'Book a Class',
    }),
  })
}

// ─── 5. Welcome Email ────────────────────────────────────────────────────────

export async function sendWelcomeEmail({ to, name, studioName, dashboardUrl, brand, tenantId }) {
  if (!(await isEmailEnabled('welcome', tenantId))) return
  const custom = await getCustomMessage('welcome', tenantId)
  const studio = studioName || 'BOXX'
  const subject = custom.subject || `Welcome to ${studio}`
  const url = dashboardUrl || '${BASE_URL}/dashboard'
  const emailBrand = { studioName: studio, ...brand }
  const accentColor = emailBrand.primaryColor || '#c8a750'
  await sendAndLog({
    emailType: 'welcome',
    to,
    subject,
    tenantId,
    html: emailTemplate({
      heading: `Welcome to ${studio}`,
      body: custom.body
        ? `<p>${custom.body.replace(/\n/g, '</p><p>')}</p>`
        : `
        <p>Hey ${name || 'there'},</p>
        <p>Thanks for joining ${studio}! Your account is all set up and ready to go.</p>
        <p>Here's how to get started:</p>
        <table style="margin:20px 0;border-collapse:collapse;">
          <tr><td style="padding:8px 12px 8px 0;color:${accentColor};font-weight:700;font-size:18px;vertical-align:top;">1</td><td style="padding:8px 0;color:#e0e0e0;">Browse available classes on your dashboard</td></tr>
          <tr><td style="padding:8px 12px 8px 0;color:${accentColor};font-weight:700;font-size:18px;vertical-align:top;">2</td><td style="padding:8px 0;color:#e0e0e0;">Purchase a class pack to get credits</td></tr>
          <tr><td style="padding:8px 12px 8px 0;color:${accentColor};font-weight:700;font-size:18px;vertical-align:top;">3</td><td style="padding:8px 0;color:#e0e0e0;">Book your first class and show up ready</td></tr>
        </table>
      `,
      ctaUrl: url,
      ctaText: 'Go to Dashboard',
      brand: emailBrand,
    }),
  })
}

// ─── 6. Cancellation Confirmation ────────────────────────────────────────────

export async function sendCancellationConfirmation({ to, name, className, date, time, creditRefunded, tenantId }) {
  if (!(await isEmailEnabled('cancellation_confirmation', tenantId))) return
  const custom = await getCustomMessage('cancellation_confirmation', tenantId)
  const subject = custom.subject || `Booking Cancelled — ${className}`
  await sendAndLog({
    emailType: 'cancellation_confirmation',
    to,
    subject,
    tenantId,
    html: emailTemplate({
      heading: 'Booking Cancelled',
      body: custom.body
        ? `<p>${custom.body.replace(/\n/g, '</p><p>')}</p>${detailTable([['Class', className], ['Date', date], ['Time', time], ['Credit', creditRefunded ? 'Refunded to your pack' : 'Not refunded (late cancellation)']])}`
        : `
        <p>Hey ${name || 'there'},</p>
        <p>Your booking has been cancelled.</p>
        ${detailTable([
          ['Class', className],
          ['Date', date],
          ['Time', time],
          ['Credit', creditRefunded ? 'Refunded to your pack' : 'Not refunded (late cancellation)'],
        ])}
        ${!creditRefunded ? '<p style="color:#888;font-size:14px;">Cancellations within 24 hours of class time do not receive a credit refund.</p>' : ''}
      `,
      ctaUrl: '${BASE_URL}/dashboard',
      ctaText: 'Book Another Class',
    }),
  })
}

// ─── 7. Class Cancelled by Admin ─────────────────────────────────────────────

export async function sendClassCancelledByAdmin({ to, name, className, date, time, tenantId }) {
  if (!(await isEmailEnabled('class_cancelled_admin', tenantId))) return
  const custom = await getCustomMessage('class_cancelled_admin', tenantId)
  const subject = custom.subject || `Class Cancelled — ${className}`
  await sendAndLog({
    emailType: 'class_cancelled_admin',
    to,
    subject,
    tenantId,
    html: emailTemplate({
      heading: 'Class Cancelled',
      body: custom.body
        ? `<p>${custom.body.replace(/\n/g, '</p><p>')}</p>`
        : `
        <p>Hey ${name || 'there'},</p>
        <p>Unfortunately, <strong>${className}</strong> on <strong>${date}</strong> at <strong>${time}</strong> has been cancelled.</p>
        <p>Your credit has been automatically refunded to your pack.</p>
        <p style="color:#888;font-size:14px;">We apologise for the inconvenience. Check the schedule for other available classes.</p>
      `,
      ctaUrl: '${BASE_URL}/dashboard',
      ctaText: 'View Schedule',
    }),
  })
}

// ─── 8. Pack Purchase Confirmation ───────────────────────────────────────────

export async function sendPackPurchaseConfirmation({ to, name, packName, credits, validityDays, expiresAt, tenantId }) {
  if (!(await isEmailEnabled('pack_purchase_confirmation', tenantId))) return
  const custom = await getCustomMessage('pack_purchase_confirmation', tenantId)
  const subject = custom.subject || `Pack Purchased — ${packName}`
  await sendAndLog({
    emailType: 'pack_purchase_confirmation',
    to,
    subject,
    tenantId,
    html: emailTemplate({
      heading: 'Pack Purchased',
      body: custom.body
        ? `<p>${custom.body.replace(/\n/g, '</p><p>')}</p>${detailTable([['Pack', packName], ['Credits', `${credits} class${credits !== 1 ? 'es' : ''}`], ['Valid for', `${validityDays} days`], ['Expires', expiresAt]])}`
        : `
        <p>Hey ${name || 'there'},</p>
        <p>Your purchase is confirmed.</p>
        ${detailTable([
          ['Pack', packName],
          ['Credits', `${credits} class${credits !== 1 ? 'es' : ''}`],
          ['Valid for', `${validityDays} days`],
          ['Expires', expiresAt],
        ])}
        <p>You're all set — book your next class now!</p>
      `,
      ctaUrl: '${BASE_URL}/dashboard',
      ctaText: 'Book a Class',
    }),
  })
}

// ─── 9. Credits Low Warning ──────────────────────────────────────────────────

export async function sendCreditsLowWarning({ to, name, creditsRemaining, packName, tenantId }) {
  if (!(await isEmailEnabled('credits_low_warning', tenantId))) return
  const custom = await getCustomMessage('credits_low_warning', tenantId)
  const subject = custom.subject || `Low Credits — ${creditsRemaining} remaining`
  await sendAndLog({
    emailType: 'credits_low_warning',
    to,
    subject,
    tenantId,
    html: emailTemplate({
      heading: 'Credits Running Low',
      body: custom.body
        ? `<p>${custom.body.replace(/\n/g, '</p><p>')}</p>`
        : `
        <p>Hey ${name || 'there'},</p>
        <p>You have <strong>${creditsRemaining} credit${creditsRemaining !== 1 ? 's' : ''}</strong> remaining${packName ? ` in your <strong>${packName}</strong> pack` : ''}.</p>
        <p>Top up now so you don't miss out on classes.</p>
      `,
      ctaUrl: '${BASE_URL}/buy-classes',
      ctaText: 'Buy More Credits',
    }),
  })
}

// ─── 10. Class Changed Notification ──────────────────────────────────────────

export async function sendClassChanged({ to, name, className, changes, date, time, tenantId }) {
  if (!(await isEmailEnabled('class_changed', tenantId))) return
  const custom = await getCustomMessage('class_changed', tenantId)
  const changesList = changes.map(c => `<li style="padding:2px 0;">${c}</li>`).join('')
  const subject = custom.subject || `Class Updated — ${className}`
  await sendAndLog({
    emailType: 'class_changed',
    to,
    subject,
    tenantId,
    html: emailTemplate({
      heading: 'Class Updated',
      body: custom.body
        ? `<p>${custom.body.replace(/\n/g, '</p><p>')}</p>`
        : `
        <p>Hey ${name || 'there'},</p>
        <p>There's been an update to your upcoming class:</p>
        ${detailTable([
          ['Class', className],
          ['Date', date],
          ['Time', time],
        ])}
        <p><strong>What changed:</strong></p>
        <ul style="padding-left:20px;color:#e0e0e0;">${changesList}</ul>
        <p style="color:#888;font-size:14px;">If you can no longer make it, you can cancel from your dashboard.</p>
      `,
      ctaUrl: '${BASE_URL}/dashboard',
      ctaText: 'View My Bookings',
    }),
  })
}

// ─── 11. Removed from Class (by admin) ───────────────────────────────────────

export async function sendRemovedFromClass({ to, name, className, date, time, creditRefunded, tenantId }) {
  if (!(await isEmailEnabled('removed_from_class', tenantId))) return
  const custom = await getCustomMessage('removed_from_class', tenantId)
  const subject = custom.subject || `Removed from ${className}`
  await sendAndLog({
    emailType: 'removed_from_class',
    to,
    subject,
    tenantId,
    html: emailTemplate({
      heading: 'Booking Removed',
      body: custom.body
        ? `<p>${custom.body.replace(/\n/g, '</p><p>')}</p>`
        : `
        <p>Hey ${name || 'there'},</p>
        <p>You have been removed from <strong>${className}</strong> on <strong>${date}</strong> at <strong>${time}</strong>.</p>
        ${creditRefunded ? '<p>Your credit has been refunded to your pack.</p>' : ''}
        <p style="color:#888;font-size:14px;">If you have questions, contact the studio.</p>
      `,
      ctaUrl: '${BASE_URL}/dashboard',
      ctaText: 'View Schedule',
    }),
  })
}

// ─── 12. Admin Cancelled Booking (on behalf of member) ───────────────────────

export async function sendAdminCancelledBooking({ to, name, className, date, time, creditRefunded, tenantId }) {
  if (!(await isEmailEnabled('admin_cancelled_booking', tenantId))) return
  const custom = await getCustomMessage('admin_cancelled_booking', tenantId)
  const subject = custom.subject || `Booking Cancelled — ${className}`
  await sendAndLog({
    emailType: 'admin_cancelled_booking',
    to,
    subject,
    tenantId,
    html: emailTemplate({
      heading: 'Booking Cancelled',
      body: custom.body
        ? `<p>${custom.body.replace(/\n/g, '</p><p>')}</p>`
        : `
        <p>Hey ${name || 'there'},</p>
        <p>Your booking for <strong>${className}</strong> on <strong>${date}</strong> at <strong>${time}</strong> has been cancelled by the studio.</p>
        ${creditRefunded ? '<p>Your credit has been refunded to your pack.</p>' : '<p>No credit was refunded for this cancellation.</p>'}
        <p style="color:#888;font-size:14px;">If you have questions, contact the studio.</p>
      `,
      ctaUrl: '${BASE_URL}/dashboard',
      ctaText: 'View Schedule',
    }),
  })
}

// ─── 13. Admin Direct / Compose Email ────────────────────────────────────────

export async function sendAdminDirectEmail({ to, subject, body, tenantId }) {
  await sendAndLog({
    emailType: 'admin_direct',
    to,
    tenantId,
    subject: escapeHtml(subject),
    html: emailTemplate({
      heading: escapeHtml(subject),
      body: `<div style="white-space:pre-wrap;">${escapeHtml(body)}</div>`,
    }),
  })
}

// ─── 14. Password Reset ─────────────────────────────────────────────────────

export async function sendPasswordResetEmail({ to, name, resetUrl, brand, tenantId }) {
  const studioName = brand?.studioName || 'BOXX'
  await sendAndLog({
    emailType: 'password_reset',
    to,
    tenantId,
    subject: `Reset Your Password — ${studioName}`,
    html: emailTemplate({
      heading: 'Reset Your Password',
      body: `
        <p>Hey ${name || 'there'},</p>
        <p>We received a request to reset your password. Click the button below to set a new one.</p>
        <p style="color:#888;font-size:14px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      `,
      ctaUrl: resetUrl,
      ctaText: 'Reset Password',
    }),
  })
}

// ─── 15. Private Class Invitation ────────────────────────────────────────────

export async function sendPrivateClassInvitation({ to, name, className, instructor, date, time, tenantId }) {
  if (!(await isEmailEnabled('private_class_invitation', tenantId))) return
  const custom = await getCustomMessage('private_class_invitation', tenantId)
  const subject = custom.subject || `Private Class Invitation — ${className}`
  await sendAndLog({
    emailType: 'private_class_invitation',
    to,
    subject,
    tenantId,
    html: emailTemplate({
      heading: "You're Invited",
      body: custom.body
        ? `<p>${custom.body.replace(/\n/g, '</p><p>')}</p>${detailTable([['Class', className], ['Coach', instructor || 'TBA'], ['Date', date], ['Time', time]])}`
        : `
        <p>Hey ${name || 'there'},</p>
        <p>You've been added to a private class:</p>
        ${detailTable([
          ['Class', className],
          ['Coach', instructor || 'TBA'],
          ['Date', date],
          ['Time', time],
        ])}
        <p style="color:#888;font-size:14px;">This is a private session.</p>
      `,
      ctaUrl: '${BASE_URL}/dashboard',
      ctaText: 'View My Bookings',
    }),
  })
}

// ─── 11. Class Invitation (needs credits) ────────────────────────────────────

export async function sendClassInvitationNeedsCredits({ to, name, className, instructor, date, time, tenantId }) {
  if (!(await isEmailEnabled('private_class_invitation', tenantId))) return
  const subject = `You're Invited — ${className}`
  await sendAndLog({
    emailType: 'class_invitation_needs_credits',
    to,
    subject,
    tenantId,
    html: emailTemplate({
      heading: "You're Invited",
      body: `
        <p>Hey ${name || 'there'},</p>
        <p>You've been invited to a class! Purchase a class pack to confirm your spot:</p>
        ${detailTable([
          ['Class', className],
          ['Coach', instructor || 'TBA'],
          ['Date', date],
          ['Time', time],
        ])}
        <p style="color:#888;font-size:14px;">Your spot will be confirmed automatically when you purchase credits.</p>
      `,
      ctaUrl: '${BASE_URL}/buy-classes',
      ctaText: 'Buy Credits to Confirm',
    }),
  })
}

// ─── 16. Payment Failed ──────────────────────────────────────────────────────

export async function sendPaymentFailedEmail({ to, name, tenantId }) {
  await sendAndLog({
    emailType: 'payment_failed',
    to,
    tenantId,
    subject: 'Payment Failed — Action Required',
    html: emailTemplate({
      heading: 'Payment Failed',
      body: `
        <p>Hey ${name || 'there'},</p>
        <p>We were unable to process your latest payment. Your membership may be affected if this isn't resolved.</p>
        <p>Please update your payment method to continue your membership without interruption.</p>
        <p style="color:#888;font-size:14px;">If you believe this is an error, please contact us.</p>
      `,
      ctaUrl: `${BASE_URL}/buy-classes`,
      ctaText: 'Update Payment',
    }),
  })
}

// ─── 17. Membership Ended ────────────────────────────────────────────────────

export async function sendMembershipEndedEmail({ to, name, packName, tenantId }) {
  await sendAndLog({
    emailType: 'membership_ended',
    to,
    tenantId,
    subject: `Membership Ended — ${packName || 'Your Plan'}`,
    html: emailTemplate({
      heading: 'Membership Ended',
      body: `
        <p>Hey ${name || 'there'},</p>
        <p>Your <strong>${packName || 'membership'}</strong> has been cancelled and is no longer active.</p>
        <p>You can re-subscribe any time to get back to booking classes.</p>
        <p style="color:#888;font-size:14px;">Thanks for being a member. We hope to see you again soon.</p>
      `,
      ctaUrl: `${BASE_URL}/buy-classes`,
      ctaText: 'View Plans',
    }),
  })
}
