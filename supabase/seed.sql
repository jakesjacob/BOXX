-- ─────────────────────────────────────
-- BOXX Seed Data — Run in Supabase SQL Editor
-- First run: DELETE FROM to clean existing seed data
-- Then re-seeds with BOXX-branded class types
-- ─────────────────────────────────────

-- ─── CLEAN UP (safe — only removes seed data) ────
DELETE FROM bookings WHERE class_schedule_id IN (
  'c0000001-0000-0000-0000-000000000001',
  'c0000001-0000-0000-0000-000000000002',
  'c0000001-0000-0000-0000-000000000003',
  'c0000002-0000-0000-0000-000000000001',
  'c0000002-0000-0000-0000-000000000002',
  'c0000002-0000-0000-0000-000000000003',
  'c0000003-0000-0000-0000-000000000001',
  'c0000003-0000-0000-0000-000000000002',
  'c0000003-0000-0000-0000-000000000003',
  'c0000004-0000-0000-0000-000000000001',
  'c0000004-0000-0000-0000-000000000002',
  'c0000005-0000-0000-0000-000000000001',
  'c0000005-0000-0000-0000-000000000002',
  'c0000005-0000-0000-0000-000000000003',
  'c0000006-0000-0000-0000-000000000001',
  'c0000006-0000-0000-0000-000000000002',
  'c0000007-0000-0000-0000-000000000001'
);
DELETE FROM bookings WHERE user_id IN (
  'd1111111-1111-1111-1111-111111111111',
  'd2222222-2222-2222-2222-222222222222',
  'd3333333-3333-3333-3333-333333333333',
  'd4444444-4444-4444-4444-444444444444',
  'd5555555-5555-5555-5555-555555555555'
);
DELETE FROM class_schedule WHERE id IN (
  'c0000001-0000-0000-0000-000000000001',
  'c0000001-0000-0000-0000-000000000002',
  'c0000001-0000-0000-0000-000000000003',
  'c0000002-0000-0000-0000-000000000001',
  'c0000002-0000-0000-0000-000000000002',
  'c0000002-0000-0000-0000-000000000003',
  'c0000003-0000-0000-0000-000000000001',
  'c0000003-0000-0000-0000-000000000002',
  'c0000003-0000-0000-0000-000000000003',
  'c0000004-0000-0000-0000-000000000001',
  'c0000004-0000-0000-0000-000000000002',
  'c0000005-0000-0000-0000-000000000001',
  'c0000005-0000-0000-0000-000000000002',
  'c0000005-0000-0000-0000-000000000003',
  'c0000006-0000-0000-0000-000000000001',
  'c0000006-0000-0000-0000-000000000002',
  'c0000007-0000-0000-0000-000000000001'
);
DELETE FROM user_credits WHERE stripe_payment_id = 'seed_payment_001';
DELETE FROM users WHERE email IN ('sarah@example.com','tom@example.com','mia@example.com','jake@example.com','luna@example.com');
DELETE FROM instructors WHERE id IN (
  'b1111111-1111-1111-1111-111111111111',
  'b2222222-2222-2222-2222-222222222222',
  'b3333333-3333-3333-3333-333333333333'
);
DELETE FROM class_types WHERE id IN (
  'a1111111-1111-1111-1111-111111111111',
  'a2222222-2222-2222-2222-222222222222',
  'a3333333-3333-3333-3333-333333333333',
  'a4444444-4444-4444-4444-444444444444',
  'a5555555-5555-5555-5555-555555555555'
);

-- ─── CLASS TYPES (matches homepage) ──────────────
INSERT INTO class_types (id, name, description, duration_mins, color, icon, active) VALUES
  ('a1111111-1111-1111-1111-111111111111',
   'BOXXBEGINNER',
   'Perfect for first-timers or anyone new to boxing. Move through shadow boxing, bag work, and 1:1 padwork with a focus on both offence and defence.',
   55, '#8b5cf6', 'beginner', true),
  ('a2222222-2222-2222-2222-222222222222',
   'BOXXINTER',
   'For those with a basic understanding of boxing fundamentals. Higher pace, higher intensity, with advanced combinations and defensive drills.',
   55, '#e74c3c', 'intermediate', true),
  ('a3333333-3333-3333-3333-333333333333',
   'BOXX&TRAIN',
   'The best of both worlds. Boxing meets strength and conditioning with weights, kettlebells, and bodyweight training. Build muscle, burn fat, and get fit.',
   55, '#3498db', 'train', true),
  ('a4444444-4444-4444-4444-444444444444',
   'BOXXJUNIORS',
   'Boxing in a safe, fun, and supportive environment. Sessions build fitness, coordination, and discipline while teaching fundamentals.',
   55, '#2ecc71', 'juniors', true);

-- ─── INSTRUCTORS ──────────────────────
INSERT INTO instructors (id, name, bio, photo_url, instagram_url, active) VALUES
  ('b1111111-1111-1111-1111-111111111111',
   'Bert S.',
   'Founder of BOXX. UK-qualified PT with 10+ years experience. Former competitive boxer.',
   NULL, 'https://instagram.com/boxxthailand', true),
  ('b2222222-2222-2222-2222-222222222222',
   'Coach Dan',
   'Boxing coach specialising in technique and defensive skills. Patient and methodical.',
   NULL, NULL, true),
  ('b3333333-3333-3333-3333-333333333333',
   'Coach Aim',
   'Strength & conditioning specialist. Makes you stronger, fitter, and more explosive.',
   NULL, NULL, true);

-- ─── DUMMY MEMBERS ────────────────────
INSERT INTO users (id, email, name, bio, show_in_roster, role) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'sarah@example.com', 'Sarah M.', 'Morning boxer. Coffee first, combos second.', true, 'member'),
  ('d2222222-2222-2222-2222-222222222222', 'tom@example.com', 'Tom W.', 'Digital nomad. Training in Chiang Mai for 6 months.', true, 'member'),
  ('d3333333-3333-3333-3333-333333333333', 'mia@example.com', 'Mia L.', 'Boxing convert. Started beginner, now at inter.', true, 'member'),
  ('d4444444-4444-4444-4444-444444444444', 'jake@example.com', 'Jake P.', 'Here for the BOXX&TRAIN sessions.', true, 'member'),
  ('d5555555-5555-5555-5555-555555555555', 'luna@example.com', 'Luna C.', '', false, 'member')
ON CONFLICT (email) DO NOTHING;

-- ─── SCHEDULE (next 7 days) ──────────

-- DAY 0 (today)
INSERT INTO class_schedule (id, class_type_id, instructor_id, starts_at, ends_at, capacity, credits_cost, status) VALUES
  ('c0000001-0000-0000-0000-000000000001',
   'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   (CURRENT_DATE + INTERVAL '7 hours')::timestamptz,
   (CURRENT_DATE + INTERVAL '7 hours 55 minutes')::timestamptz,
   6, 1, 'active'),
  ('c0000001-0000-0000-0000-000000000002',
   'a3333333-3333-3333-3333-333333333333', 'b3333333-3333-3333-3333-333333333333',
   (CURRENT_DATE + INTERVAL '9 hours')::timestamptz,
   (CURRENT_DATE + INTERVAL '9 hours 55 minutes')::timestamptz,
   6, 1, 'active'),
  ('c0000001-0000-0000-0000-000000000003',
   'a2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222',
   (CURRENT_DATE + INTERVAL '17 hours')::timestamptz,
   (CURRENT_DATE + INTERVAL '17 hours 55 minutes')::timestamptz,
   6, 1, 'active');

-- DAY 1 (tomorrow)
INSERT INTO class_schedule (id, class_type_id, instructor_id, starts_at, ends_at, capacity, credits_cost, status) VALUES
  ('c0000002-0000-0000-0000-000000000001',
   'a2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111',
   (CURRENT_DATE + INTERVAL '1 day 7 hours')::timestamptz,
   (CURRENT_DATE + INTERVAL '1 day 7 hours 55 minutes')::timestamptz,
   6, 1, 'active'),
  ('c0000002-0000-0000-0000-000000000002',
   'a1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222',
   (CURRENT_DATE + INTERVAL '1 day 17 hours')::timestamptz,
   (CURRENT_DATE + INTERVAL '1 day 17 hours 55 minutes')::timestamptz,
   6, 1, 'active'),
  ('c0000002-0000-0000-0000-000000000003',
   'a4444444-4444-4444-4444-444444444444', 'b1111111-1111-1111-1111-111111111111',
   (CURRENT_DATE + INTERVAL '1 day 10 hours')::timestamptz,
   (CURRENT_DATE + INTERVAL '1 day 10 hours 55 minutes')::timestamptz,
   10, 1, 'active');

-- DAY 2
INSERT INTO class_schedule (id, class_type_id, instructor_id, starts_at, ends_at, capacity, credits_cost, status) VALUES
  ('c0000003-0000-0000-0000-000000000001',
   'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   (CURRENT_DATE + INTERVAL '2 days 7 hours')::timestamptz,
   (CURRENT_DATE + INTERVAL '2 days 7 hours 55 minutes')::timestamptz,
   6, 1, 'active'),
  ('c0000003-0000-0000-0000-000000000002',
   'a3333333-3333-3333-3333-333333333333', 'b3333333-3333-3333-3333-333333333333',
   (CURRENT_DATE + INTERVAL '2 days 9 hours')::timestamptz,
   (CURRENT_DATE + INTERVAL '2 days 9 hours 55 minutes')::timestamptz,
   6, 1, 'active'),
  ('c0000003-0000-0000-0000-000000000003',
   'a2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222',
   (CURRENT_DATE + INTERVAL '2 days 17 hours')::timestamptz,
   (CURRENT_DATE + INTERVAL '2 days 17 hours 55 minutes')::timestamptz,
   6, 1, 'active');

-- DAY 3
INSERT INTO class_schedule (id, class_type_id, instructor_id, starts_at, ends_at, capacity, credits_cost, status) VALUES
  ('c0000004-0000-0000-0000-000000000001',
   'a3333333-3333-3333-3333-333333333333', 'b3333333-3333-3333-3333-333333333333',
   (CURRENT_DATE + INTERVAL '3 days 7 hours')::timestamptz,
   (CURRENT_DATE + INTERVAL '3 days 7 hours 55 minutes')::timestamptz,
   6, 1, 'active'),
  ('c0000004-0000-0000-0000-000000000002',
   'a2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111',
   (CURRENT_DATE + INTERVAL '3 days 17 hours')::timestamptz,
   (CURRENT_DATE + INTERVAL '3 days 17 hours 55 minutes')::timestamptz,
   6, 1, 'active');

-- DAY 4
INSERT INTO class_schedule (id, class_type_id, instructor_id, starts_at, ends_at, capacity, credits_cost, status) VALUES
  ('c0000005-0000-0000-0000-000000000001',
   'a1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222',
   (CURRENT_DATE + INTERVAL '4 days 7 hours')::timestamptz,
   (CURRENT_DATE + INTERVAL '4 days 7 hours 55 minutes')::timestamptz,
   6, 1, 'active'),
  ('c0000005-0000-0000-0000-000000000002',
   'a3333333-3333-3333-3333-333333333333', 'b3333333-3333-3333-3333-333333333333',
   (CURRENT_DATE + INTERVAL '4 days 9 hours')::timestamptz,
   (CURRENT_DATE + INTERVAL '4 days 9 hours 55 minutes')::timestamptz,
   6, 1, 'active'),
  ('c0000005-0000-0000-0000-000000000003',
   'a4444444-4444-4444-4444-444444444444', 'b1111111-1111-1111-1111-111111111111',
   (CURRENT_DATE + INTERVAL '4 days 10 hours')::timestamptz,
   (CURRENT_DATE + INTERVAL '4 days 10 hours 55 minutes')::timestamptz,
   10, 1, 'active');

-- DAY 5 (Saturday)
INSERT INTO class_schedule (id, class_type_id, instructor_id, starts_at, ends_at, capacity, credits_cost, status) VALUES
  ('c0000006-0000-0000-0000-000000000001',
   'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   (CURRENT_DATE + INTERVAL '5 days 8 hours')::timestamptz,
   (CURRENT_DATE + INTERVAL '5 days 8 hours 55 minutes')::timestamptz,
   6, 1, 'active'),
  ('c0000006-0000-0000-0000-000000000002',
   'a2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222',
   (CURRENT_DATE + INTERVAL '5 days 10 hours')::timestamptz,
   (CURRENT_DATE + INTERVAL '5 days 10 hours 55 minutes')::timestamptz,
   6, 1, 'active');

-- DAY 6 (Sunday)
INSERT INTO class_schedule (id, class_type_id, instructor_id, starts_at, ends_at, capacity, credits_cost, status) VALUES
  ('c0000007-0000-0000-0000-000000000001',
   'a3333333-3333-3333-3333-333333333333', 'b3333333-3333-3333-3333-333333333333',
   (CURRENT_DATE + INTERVAL '6 days 9 hours')::timestamptz,
   (CURRENT_DATE + INTERVAL '6 days 9 hours 55 minutes')::timestamptz,
   6, 1, 'active');

-- ─── DUMMY BOOKINGS (roster population) ────

-- Sarah, Tom, Mia in today's BOXXBEGINNER
INSERT INTO bookings (user_id, class_schedule_id, status) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'c0000001-0000-0000-0000-000000000001', 'confirmed'),
  ('d2222222-2222-2222-2222-222222222222', 'c0000001-0000-0000-0000-000000000001', 'confirmed'),
  ('d3333333-3333-3333-3333-333333333333', 'c0000001-0000-0000-0000-000000000001', 'confirmed');

-- Jake, Luna in today's BOXXINTER
INSERT INTO bookings (user_id, class_schedule_id, status) VALUES
  ('d4444444-4444-4444-4444-444444444444', 'c0000001-0000-0000-0000-000000000003', 'confirmed'),
  ('d5555555-5555-5555-5555-555555555555', 'c0000001-0000-0000-0000-000000000003', 'confirmed');

-- Sarah in tomorrow's BOXXINTER
INSERT INTO bookings (user_id, class_schedule_id, status) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'c0000002-0000-0000-0000-000000000001', 'confirmed');

-- Tom, Mia, Jake in Day 2 BOXXBEGINNER
INSERT INTO bookings (user_id, class_schedule_id, status) VALUES
  ('d2222222-2222-2222-2222-222222222222', 'c0000003-0000-0000-0000-000000000001', 'confirmed'),
  ('d3333333-3333-3333-3333-333333333333', 'c0000003-0000-0000-0000-000000000001', 'confirmed'),
  ('d4444444-4444-4444-4444-444444444444', 'c0000003-0000-0000-0000-000000000001', 'confirmed');

-- Sarah, Tom in Day 3 BOXXINTER
INSERT INTO bookings (user_id, class_schedule_id, status) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'c0000004-0000-0000-0000-000000000002', 'confirmed'),
  ('d2222222-2222-2222-2222-222222222222', 'c0000004-0000-0000-0000-000000000002', 'confirmed');

-- ─── YOUR ACCOUNT: CREDITS + BOOKINGS ────

DO $$
DECLARE
  v_user_id UUID;
  v_pack_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM users
    WHERE email NOT LIKE '%@example.com'
    ORDER BY created_at ASC LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No real user found — skipping';
    RETURN;
  END IF;

  SELECT id INTO v_pack_id FROM class_packs WHERE credits = 10 LIMIT 1;

  -- 10 credits, 8 remaining
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status)
  VALUES (v_user_id, v_pack_id, 10, 8, NOW() + INTERVAL '60 days', 'seed_payment_001', 'active');

  -- Upcoming: tomorrow's BOXXINTER + Day 3 BOXX&TRAIN
  INSERT INTO bookings (user_id, class_schedule_id, status) VALUES
    (v_user_id, 'c0000002-0000-0000-0000-000000000001', 'confirmed'),
    (v_user_id, 'c0000004-0000-0000-0000-000000000001', 'confirmed');

  -- Past: attended today's morning class
  INSERT INTO bookings (user_id, class_schedule_id, status, created_at)
  VALUES (v_user_id, 'c0000001-0000-0000-0000-000000000001', 'attended', NOW() - INTERVAL '2 hours');

  -- Past: cancelled yesterday
  INSERT INTO bookings (user_id, class_schedule_id, status, cancelled_at, credit_returned, created_at)
  VALUES (v_user_id, 'c0000001-0000-0000-0000-000000000003', 'cancelled', NOW() - INTERVAL '1 day', true, NOW() - INTERVAL '2 days');

  RAISE NOTICE 'Seeded for user: %', v_user_id;
END $$;
