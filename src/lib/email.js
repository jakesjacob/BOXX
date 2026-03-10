import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const FROM = 'BOXX Thailand <noreply@boxxthailand.com>'

// ─── Shared email template wrapper (Mailchimp-style dark theme) ──────────────

function emailTemplate({ heading, body, ctaUrl, ctaText }) {
  const ctaBlock = ctaUrl && ctaText ? `
    <div style="text-align:center;margin:32px 0 16px;">
      <a href="${ctaUrl}" style="display:inline-block;padding:14px 32px;background:#c8a750;color:#0a0a0a;font-weight:700;font-size:15px;text-decoration:none;border-radius:6px;letter-spacing:0.02em;">${ctaText}</a>
    </div>` : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
    <!-- Logo -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;padding:12px 24px;border:2px solid #c8a750;border-radius:4px;">
        <span style="font-size:28px;font-weight:800;color:#f5f5f5;letter-spacing:0.12em;">BOXX</span>
      </div>
    </div>

    <!-- Main card -->
    <div style="background:#111111;border:1px solid #1a1a1a;border-radius:8px;overflow:hidden;">
      <!-- Gold accent bar -->
      <div style="height:3px;background:linear-gradient(90deg,#c8a750,#a08535);"></div>

      <div style="padding:40px 32px;">
        <h1 style="font-size:22px;font-weight:700;color:#c8a750;margin:0 0 24px 0;letter-spacing:0.01em;">${heading}</h1>
        <div style="color:#e0e0e0;font-size:15px;line-height:1.7;">
          ${body}
        </div>
        ${ctaBlock}
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:32px;padding-top:24px;border-top:1px solid #1a1a1a;">
      <p style="color:#555;font-size:12px;margin:0;">BOXX Boxing Studio</p>
      <p style="color:#444;font-size:11px;margin:6px 0 0;">89/2 Bumruang Road, Wat Ket, Chiang Mai 50000</p>
      <div style="margin-top:12px;">
        <a href="https://boxxthailand.com" style="color:#c8a750;text-decoration:none;font-size:11px;">boxxthailand.com</a>
        <span style="color:#333;margin:0 8px;">|</span>
        <a href="https://instagram.com/boxxthailand" style="color:#c8a750;text-decoration:none;font-size:11px;">Instagram</a>
      </div>
      <p style="color:#333;font-size:10px;margin-top:16px;">You received this email because you have an account with BOXX Boxing Studio.</p>
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

async function isEmailEnabled(slug) {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    if (!supabaseAdmin) return true
    const { data } = await supabaseAdmin
      .from('studio_settings')
      .select('value')
      .eq('key', `email_${slug}_enabled`)
      .single()
    if (data && data.value === 'false') return false
  } catch {
    // If lookup fails, default to enabled
  }
  return true
}

// ─── Load custom message for an email slug ──────────────────────────────────

async function getCustomMessage(slug) {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    if (!supabaseAdmin) return {}
    const { data } = await supabaseAdmin
      .from('studio_settings')
      .select('key, value')
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
  booking_confirmation: { name: 'Sarah', className: 'BOXXBEGINNER', instructor: 'Bert', date: 'Monday 15 Jan', time: '09:00' },
  class_reminder: { name: 'Sarah', className: 'BOXXBEGINNER', instructor: 'Bert', time: '09:00' },
  waitlist_promotion: { name: 'Sarah', className: 'BOXXINTER', date: 'Tuesday 16 Jan', time: '17:00' },
  credit_expiry_warning: { name: 'Sarah', packName: '10-Class Pack', creditsRemaining: 3, expiresAt: '18 Jan 2025' },
  welcome: { name: 'Sarah' },
  cancellation_confirmation: { name: 'Sarah', className: 'BOXXBEGINNER', date: 'Monday 15 Jan', time: '09:00', creditRefunded: true },
  class_cancelled_admin: { name: 'Sarah', className: 'BOXX&TRAIN', date: 'Wednesday 17 Jan', time: '18:00' },
  pack_purchase_confirmation: { name: 'Sarah', packName: '10-Class Pack', credits: 10, validityDays: 60, expiresAt: '15 Mar 2025' },
  credits_low_warning: { name: 'Sarah', creditsRemaining: 1, packName: '10-Class Pack' },
  class_changed: { name: 'Sarah', className: 'BOXXBEGINNER', changes: ['Time changed from 09:00 to 10:00', 'Instructor changed to Coach Mike'], date: 'Monday 15 Jan', time: '10:00' },
  removed_from_class: { name: 'Sarah', className: 'BOXXINTER', date: 'Tuesday 16 Jan', time: '17:00', creditRefunded: true },
  admin_cancelled_booking: { name: 'Sarah', className: 'BOXXBEGINNER', date: 'Monday 15 Jan', time: '09:00', creditRefunded: true },
  admin_direct: { subject: 'Studio Update', body: 'Hi Sarah,\n\nJust wanted to let you know about our new class schedule starting next week.\n\nBest,\nBOXX Team' },
  private_class_invitation: { name: 'Sarah', className: 'Private PT Session', instructor: 'Bert', date: 'Thursday 18 Jan', time: '14:00' },
}

// Default subjects and headings for each email type
const EMAIL_DEFAULTS = {
  booking_confirmation: { subject: 'Booking Confirmed — {{class}}', heading: "You're In" },
  class_reminder: { subject: 'Reminder: {{class}} in 1 hour', heading: 'Class in 1 Hour' },
  waitlist_promotion: { subject: 'Spot Available — {{class}}', heading: "You're Off the Waitlist" },
  credit_expiry_warning: { subject: 'Credits Expiring Soon — {{pack}}', heading: 'Credits Expiring' },
  welcome: { subject: 'Welcome to BOXX', heading: 'Welcome to BOXX' },
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
        : `<p>Hey ${s.name},</p><p>Your spot is confirmed.</p>${detailTable([['Class', s.className], ['Coach', s.instructor], ['Date', s.date], ['Time', s.time]])}<p style="color:#888;font-size:14px;">See you at 89/2 Bumruang Road, Wat Ket, Chiang Mai.</p>`,
      ctaUrl: 'https://boxxthailand.com/dashboard',
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
      ctaUrl: 'https://boxxthailand.com/dashboard',
      ctaText: 'View My Bookings',
    }),
    credit_expiry_warning: (s) => ({
      heading: 'Credits Expiring',
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>`
        : `<p>Hey ${s.name},</p><p>Your <strong>${s.packName}</strong> pack has <strong>${s.creditsRemaining} credits</strong> remaining and expires on <strong>${s.expiresAt}</strong>.</p><p>Book a class before they expire!</p>`,
      ctaUrl: 'https://boxxthailand.com/dashboard',
      ctaText: 'Book a Class',
    }),
    welcome: (s) => ({
      heading: 'Welcome to BOXX',
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>`
        : `<p>Hey ${s.name},</p><p>Thanks for joining BOXX Boxing Studio — Chiang Mai's first luxury boutique boxing and personal training studio.</p><p>Here's how to get started:</p><table style="margin:20px 0;border-collapse:collapse;"><tr><td style="padding:8px 12px 8px 0;color:#c8a750;font-weight:700;font-size:18px;vertical-align:top;">1</td><td style="padding:8px 0;color:#e0e0e0;">Browse available classes on your dashboard</td></tr><tr><td style="padding:8px 12px 8px 0;color:#c8a750;font-weight:700;font-size:18px;vertical-align:top;">2</td><td style="padding:8px 0;color:#e0e0e0;">Purchase a class pack to get credits</td></tr><tr><td style="padding:8px 12px 8px 0;color:#c8a750;font-weight:700;font-size:18px;vertical-align:top;">3</td><td style="padding:8px 0;color:#e0e0e0;">Book your first class and show up ready</td></tr></table><p style="color:#888;font-size:14px;">Questions? Reply to this email or reach us at hello@boxxthailand.com.</p>`,
      ctaUrl: 'https://boxxthailand.com/dashboard',
      ctaText: 'Go to Dashboard',
    }),
    cancellation_confirmation: (s) => ({
      heading: 'Booking Cancelled',
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>${detailTable([['Class', s.className], ['Date', s.date], ['Time', s.time], ['Credit', 'Refunded to your pack']])}`
        : `<p>Hey ${s.name},</p><p>Your booking has been cancelled.</p>${detailTable([['Class', s.className], ['Date', s.date], ['Time', s.time], ['Credit', 'Refunded to your pack']])}`,
      ctaUrl: 'https://boxxthailand.com/dashboard',
      ctaText: 'Book Another Class',
    }),
    class_cancelled_admin: (s) => ({
      heading: 'Class Cancelled',
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>`
        : `<p>Hey ${s.name},</p><p>Unfortunately, <strong>${s.className}</strong> on <strong>${s.date}</strong> at <strong>${s.time}</strong> has been cancelled.</p><p>Your credit has been automatically refunded to your pack.</p><p style="color:#888;font-size:14px;">We apologise for the inconvenience. Check the schedule for other available classes.</p>`,
      ctaUrl: 'https://boxxthailand.com/dashboard',
      ctaText: 'View Schedule',
    }),
    pack_purchase_confirmation: (s) => ({
      heading: 'Pack Purchased',
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>${detailTable([['Pack', s.packName], ['Credits', `${s.credits} classes`], ['Valid for', `${s.validityDays} days`], ['Expires', s.expiresAt]])}`
        : `<p>Hey ${s.name},</p><p>Your purchase is confirmed.</p>${detailTable([['Pack', s.packName], ['Credits', `${s.credits} classes`], ['Valid for', `${s.validityDays} days`], ['Expires', s.expiresAt]])}<p>You're all set — book your next class now!</p>`,
      ctaUrl: 'https://boxxthailand.com/dashboard',
      ctaText: 'Book a Class',
    }),
    credits_low_warning: (s) => ({
      heading: 'Credits Running Low',
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>`
        : `<p>Hey ${s.name},</p><p>You have <strong>${s.creditsRemaining} credit</strong> remaining in your <strong>${s.packName}</strong> pack.</p><p>Top up now so you don't miss out on classes.</p>`,
      ctaUrl: 'https://boxxthailand.com/buy-classes',
      ctaText: 'Buy More Credits',
    }),
    class_changed: (s) => ({
      heading: 'Class Updated',
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>`
        : `<p>Hey ${s.name},</p><p>There's been an update to your upcoming class:</p>${detailTable([['Class', s.className], ['Date', s.date], ['Time', s.time]])}<p><strong>What changed:</strong></p><ul style="padding-left:20px;color:#e0e0e0;">${s.changes.map(c => `<li style="padding:2px 0;">${c}</li>`).join('')}</ul><p style="color:#888;font-size:14px;">If you can no longer make it, you can cancel from your dashboard.</p>`,
      ctaUrl: 'https://boxxthailand.com/dashboard',
      ctaText: 'View My Bookings',
    }),
    removed_from_class: (s) => ({
      heading: 'Booking Removed',
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>`
        : `<p>Hey ${s.name},</p><p>You have been removed from <strong>${s.className}</strong> on <strong>${s.date}</strong> at <strong>${s.time}</strong>.</p><p>Your credit has been refunded to your pack.</p><p style="color:#888;font-size:14px;">If you have questions, contact us at hello@boxxthailand.com.</p>`,
      ctaUrl: 'https://boxxthailand.com/dashboard',
      ctaText: 'View Schedule',
    }),
    admin_cancelled_booking: (s) => ({
      heading: 'Booking Cancelled',
      body: s.customBody
        ? `<p>${s.customBody.replace(/\n/g, '</p><p>')}</p>`
        : `<p>Hey ${s.name},</p><p>Your booking for <strong>${s.className}</strong> on <strong>${s.date}</strong> at <strong>${s.time}</strong> has been cancelled by the studio.</p><p>Your credit has been refunded to your pack.</p><p style="color:#888;font-size:14px;">If you have questions, contact us at hello@boxxthailand.com.</p>`,
      ctaUrl: 'https://boxxthailand.com/dashboard',
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
        : `<p>Hey ${s.name},</p><p>You've been added to a private class:</p>${detailTable([['Class', s.className], ['Coach', s.instructor], ['Date', s.date], ['Time', s.time]])}<p style="color:#888;font-size:14px;">This is a private session. See you at 89/2 Bumruang Road, Wat Ket, Chiang Mai.</p>`,
      ctaUrl: 'https://boxxthailand.com/dashboard',
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

export async function sendBookingConfirmation({ to, name, className, instructor, date, time }) {
  if (!resend) return
  if (!(await isEmailEnabled('booking_confirmation'))) return
  const custom = await getCustomMessage('booking_confirmation')
  await resend.emails.send({
    from: FROM,
    to,
    subject: custom.subject || `Booking Confirmed — ${className}`,
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
        <p style="color:#888;font-size:14px;">See you at 89/2 Bumruang Road, Wat Ket, Chiang Mai.</p>
      `,
      ctaUrl: 'https://boxxthailand.com/dashboard',
      ctaText: 'View My Bookings',
    }),
  })
}

// ─── 2. Class Reminder (1 hour before) ───────────────────────────────────────

export async function sendClassReminder({ to, name, className, instructor, time }) {
  if (!resend) return
  if (!(await isEmailEnabled('class_reminder'))) return
  const custom = await getCustomMessage('class_reminder')
  await resend.emails.send({
    from: FROM,
    to,
    subject: custom.subject || `Reminder: ${className} in 1 hour`,
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

export async function sendWaitlistPromotion({ to, name, className, date, time }) {
  if (!resend) return
  if (!(await isEmailEnabled('waitlist_promotion'))) return
  const custom = await getCustomMessage('waitlist_promotion')
  await resend.emails.send({
    from: FROM,
    to,
    subject: custom.subject || `Spot Available — ${className}`,
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
      ctaUrl: 'https://boxxthailand.com/dashboard',
      ctaText: 'View My Bookings',
    }),
  })
}

// ─── 4. Credit Expiry Warning ────────────────────────────────────────────────

export async function sendCreditExpiryWarning({ to, name, packName, creditsRemaining, expiresAt }) {
  if (!resend) return
  if (!(await isEmailEnabled('credit_expiry_warning'))) return
  const custom = await getCustomMessage('credit_expiry_warning')
  await resend.emails.send({
    from: FROM,
    to,
    subject: custom.subject || `Credits Expiring Soon — ${packName}`,
    html: emailTemplate({
      heading: 'Credits Expiring',
      body: custom.body
        ? `<p>${custom.body.replace(/\n/g, '</p><p>')}</p>`
        : `
        <p>Hey ${name || 'there'},</p>
        <p>Your <strong>${packName}</strong> pack has <strong>${creditsRemaining} credit${creditsRemaining !== 1 ? 's' : ''}</strong> remaining and expires on <strong>${expiresAt}</strong>.</p>
        <p>Book a class before they expire!</p>
      `,
      ctaUrl: 'https://boxxthailand.com/dashboard',
      ctaText: 'Book a Class',
    }),
  })
}

// ─── 5. Welcome Email ────────────────────────────────────────────────────────

export async function sendWelcomeEmail({ to, name }) {
  if (!resend) return
  if (!(await isEmailEnabled('welcome'))) return
  const custom = await getCustomMessage('welcome')
  await resend.emails.send({
    from: FROM,
    to,
    subject: custom.subject || 'Welcome to BOXX',
    html: emailTemplate({
      heading: 'Welcome to BOXX',
      body: custom.body
        ? `<p>${custom.body.replace(/\n/g, '</p><p>')}</p>`
        : `
        <p>Hey ${name || 'there'},</p>
        <p>Thanks for joining BOXX Boxing Studio — Chiang Mai's first luxury boutique boxing and personal training studio.</p>
        <p>Here's how to get started:</p>
        <table style="margin:20px 0;border-collapse:collapse;">
          <tr><td style="padding:8px 12px 8px 0;color:#c8a750;font-weight:700;font-size:18px;vertical-align:top;">1</td><td style="padding:8px 0;color:#e0e0e0;">Browse available classes on your dashboard</td></tr>
          <tr><td style="padding:8px 12px 8px 0;color:#c8a750;font-weight:700;font-size:18px;vertical-align:top;">2</td><td style="padding:8px 0;color:#e0e0e0;">Purchase a class pack to get credits</td></tr>
          <tr><td style="padding:8px 12px 8px 0;color:#c8a750;font-weight:700;font-size:18px;vertical-align:top;">3</td><td style="padding:8px 0;color:#e0e0e0;">Book your first class and show up ready</td></tr>
        </table>
        <p style="color:#888;font-size:14px;">Questions? Reply to this email or reach us at hello@boxxthailand.com.</p>
      `,
      ctaUrl: 'https://boxxthailand.com/dashboard',
      ctaText: 'Go to Dashboard',
    }),
  })
}

// ─── 6. Cancellation Confirmation ────────────────────────────────────────────

export async function sendCancellationConfirmation({ to, name, className, date, time, creditRefunded }) {
  if (!resend) return
  if (!(await isEmailEnabled('cancellation_confirmation'))) return
  const custom = await getCustomMessage('cancellation_confirmation')
  await resend.emails.send({
    from: FROM,
    to,
    subject: custom.subject || `Booking Cancelled — ${className}`,
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
      ctaUrl: 'https://boxxthailand.com/dashboard',
      ctaText: 'Book Another Class',
    }),
  })
}

// ─── 7. Class Cancelled by Admin ─────────────────────────────────────────────

export async function sendClassCancelledByAdmin({ to, name, className, date, time }) {
  if (!resend) return
  if (!(await isEmailEnabled('class_cancelled_admin'))) return
  const custom = await getCustomMessage('class_cancelled_admin')
  await resend.emails.send({
    from: FROM,
    to,
    subject: custom.subject || `Class Cancelled — ${className}`,
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
      ctaUrl: 'https://boxxthailand.com/dashboard',
      ctaText: 'View Schedule',
    }),
  })
}

// ─── 8. Pack Purchase Confirmation ───────────────────────────────────────────

export async function sendPackPurchaseConfirmation({ to, name, packName, credits, validityDays, expiresAt }) {
  if (!resend) return
  if (!(await isEmailEnabled('pack_purchase_confirmation'))) return
  const custom = await getCustomMessage('pack_purchase_confirmation')
  await resend.emails.send({
    from: FROM,
    to,
    subject: custom.subject || `Pack Purchased — ${packName}`,
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
      ctaUrl: 'https://boxxthailand.com/dashboard',
      ctaText: 'Book a Class',
    }),
  })
}

// ─── 9. Credits Low Warning ──────────────────────────────────────────────────

export async function sendCreditsLowWarning({ to, name, creditsRemaining, packName }) {
  if (!resend) return
  if (!(await isEmailEnabled('credits_low_warning'))) return
  const custom = await getCustomMessage('credits_low_warning')
  await resend.emails.send({
    from: FROM,
    to,
    subject: custom.subject || `Low Credits — ${creditsRemaining} remaining`,
    html: emailTemplate({
      heading: 'Credits Running Low',
      body: custom.body
        ? `<p>${custom.body.replace(/\n/g, '</p><p>')}</p>`
        : `
        <p>Hey ${name || 'there'},</p>
        <p>You have <strong>${creditsRemaining} credit${creditsRemaining !== 1 ? 's' : ''}</strong> remaining${packName ? ` in your <strong>${packName}</strong> pack` : ''}.</p>
        <p>Top up now so you don't miss out on classes.</p>
      `,
      ctaUrl: 'https://boxxthailand.com/buy-classes',
      ctaText: 'Buy More Credits',
    }),
  })
}

// ─── 10. Class Changed Notification ──────────────────────────────────────────

export async function sendClassChanged({ to, name, className, changes, date, time }) {
  if (!resend) return
  if (!(await isEmailEnabled('class_changed'))) return
  const custom = await getCustomMessage('class_changed')
  const changesList = changes.map(c => `<li style="padding:2px 0;">${c}</li>`).join('')
  await resend.emails.send({
    from: FROM,
    to,
    subject: custom.subject || `Class Updated — ${className}`,
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
      ctaUrl: 'https://boxxthailand.com/dashboard',
      ctaText: 'View My Bookings',
    }),
  })
}

// ─── 11. Removed from Class (by admin) ───────────────────────────────────────

export async function sendRemovedFromClass({ to, name, className, date, time, creditRefunded }) {
  if (!resend) return
  if (!(await isEmailEnabled('removed_from_class'))) return
  const custom = await getCustomMessage('removed_from_class')
  await resend.emails.send({
    from: FROM,
    to,
    subject: custom.subject || `Removed from ${className}`,
    html: emailTemplate({
      heading: 'Booking Removed',
      body: custom.body
        ? `<p>${custom.body.replace(/\n/g, '</p><p>')}</p>`
        : `
        <p>Hey ${name || 'there'},</p>
        <p>You have been removed from <strong>${className}</strong> on <strong>${date}</strong> at <strong>${time}</strong>.</p>
        ${creditRefunded ? '<p>Your credit has been refunded to your pack.</p>' : ''}
        <p style="color:#888;font-size:14px;">If you have questions, contact us at hello@boxxthailand.com.</p>
      `,
      ctaUrl: 'https://boxxthailand.com/dashboard',
      ctaText: 'View Schedule',
    }),
  })
}

// ─── 12. Admin Cancelled Booking (on behalf of member) ───────────────────────

export async function sendAdminCancelledBooking({ to, name, className, date, time, creditRefunded }) {
  if (!resend) return
  if (!(await isEmailEnabled('admin_cancelled_booking'))) return
  const custom = await getCustomMessage('admin_cancelled_booking')
  await resend.emails.send({
    from: FROM,
    to,
    subject: custom.subject || `Booking Cancelled — ${className}`,
    html: emailTemplate({
      heading: 'Booking Cancelled',
      body: custom.body
        ? `<p>${custom.body.replace(/\n/g, '</p><p>')}</p>`
        : `
        <p>Hey ${name || 'there'},</p>
        <p>Your booking for <strong>${className}</strong> on <strong>${date}</strong> at <strong>${time}</strong> has been cancelled by the studio.</p>
        ${creditRefunded ? '<p>Your credit has been refunded to your pack.</p>' : '<p>No credit was refunded for this cancellation.</p>'}
        <p style="color:#888;font-size:14px;">If you have questions, contact us at hello@boxxthailand.com.</p>
      `,
      ctaUrl: 'https://boxxthailand.com/dashboard',
      ctaText: 'View Schedule',
    }),
  })
}

// ─── 13. Admin Direct / Compose Email ────────────────────────────────────────

export async function sendAdminDirectEmail({ to, subject, body }) {
  if (!resend) return
  await resend.emails.send({
    from: FROM,
    to,
    subject,
    html: emailTemplate({
      heading: subject,
      body: `<div style="white-space:pre-wrap;">${body}</div>`,
    }),
  })
}

// ─── 14. Private Class Invitation ────────────────────────────────────────────

export async function sendPrivateClassInvitation({ to, name, className, instructor, date, time }) {
  if (!resend) return
  if (!(await isEmailEnabled('private_class_invitation'))) return
  const custom = await getCustomMessage('private_class_invitation')
  await resend.emails.send({
    from: FROM,
    to,
    subject: custom.subject || `Private Class Invitation — ${className}`,
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
        <p style="color:#888;font-size:14px;">This is a private session. See you at 89/2 Bumruang Road, Wat Ket, Chiang Mai.</p>
      `,
      ctaUrl: 'https://boxxthailand.com/dashboard',
      ctaText: 'View My Bookings',
    }),
  })
}
