/**
 * Gamification system — streaks, badges, and stats
 * Computed from booking data (no extra DB tables needed)
 */

// ─── Badge Definitions ───────────────────────────────────────────────────────

const BADGES = [
  // Milestone badges
  { id: 'first_class', name: 'First Class', icon: '🥊', description: 'Attended your first class', requirement: (s) => s.totalClasses >= 1 },
  { id: 'ten_classes', name: 'Dedicated', icon: '💪', description: 'Attended 10 classes', requirement: (s) => s.totalClasses >= 10 },
  { id: 'twenty_five', name: 'Committed', icon: '🔥', description: 'Attended 25 classes', requirement: (s) => s.totalClasses >= 25 },
  { id: 'fifty_classes', name: 'Warrior', icon: '⚡', description: 'Attended 50 classes', requirement: (s) => s.totalClasses >= 50 },
  { id: 'hundred_classes', name: 'Legend', icon: '👑', description: 'Attended 100 classes', requirement: (s) => s.totalClasses >= 100 },

  // Streak badges
  { id: 'streak_3', name: '3-Week Streak', icon: '🔥', description: '3 consecutive weeks attending', requirement: (s) => s.currentStreak >= 3 },
  { id: 'streak_8', name: '2-Month Streak', icon: '🏆', description: '8 consecutive weeks attending', requirement: (s) => s.currentStreak >= 8 },
  { id: 'streak_12', name: 'Quarter Streak', icon: '💎', description: '12 consecutive weeks attending', requirement: (s) => s.currentStreak >= 12 },

  // Class variety
  { id: 'variety_3', name: 'Explorer', icon: '🌟', description: 'Tried 3 different class types', requirement: (s) => s.uniqueClassTypes >= 3 },
  { id: 'variety_all', name: 'All-Rounder', icon: '🎯', description: 'Tried every class type', requirement: (s) => s.triedAllTypes },

  // Time-based
  { id: 'early_bird', name: 'Early Bird', icon: '🌅', description: '5+ morning classes (before 10am)', requirement: (s) => s.morningClasses >= 5 },
  { id: 'night_owl', name: 'Night Owl', icon: '🌙', description: '5+ evening classes (after 5pm)', requirement: (s) => s.eveningClasses >= 5 },
]

/**
 * Compute gamification stats from booking data.
 * @param {Array} bookings - confirmed bookings with class_schedule.starts_at and class_types.name
 * @param {number} totalClassTypes - total number of active class types in the system
 */
export function computeGamificationStats(bookings, totalClassTypes = 4) {
  const confirmedPast = bookings
    .filter((b) => b.status === 'confirmed' && new Date(b.class_schedule?.starts_at) <= new Date())
    .sort((a, b) => new Date(a.class_schedule.starts_at) - new Date(b.class_schedule.starts_at))

  const totalClasses = confirmedPast.length

  // Unique class types
  const classTypeSet = new Set(confirmedPast.map((b) => b.class_schedule?.class_types?.name).filter(Boolean))
  const uniqueClassTypes = classTypeSet.size
  const triedAllTypes = totalClassTypes > 0 && uniqueClassTypes >= totalClassTypes

  // Time-based stats
  let morningClasses = 0
  let eveningClasses = 0
  for (const b of confirmedPast) {
    const hour = new Date(b.class_schedule.starts_at).getHours()
    if (hour < 10) morningClasses++
    if (hour >= 17) eveningClasses++
  }

  // Weekly streak calculation
  const { currentStreak, longestStreak } = computeStreak(confirmedPast)

  const stats = {
    totalClasses,
    currentStreak,
    longestStreak,
    uniqueClassTypes,
    triedAllTypes,
    morningClasses,
    eveningClasses,
  }

  // Compute earned badges
  const earnedBadges = BADGES.filter((badge) => badge.requirement(stats))

  return { stats, earnedBadges, allBadges: BADGES }
}

/**
 * Compute consecutive weekly streak.
 * A "week" counts if the user attended at least 1 class that week.
 */
function computeStreak(sortedBookings) {
  if (sortedBookings.length === 0) return { currentStreak: 0, longestStreak: 0 }

  // Get ISO week number for each booking
  const weeks = new Set()
  for (const b of sortedBookings) {
    const d = new Date(b.class_schedule.starts_at)
    weeks.add(getWeekKey(d))
  }

  const sortedWeeks = Array.from(weeks).sort()
  if (sortedWeeks.length === 0) return { currentStreak: 0, longestStreak: 0 }

  let longestStreak = 1
  let currentRun = 1

  for (let i = 1; i < sortedWeeks.length; i++) {
    if (isConsecutiveWeek(sortedWeeks[i - 1], sortedWeeks[i])) {
      currentRun++
      longestStreak = Math.max(longestStreak, currentRun)
    } else {
      currentRun = 1
    }
  }

  // Check if the current week or last week is in the set (streak is "active")
  const now = new Date()
  const thisWeek = getWeekKey(now)
  const lastWeek = getWeekKey(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))

  let currentStreak = 0
  if (weeks.has(thisWeek) || weeks.has(lastWeek)) {
    // Count backwards from the latest attended week
    const startWeek = weeks.has(thisWeek) ? thisWeek : lastWeek
    currentStreak = 1
    let checkWeek = startWeek
    while (true) {
      const prevWeek = getPreviousWeekKey(checkWeek)
      if (weeks.has(prevWeek)) {
        currentStreak++
        checkWeek = prevWeek
      } else {
        break
      }
    }
  }

  return { currentStreak, longestStreak: Math.max(longestStreak, currentStreak) }
}

function getWeekKey(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  // Set to Monday of the week
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return `${d.getFullYear()}-W${String(Math.ceil((d - new Date(d.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000)) + 1).padStart(2, '0')}`
}

function getPreviousWeekKey(weekKey) {
  const [yearStr, weekStr] = weekKey.split('-W')
  let year = parseInt(yearStr)
  let week = parseInt(weekStr) - 1
  if (week <= 0) {
    year--
    week = 52
  }
  return `${year}-W${String(week).padStart(2, '0')}`
}

function isConsecutiveWeek(a, b) {
  const nextA = a.split('-W')
  const bParts = b.split('-W')
  const aYear = parseInt(nextA[0])
  const aWeek = parseInt(nextA[1])
  const bYear = parseInt(bParts[0])
  const bWeek = parseInt(bParts[1])

  if (aYear === bYear) return bWeek - aWeek === 1
  if (bYear - aYear === 1 && aWeek >= 51 && bWeek === 1) return true
  return false
}
