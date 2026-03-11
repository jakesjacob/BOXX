/**
 * Vertical-specific seed defaults for new tenant onboarding.
 * Each vertical defines sample class types, packs, and studio settings.
 */

const VERTICALS = {
  boxing: {
    label: 'Boxing / MMA',
    classTypes: [
      { name: 'Beginner Boxing', description: 'Learn the fundamentals', color: '#ef4444', duration_mins: 60 },
      { name: 'Advanced Boxing', description: 'Sharpen your skills', color: '#f97316', duration_mins: 60 },
      { name: 'Strength & Conditioning', description: 'Build power and endurance', color: '#22c55e', duration_mins: 45 },
      { name: 'Private Training', description: '1-on-1 with a coach', color: '#8b5cf6', duration_mins: 60, is_private: true },
    ],
    packs: [
      { name: 'Drop-In', credits: 1, validity_days: 7, price_thb: 500 },
      { name: '5-Class Pack', credits: 5, validity_days: 30, price_thb: 2000 },
      { name: '10-Class Pack', credits: 10, validity_days: 60, price_thb: 3500, badge_text: 'Best Value' },
    ],
    settings: {
      cancellation_window_hours: '24',
      default_class_duration: '60',
    },
  },
  yoga: {
    label: 'Yoga / Pilates',
    classTypes: [
      { name: 'Vinyasa Flow', description: 'Dynamic flowing sequences', color: '#22c55e', duration_mins: 60 },
      { name: 'Yin Yoga', description: 'Deep stretching and relaxation', color: '#06b6d4', duration_mins: 75 },
      { name: 'Power Yoga', description: 'Strength-focused practice', color: '#f97316', duration_mins: 60 },
      { name: 'Private Session', description: '1-on-1 guided practice', color: '#8b5cf6', duration_mins: 60, is_private: true },
    ],
    packs: [
      { name: 'Drop-In', credits: 1, validity_days: 7, price_thb: 400 },
      { name: '5-Class Pass', credits: 5, validity_days: 30, price_thb: 1750 },
      { name: '10-Class Pass', credits: 10, validity_days: 60, price_thb: 3000, badge_text: 'Best Value' },
    ],
    settings: {
      cancellation_window_hours: '12',
      default_class_duration: '60',
    },
  },
  fitness: {
    label: 'Gym / Fitness Studio',
    classTypes: [
      { name: 'HIIT', description: 'High intensity interval training', color: '#ef4444', duration_mins: 45 },
      { name: 'Spin', description: 'Indoor cycling', color: '#f97316', duration_mins: 45 },
      { name: 'Strength', description: 'Weight training class', color: '#22c55e', duration_mins: 60 },
      { name: 'Personal Training', description: '1-on-1 coaching', color: '#8b5cf6', duration_mins: 60, is_private: true },
    ],
    packs: [
      { name: 'Drop-In', credits: 1, validity_days: 7, price_thb: 300 },
      { name: '10-Class Pack', credits: 10, validity_days: 30, price_thb: 2500 },
      { name: '20-Class Pack', credits: 20, validity_days: 60, price_thb: 4000, badge_text: 'Best Value' },
    ],
    settings: {
      cancellation_window_hours: '12',
      default_class_duration: '45',
    },
  },
  dance: {
    label: 'Dance Studio',
    classTypes: [
      { name: 'Beginner Dance', description: 'Learn the basics', color: '#ec4899', duration_mins: 60 },
      { name: 'Intermediate', description: 'Build on fundamentals', color: '#f97316', duration_mins: 60 },
      { name: 'Open Practice', description: 'Freestyle practice session', color: '#22c55e', duration_mins: 90 },
      { name: 'Private Lesson', description: '1-on-1 instruction', color: '#8b5cf6', duration_mins: 60, is_private: true },
    ],
    packs: [
      { name: 'Drop-In', credits: 1, validity_days: 7, price_thb: 350 },
      { name: '5-Class Pass', credits: 5, validity_days: 30, price_thb: 1500 },
      { name: '10-Class Pass', credits: 10, validity_days: 60, price_thb: 2500, badge_text: 'Best Value' },
    ],
    settings: {
      cancellation_window_hours: '12',
      default_class_duration: '60',
    },
  },
  pt: {
    label: 'Personal Training',
    classTypes: [
      { name: '1-on-1 Session', description: 'Personalised training', color: '#3b82f6', duration_mins: 60, is_private: true },
      { name: 'Small Group', description: '2-4 people', color: '#22c55e', duration_mins: 60 },
      { name: 'Assessment', description: 'Fitness assessment and goal setting', color: '#f97316', duration_mins: 45, is_private: true },
    ],
    packs: [
      { name: 'Single Session', credits: 1, validity_days: 14, price_thb: 800 },
      { name: '5-Session Pack', credits: 5, validity_days: 45, price_thb: 3500 },
      { name: '10-Session Pack', credits: 10, validity_days: 90, price_thb: 6000, badge_text: 'Best Value' },
    ],
    settings: {
      cancellation_window_hours: '24',
      default_class_duration: '60',
    },
  },
  other: {
    label: 'Other',
    classTypes: [
      { name: 'Group Class', description: 'Group session', color: '#3b82f6', duration_mins: 60 },
      { name: 'Private Session', description: '1-on-1 session', color: '#8b5cf6', duration_mins: 60, is_private: true },
    ],
    packs: [
      { name: 'Single Class', credits: 1, validity_days: 7, price_thb: 500 },
      { name: '5-Class Pack', credits: 5, validity_days: 30, price_thb: 2000 },
      { name: '10-Class Pack', credits: 10, validity_days: 60, price_thb: 3500, badge_text: 'Best Value' },
    ],
    settings: {
      cancellation_window_hours: '24',
      default_class_duration: '60',
    },
  },
}

export function getVerticalDefaults(vertical) {
  return VERTICALS[vertical] || VERTICALS.other
}

export function getVerticalOptions() {
  return Object.entries(VERTICALS).map(([key, val]) => ({
    value: key,
    label: val.label,
  }))
}

export { VERTICALS }
