/**
 * Agent Tool Executor — Resolves tool calls into actual database operations.
 * Uses supabaseAdmin directly (same as admin API routes) since the agent
 * API route already validates auth.
 */
import { supabaseAdmin } from '@/lib/supabase/admin'

const DAY_MAP = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }

/**
 * Normalise time strings to HH:MM 24h format.
 * Handles: "9:00", "09:00", "9:00 AM", "2:30 PM", "14:30", etc.
 */
function normaliseTime(raw) {
  if (!raw) throw new Error('No time provided.')
  const s = raw.trim().toUpperCase()
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/)
  if (!m) throw new Error(`Cannot parse time "${raw}". Use HH:MM format.`)

  let h = parseInt(m[1], 10)
  const min = m[2]
  const ampm = m[3]

  if (ampm === 'PM' && h < 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0

  return `${String(h).padStart(2, '0')}:${min}`
}

/**
 * Execute a single tool call. Returns { success, data } or { success: false, error }.
 */
export async function executeTool(toolName, input, context) {
  try {
    switch (toolName) {
      case 'create_class': return await createClass(input, context)
      case 'create_recurring_classes': return await createRecurringClasses(input, context)
      case 'cancel_class': return await cancelClass(input, context)
      case 'delete_class': return await deleteClass(input, context)
      case 'get_schedule': return await getSchedule(input)
      case 'add_member_to_class': return await addMemberToClass(input, context)
      case 'search_members': return await searchMembers(input)
      case 'get_member_detail': return await getMemberDetail(input)
      case 'grant_credits': return await grantCredits(input, context)
      case 'create_instructor': return await createInstructor(input, context)
      case 'update_instructor': return await updateInstructor(input, context)
      case 'send_email': return await sendEmail(input, context)
      case 'get_dashboard': return await getDashboard()
      default:
        return { success: false, error: `Unknown tool: ${toolName}` }
    }
  } catch (err) {
    console.error(`[agent/executor] ${toolName} error:`, err.message)
    return { success: false, error: err.message }
  }
}

// ── Resolvers (fuzzy name → ID) ────────────────────

async function resolveClassType(name) {
  const { data } = await supabaseAdmin
    .from('class_types')
    .select('id, name, duration_mins, color, is_private')
    .eq('active', true)

  const match = (data || []).find(
    (ct) => ct.name.toLowerCase() === name.toLowerCase()
  ) || (data || []).find(
    (ct) => ct.name.toLowerCase().includes(name.toLowerCase())
  )

  if (!match) {
    const available = (data || []).map((ct) => ct.name).join(', ')
    throw new Error(`Class type "${name}" not found. Available: ${available}`)
  }
  return match
}

async function resolveInstructor(name) {
  const { data } = await supabaseAdmin
    .from('instructors')
    .select('id, name')
    .eq('active', true)

  const match = (data || []).find(
    (i) => i.name.toLowerCase() === name.toLowerCase()
  ) || (data || []).find(
    (i) => i.name.toLowerCase().includes(name.toLowerCase())
  )

  if (!match) {
    const available = (data || []).map((i) => i.name).join(', ')
    throw new Error(`Instructor "${name}" not found. Available: ${available}`)
  }
  return match
}

async function resolveMember(nameOrEmail) {
  const q = nameOrEmail.toLowerCase()

  // Try exact email match first
  const { data: byEmail } = await supabaseAdmin
    .from('users')
    .select('id, name, email')
    .ilike('email', q)
    .limit(1)

  if (byEmail?.length) return byEmail[0]

  // Try name match
  const { data: byName } = await supabaseAdmin
    .from('users')
    .select('id, name, email')
    .ilike('name', `%${q}%`)
    .limit(5)

  if (byName?.length === 1) return byName[0]
  if (byName?.length > 1) {
    const names = byName.map((m) => `${m.name} (${m.email})`).join(', ')
    throw new Error(`Multiple members match "${nameOrEmail}": ${names}. Please be more specific.`)
  }

  throw new Error(`Member "${nameOrEmail}" not found.`)
}

async function resolvePack(name) {
  const { data } = await supabaseAdmin
    .from('class_packs')
    .select('id, name, credits, validity_days, price_thb')
    .eq('active', true)

  const match = (data || []).find(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  ) || (data || []).find(
    (p) => p.name.toLowerCase().includes(name.toLowerCase())
  )

  if (!match) {
    const available = (data || []).map((p) => p.name).join(', ')
    throw new Error(`Pack "${name}" not found. Available: ${available}`)
  }
  return match
}

async function resolveClass(classTypeName, date, startTime, { allowStatus } = {}) {
  const ct = await resolveClassType(classTypeName)

  const dayStart = `${date}T00:00:00+07:00`
  const dayEnd = `${date}T23:59:59+07:00`

  let query = supabaseAdmin
    .from('class_schedule')
    .select('id, starts_at, ends_at, capacity, status, instructors(name)')
    .eq('class_type_id', ct.id)
    .gte('starts_at', dayStart)
    .lte('starts_at', dayEnd)
    .order('starts_at')

  if (allowStatus) {
    query = query.eq('status', allowStatus)
  } else {
    query = query.eq('status', 'active')
  }

  const { data: classes } = await query

  if (!classes?.length) {
    throw new Error(`No ${allowStatus || 'active'} "${ct.name}" class found on ${date}.`)
  }

  if (classes.length === 1) return { classId: classes[0].id, cls: classes[0], classType: ct }

  // Multiple — try to match by start time
  if (startTime) {
    const target = startTime.replace(':', '')
    const match = classes.find((c) => {
      const t = new Date(c.starts_at).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }).replace(':', '')
      return t === target
    })
    if (match) return { classId: match.id, cls: match, classType: ct }
  }

  const times = classes.map((c) =>
    new Date(c.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok' })
  ).join(', ')
  throw new Error(`Multiple "${ct.name}" classes on ${date} at: ${times}. Specify a start_time.`)
}

// ── Tool Implementations ───────────────────────────

async function createClass(input, context) {
  const ct = await resolveClassType(input.class_type)
  const instructor = await resolveInstructor(input.instructor)
  const duration = input.duration_mins || ct.duration_mins || 60
  const capacity = input.capacity || 6

  // Normalise time to HH:MM (handle "9:00", "9:00 AM", "09:00", etc.)
  const time = normaliseTime(input.start_time)
  const startsAt = `${input.date}T${time}:00+07:00`
  const endsAtDate = new Date(startsAt)
  if (isNaN(endsAtDate.getTime())) {
    throw new Error(`Invalid date/time: "${input.date}" / "${input.start_time}"`)
  }
  endsAtDate.setMinutes(endsAtDate.getMinutes() + duration)
  const endsAt = endsAtDate.toISOString()

  // Check for time clash
  const { data: clashes } = await supabaseAdmin
    .from('class_schedule')
    .select('id')
    .eq('instructor_id', instructor.id)
    .eq('status', 'active')
    .lt('starts_at', endsAt)
    .gt('ends_at', startsAt)

  if (clashes?.length) {
    throw new Error(`Time clash: ${instructor.name} already has a class at this time.`)
  }

  const { data: cls, error } = await supabaseAdmin
    .from('class_schedule')
    .insert({
      class_type_id: ct.id,
      instructor_id: instructor.id,
      starts_at: startsAt,
      ends_at: endsAt,
      capacity,
      notes: input.notes || null,
      status: 'active',
    })
    .select('id, starts_at, ends_at, capacity')
    .single()

  if (error) throw new Error(`Failed to create class: ${error.message}`)

  // Audit log
  await supabaseAdmin.from('admin_audit_log').insert({
    admin_id: context.adminId,
    action: 'create_class',
    target_type: 'class_schedule',
    target_id: cls.id,
    details: { via: 'agent', class_type: ct.name, instructor: instructor.name },
  })

  const displayTime = new Date(cls.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok' })
  return {
    success: true,
    data: {
      message: `Created "${ct.name}" with ${instructor.name} on ${input.date} at ${displayTime}, capacity ${capacity}.`,
      classId: cls.id,
    },
  }
}

async function createRecurringClasses(input, context) {
  const ct = await resolveClassType(input.class_type)
  const instructor = await resolveInstructor(input.instructor)
  const duration = input.duration_mins || ct.duration_mins || 60
  const capacity = input.capacity || 6
  const weeks = input.weeks || 4
  const days = (input.days || []).map((d) => DAY_MAP[d.toLowerCase()])

  const startDate = input.start_date || new Date().toISOString().split('T')[0]

  const normTime = normaliseTime(input.start_time)
  const [startH, startM] = normTime.split(':').map(Number)
  const endTotalMins = startH * 60 + startM + duration
  const endTime = `${String(Math.floor(endTotalMins / 60)).padStart(2, '0')}:${String(endTotalMins % 60).padStart(2, '0')}`

  const recurringId = crypto.randomUUID()
  const classesToCreate = []
  const baseDate = new Date(startDate + 'T00:00:00+07:00')

  for (let w = 0; w < weeks; w++) {
    for (const dayNum of days) {
      const d = new Date(baseDate)
      d.setDate(d.getDate() + w * 7 + ((dayNum - baseDate.getDay() + 7) % 7))
      if (d < new Date() && w === 0) continue // skip past dates

      const dateStr = d.toISOString().split('T')[0]
      const startsAt = `${dateStr}T${normTime}:00+07:00`
      const endsAtD = new Date(startsAt)
      endsAtD.setMinutes(endsAtD.getMinutes() + duration)

      classesToCreate.push({
        class_type_id: ct.id,
        instructor_id: instructor.id,
        starts_at: startsAt,
        ends_at: endsAtD.toISOString(),
        capacity,
        notes: input.notes || null,
        status: 'active',
        recurring_id: recurringId,
      })
    }
  }

  if (!classesToCreate.length) {
    throw new Error('No valid classes to create (all dates may be in the past).')
  }

  // Filter out clashes
  const { data: existing } = await supabaseAdmin
    .from('class_schedule')
    .select('starts_at, ends_at')
    .eq('instructor_id', instructor.id)
    .eq('status', 'active')
    .gte('starts_at', classesToCreate[0].starts_at)

  const nonClashing = classesToCreate.filter((c) => {
    return !(existing || []).some((e) =>
      new Date(c.starts_at) < new Date(e.ends_at) && new Date(c.ends_at) > new Date(e.starts_at)
    )
  })

  if (!nonClashing.length) {
    throw new Error('All time slots clash with existing classes.')
  }

  const { error } = await supabaseAdmin.from('class_schedule').insert(nonClashing)
  if (error) throw new Error(`Failed to create recurring classes: ${error.message}`)

  const skipped = classesToCreate.length - nonClashing.length
  const dayNames = input.days.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')

  await supabaseAdmin.from('admin_audit_log').insert({
    admin_id: context.adminId,
    action: 'create_recurring',
    target_type: 'class_schedule',
    details: { via: 'agent', class_type: ct.name, instructor: instructor.name, created: nonClashing.length, skipped },
  })

  return {
    success: true,
    data: {
      message: `Created ${nonClashing.length} "${ct.name}" classes with ${instructor.name} on ${dayNames} for ${weeks} weeks.${skipped ? ` ${skipped} skipped due to clashes.` : ''}`,
    },
  }
}

async function cancelClass(input, context) {
  const { classId, cls, classType } = await resolveClass(input.class_type, input.date, input.start_time)

  // Cancel the class
  await supabaseAdmin.from('class_schedule').update({ status: 'cancelled' }).eq('id', classId)

  // Cancel bookings (confirmed + invited) and refund credits for confirmed
  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select('id, user_id, credit_id, status')
    .eq('class_schedule_id', classId)
    .in('status', ['confirmed', 'invited'])

  let creditsRefunded = 0
  for (const booking of (bookings || [])) {
    await supabaseAdmin.from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', booking.id)
    if (booking.credit_id && booking.status === 'confirmed') {
      await supabaseAdmin.rpc('restore_credit', { credit_id: booking.credit_id })
      creditsRefunded++
    }
  }

  // Clear waitlist
  await supabaseAdmin.from('waitlist').delete().eq('class_schedule_id', classId)

  await supabaseAdmin.from('admin_audit_log').insert({
    admin_id: context.adminId,
    action: 'cancel_class',
    target_type: 'class_schedule',
    target_id: classId,
    details: { via: 'agent', class_type: classType.name },
  })

  const time = new Date(cls.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok' })
  return {
    success: true,
    data: {
      message: `Cancelled "${classType.name}" on ${input.date} at ${time}. ${bookings?.length || 0} booking(s) cancelled, ${creditsRefunded} credit(s) refunded.`,
    },
  }
}

async function deleteClass(input, context) {
  // Find cancelled class specifically
  const ct = await resolveClassType(input.class_type)
  const dayStart = `${input.date}T00:00:00+07:00`
  const dayEnd = `${input.date}T23:59:59+07:00`

  const { data: classes } = await supabaseAdmin
    .from('class_schedule')
    .select('id, starts_at, status, instructors(name)')
    .eq('class_type_id', ct.id)
    .eq('status', 'cancelled')
    .gte('starts_at', dayStart)
    .lte('starts_at', dayEnd)

  if (!classes?.length) {
    // Check if there's an active one
    const { data: active } = await supabaseAdmin
      .from('class_schedule')
      .select('id, status')
      .eq('class_type_id', ct.id)
      .eq('status', 'active')
      .gte('starts_at', dayStart)
      .lte('starts_at', dayEnd)
      .limit(1)

    if (active?.length) {
      throw new Error(`"${ct.name}" on ${input.date} is still active. Cancel it first before deleting.`)
    }
    throw new Error(`No cancelled "${ct.name}" class found on ${input.date}.`)
  }

  let target = classes[0]
  if (classes.length > 1 && input.start_time) {
    const normTime = normaliseTime(input.start_time).replace(':', '')
    const match = classes.find((c) => {
      const t = new Date(c.starts_at).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }).replace(':', '')
      return t === normTime
    })
    if (match) target = match
  }

  // Delete related records first (cascade should handle this but be explicit)
  await supabaseAdmin.from('bookings').delete().eq('class_schedule_id', target.id)
  await supabaseAdmin.from('waitlist').delete().eq('class_schedule_id', target.id)

  const { error } = await supabaseAdmin.from('class_schedule').delete().eq('id', target.id)
  if (error) throw new Error(`Failed to delete class: ${error.message}`)

  await supabaseAdmin.from('admin_audit_log').insert({
    admin_id: context.adminId,
    action: 'delete_class',
    target_type: 'class_schedule',
    target_id: target.id,
    details: { via: 'agent', class_type: ct.name },
  })

  const displayTime = new Date(target.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok' })
  return {
    success: true,
    data: { message: `Permanently deleted "${ct.name}" on ${input.date} at ${displayTime}.` },
  }
}

async function getSchedule(input) {
  const startDate = input?.start_date || new Date().toISOString().split('T')[0]
  const endDateObj = new Date(startDate + 'T00:00:00+07:00')
  endDateObj.setDate(endDateObj.getDate() + 7)
  const endDate = input?.end_date || endDateObj.toISOString().split('T')[0]

  const { data: classes } = await supabaseAdmin
    .from('class_schedule')
    .select('id, starts_at, ends_at, capacity, status, notes, class_types(name, color), instructors(name)')
    .gte('starts_at', `${startDate}T00:00:00+07:00`)
    .lte('starts_at', `${endDate}T23:59:59+07:00`)
    .order('starts_at')

  if (!classes?.length) {
    return { success: true, data: { message: `No classes scheduled between ${startDate} and ${endDate}.`, classes: [] } }
  }

  // Get booking counts
  const classIds = classes.map((c) => c.id)
  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select('class_schedule_id')
    .in('class_schedule_id', classIds)
    .eq('status', 'confirmed')

  const countMap = {}
  ;(bookings || []).forEach((b) => { countMap[b.class_schedule_id] = (countMap[b.class_schedule_id] || 0) + 1 })

  const summary = classes.map((c) => {
    const date = new Date(c.starts_at)
    return {
      date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok' }),
      class_type: c.class_types?.name,
      instructor: c.instructors?.name,
      booked: countMap[c.id] || 0,
      capacity: c.capacity,
      status: c.status,
    }
  })

  return {
    success: true,
    data: {
      message: `${classes.length} class(es) between ${startDate} and ${endDate}.`,
      classes: summary,
    },
  }
}

async function addMemberToClass(input, context) {
  const member = await resolveMember(input.member)
  const { classId, cls, classType } = await resolveClass(input.class_type, input.date, input.start_time)

  // Check not already booked or invited
  const { data: existing } = await supabaseAdmin
    .from('bookings')
    .select('id, status')
    .eq('user_id', member.id)
    .eq('class_schedule_id', classId)
    .in('status', ['confirmed', 'invited'])
    .limit(1)

  if (existing?.length) {
    throw new Error(`${member.name} ${existing[0].status === 'invited' ? 'already has a pending invitation' : 'is already booked'} for this class.`)
  }

  // Check if member has available credits
  const { data: allCredits } = await supabaseAdmin
    .from('user_credits')
    .select('id, credits_remaining')
    .eq('user_id', member.id)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })

  const credits = (allCredits || []).filter(
    (c) => c.credits_remaining > 0 || c.credits_remaining === null
  )

  let creditId = null
  if (credits?.length) {
    const credit = credits[0]
    if (credit.credits_remaining !== null) {
      const { data: ok } = await supabaseAdmin.rpc('deduct_credit', { credit_id: credit.id })
      if (ok) creditId = credit.id
    } else {
      creditId = credit.id
    }
  }

  const bookingStatus = creditId ? 'confirmed' : 'invited'

  const { error } = await supabaseAdmin
    .from('bookings')
    .insert({ user_id: member.id, class_schedule_id: classId, credit_id: creditId, status: bookingStatus })

  if (error) {
    if (creditId && credits[0].credits_remaining !== null) {
      await supabaseAdmin.rpc('restore_credit', { credit_id: creditId }).catch(() => {})
    }
    throw new Error(`Failed to add to roster: ${error.message}`)
  }

  // Remove from waitlist if present
  await supabaseAdmin.from('waitlist').delete().eq('user_id', member.id).eq('class_schedule_id', classId)

  // Send appropriate email
  const { data: emailUser } = await supabaseAdmin.from('users').select('email, name').eq('id', member.id).single()
  if (emailUser?.email) {
    const { sendBookingConfirmation, sendClassInvitationNeedsCredits } = await import('@/lib/email')
    const startDate = new Date(cls.starts_at)
    const emailData = {
      to: emailUser.email,
      name: emailUser.name,
      className: classType.name,
      instructor: cls.instructors?.name,
      date: startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok' }),
      time: startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok' }),
    }
    if (creditId) {
      sendBookingConfirmation(emailData).catch(() => {})
    } else {
      sendClassInvitationNeedsCredits(emailData).catch(() => {})
    }
  }

  await supabaseAdmin.from('admin_audit_log').insert({
    admin_id: context.adminId,
    action: 'add_to_roster',
    target_type: 'bookings',
    details: { via: 'agent', member: member.name, class_type: classType.name, status: bookingStatus },
  })

  const displayTime = new Date(cls.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok' })
  const statusMsg = creditId
    ? `Added ${member.name} to "${classType.name}" on ${input.date} at ${displayTime} (confirmed, credit deducted).`
    : `Invited ${member.name} to "${classType.name}" on ${input.date} at ${displayTime}. They need to purchase credits to confirm their spot — an email has been sent.`

  return { success: true, data: { message: statusMsg } }
}

async function searchMembers(input) {
  const q = input.query.toLowerCase()

  // Fetch all members and filter in JS to avoid PostgREST .or() injection issues
  const { data: allMembers } = await supabaseAdmin
    .from('users')
    .select('id, name, email, role, created_at')
    .order('name')

  const members = (allMembers || []).filter(
    (m) => m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q)
  ).slice(0, 10)

  if (!members?.length) {
    return { success: true, data: { message: `No members found matching "${input.query}".`, members: [] } }
  }

  // Enrich with credit info
  const userIds = members.map((m) => m.id)
  const { data: credits } = await supabaseAdmin
    .from('user_credits')
    .select('user_id, credits_remaining')
    .in('user_id', userIds)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())

  const creditMap = {}     // total finite credits
  const unlimitedSet = new Set() // users with unlimited packs
  ;(credits || []).forEach((c) => {
    if (c.credits_remaining === null) {
      unlimitedSet.add(c.user_id)
    } else {
      creditMap[c.user_id] = (creditMap[c.user_id] || 0) + c.credits_remaining
    }
  })

  const hasCredits = (id) => unlimitedSet.has(id) || (creditMap[id] || 0) > 0

  const results = members
    .filter((m) => {
      if (input.has_credits === 'yes') return hasCredits(m.id)
      if (input.has_credits === 'no') return !hasCredits(m.id)
      return true
    })
    .map((m) => ({
      name: m.name,
      email: m.email,
      role: m.role,
      credits: unlimitedSet.has(m.id) ? 'unlimited' : (creditMap[m.id] || 0),
      joined: new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    }))

  return {
    success: true,
    data: { message: `Found ${results.length} member(s).`, members: results },
  }
}

async function getMemberDetail(input) {
  const member = await resolveMember(input.member)

  const [creditsRes, bookingsRes] = await Promise.all([
    supabaseAdmin
      .from('user_credits')
      .select('credits_remaining, expires_at, status, class_packs(name)')
      .eq('user_id', member.id)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString()),
    supabaseAdmin
      .from('bookings')
      .select('id, status, created_at, class_schedule(starts_at, class_types(name))')
      .eq('user_id', member.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const credits = (creditsRes.data || []).map((c) => ({
    pack: c.class_packs?.name,
    remaining: c.credits_remaining,
    expires: new Date(c.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))

  const bookings = (bookingsRes.data || []).map((b) => ({
    class: b.class_schedule?.class_types?.name,
    date: new Date(b.class_schedule?.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' }),
    status: b.status,
  }))

  return {
    success: true,
    data: {
      message: `Details for ${member.name} (${member.email})`,
      member: { name: member.name, email: member.email },
      active_credits: credits,
      recent_bookings: bookings,
    },
  }
}

async function grantCredits(input, context) {
  const member = await resolveMember(input.member)
  const pack = await resolvePack(input.pack)

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + pack.validity_days)

  const { error } = await supabaseAdmin.from('user_credits').insert({
    user_id: member.id,
    class_pack_id: pack.id,
    credits_total: pack.credits,
    credits_remaining: pack.credits,
    expires_at: expiresAt.toISOString(),
    stripe_payment_id: `agent_grant_${Date.now()}`,
    status: 'active',
  })

  if (error) throw new Error(`Failed to grant credits: ${error.message}`)

  await supabaseAdmin.from('admin_audit_log').insert({
    admin_id: context.adminId,
    action: 'grant_credits',
    target_type: 'user_credits',
    details: { via: 'agent', member: member.name, pack: pack.name },
  })

  return {
    success: true,
    data: {
      message: `Granted "${pack.name}" (${pack.credits || 'unlimited'} credits, ${pack.validity_days} days) to ${member.name}.`,
    },
  }
}

async function createInstructor(input, context) {
  // Check if name already exists
  const { data: existing } = await supabaseAdmin
    .from('instructors')
    .select('id, name')
    .ilike('name', input.name)
    .limit(1)

  if (existing?.length) {
    throw new Error(`Instructor "${existing[0].name}" already exists.`)
  }

  // Check platform limit
  const { checkInstructorLimit } = await import('@/lib/platform-limits')
  const { allowed, reason } = await checkInstructorLimit()
  if (!allowed) throw new Error(reason)

  const { data: instructor, error } = await supabaseAdmin
    .from('instructors')
    .insert({
      name: input.name,
      bio: input.bio || null,
      active: true,
    })
    .select('id, name')
    .single()

  if (error) throw new Error(`Failed to create instructor: ${error.message}`)

  await supabaseAdmin.from('admin_audit_log').insert({
    admin_id: context.adminId,
    action: 'create_instructor',
    target_type: 'instructors',
    target_id: instructor.id,
    details: { via: 'agent', name: instructor.name },
  })

  return {
    success: true,
    data: { message: `Created instructor "${instructor.name}".` },
  }
}

async function updateInstructor(input, context) {
  const instructor = await resolveInstructor(input.instructor)

  const updates = {}
  if (input.name !== undefined) updates.name = input.name
  if (input.bio !== undefined) updates.bio = input.bio || null
  if (input.active !== undefined) updates.active = input.active

  if (!Object.keys(updates).length) {
    throw new Error('No updates provided. Specify name, bio, or active.')
  }

  // Prevent deactivating with future classes
  if (updates.active === false) {
    const { count } = await supabaseAdmin
      .from('class_schedule')
      .select('id', { count: 'exact', head: true })
      .eq('instructor_id', instructor.id)
      .eq('status', 'active')
      .gt('starts_at', new Date().toISOString())

    if (count > 0) {
      throw new Error(`Cannot deactivate: ${count} upcoming class(es) assigned to ${instructor.name}. Reassign them first.`)
    }
  }

  const { error } = await supabaseAdmin
    .from('instructors')
    .update(updates)
    .eq('id', instructor.id)

  if (error) throw new Error(`Failed to update instructor: ${error.message}`)

  await supabaseAdmin.from('admin_audit_log').insert({
    admin_id: context.adminId,
    action: 'update_instructor',
    target_type: 'instructors',
    target_id: instructor.id,
    details: { via: 'agent', updates },
  })

  return {
    success: true,
    data: { message: `Updated instructor "${instructor.name}".${updates.active === false ? ' (deactivated)' : ''}` },
  }
}

async function sendEmail(input, context) {
  const member = await resolveMember(input.to)
  const { sendAdminDirectEmail } = await import('@/lib/email')

  await sendAdminDirectEmail({
    to: member.email,
    subject: input.subject,
    body: input.body,
    fromName: 'BOXX Thailand',
  })

  await supabaseAdmin.from('admin_audit_log').insert({
    admin_id: context.adminId,
    action: 'send_email',
    target_type: 'email',
    details: { via: 'agent', to: member.email, subject: input.subject },
  })

  return {
    success: true,
    data: { message: `Email sent to ${member.name} (${member.email}): "${input.subject}"` },
  }
}

async function getDashboard() {
  const now = new Date()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // Use Bangkok timezone for "today" and "this month"
  const bangkokDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
  const bangkokMonth = bangkokDate.slice(0, 7)
  const monthStart = new Date(`${bangkokMonth}-01T00:00:00+07:00`)
  const todayStart = new Date(`${bangkokDate}T00:00:00+07:00`)
  const todayEnd = new Date(`${bangkokDate}T23:59:59+07:00`)

  const [membersRes, todayClassesRes, weekBookingsRes, monthRevenueRes] = await Promise.all([
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'member'),
    supabaseAdmin.from('class_schedule').select('id, starts_at, capacity, status, class_types(name), instructors(name)')
      .gte('starts_at', todayStart.toISOString()).lte('starts_at', todayEnd.toISOString()).eq('status', 'active'),
    supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed').gte('created_at', sevenDaysAgo.toISOString()),
    supabaseAdmin.from('user_credits').select('id, class_packs(price_thb)').gte('purchased_at', monthStart.toISOString()),
  ])

  const revenue = (monthRevenueRes.data || []).reduce((sum, uc) => sum + (uc.class_packs?.price_thb || 0), 0)
  const todayClasses = (todayClassesRes.data || []).map((c) => ({
    time: new Date(c.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok' }),
    class_type: c.class_types?.name,
    instructor: c.instructors?.name,
  }))

  return {
    success: true,
    data: {
      message: 'Dashboard overview',
      total_members: membersRes.count || 0,
      bookings_this_week: weekBookingsRes.count || 0,
      revenue_this_month: `฿${revenue.toLocaleString()}`,
      today_classes: todayClasses,
    },
  }
}
