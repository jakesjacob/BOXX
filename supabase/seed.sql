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
DELETE FROM user_credits WHERE stripe_payment_id LIKE 'seed_%' OR stripe_payment_id LIKE 'direct_%' OR stripe_payment_id LIKE 'bert_seed_%';
DELETE FROM users WHERE email IN ('sarah@example.com','tom@example.com','mia@example.com','jake@example.com','luna@example.com','bertduff@gmail.com');
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

-- ─── BERT'S ACCOUNT (admin + heavy user) ────
-- Creates if not exists, promotes to admin if already signed in via Google
INSERT INTO users (id, email, name, bio, show_in_roster, role) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'bertduff@gmail.com', 'Bert S.', 'Founder. Glasgow-raised, Chiang Mai-based. Building BOXX.', true, 'admin')
ON CONFLICT (email) DO UPDATE SET role = 'admin', bio = 'Founder. Glasgow-raised, Chiang Mai-based. Building BOXX.';

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
   6, 1, 'cancelled'),
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

-- ALL 6 SPOTS FILLED in Day 2 BOXXBEGINNER (full class — you are NOT in it)
INSERT INTO bookings (user_id, class_schedule_id, status) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'c0000003-0000-0000-0000-000000000001', 'confirmed'),
  ('d2222222-2222-2222-2222-222222222222', 'c0000003-0000-0000-0000-000000000001', 'confirmed'),
  ('d3333333-3333-3333-3333-333333333333', 'c0000003-0000-0000-0000-000000000001', 'confirmed'),
  ('d4444444-4444-4444-4444-444444444444', 'c0000003-0000-0000-0000-000000000001', 'confirmed'),
  ('d5555555-5555-5555-5555-555555555555', 'c0000003-0000-0000-0000-000000000001', 'confirmed');

-- Sarah, Tom were in Day 3 BOXX&TRAIN (now cancelled by admin — credits returned)
INSERT INTO bookings (user_id, class_schedule_id, status, cancelled_at, credit_returned) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'c0000004-0000-0000-0000-000000000001', 'cancelled', NOW(), true),
  ('d2222222-2222-2222-2222-222222222222', 'c0000004-0000-0000-0000-000000000001', 'cancelled', NOW(), true);

-- Sarah, Tom in Day 3 BOXXINTER
INSERT INTO bookings (user_id, class_schedule_id, status) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'c0000004-0000-0000-0000-000000000002', 'confirmed'),
  ('d2222222-2222-2222-2222-222222222222', 'c0000004-0000-0000-0000-000000000002', 'confirmed');

-- ─── BERT'S DUMMY DATA (admin account with heavy usage history) ────

DO $$
DECLARE
  v_bert_id UUID;
  v_pack_10 UUID;
  v_pack_5 UUID;
  v_pack_1 UUID;
  v_pack_unlimited UUID;
BEGIN
  -- Look up Bert by email (works whether he signed in via Google or was seeded above)
  SELECT id INTO v_bert_id FROM users WHERE email = 'bertduff@gmail.com' LIMIT 1;
  IF v_bert_id IS NULL THEN
    RAISE NOTICE 'Bert not found — skipping';
    RETURN;
  END IF;

  SELECT id INTO v_pack_10 FROM class_packs WHERE credits = 10 AND NOT is_intro LIMIT 1;
  SELECT id INTO v_pack_5 FROM class_packs WHERE credits = 5 AND NOT is_intro LIMIT 1;
  SELECT id INTO v_pack_1 FROM class_packs WHERE credits = 1 AND NOT is_intro LIMIT 1;
  SELECT id INTO v_pack_unlimited FROM class_packs WHERE credits IS NULL LIMIT 1;

  -- ── CURRENT ACTIVE PACK: 10 credits, 7 remaining ──
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status, purchased_at)
  VALUES (v_bert_id, v_pack_10, 10, 7, NOW() + INTERVAL '45 days', 'bert_seed_001', 'active', NOW() - INTERVAL '15 days');

  -- ── PAST PACK 1: 10 credits, fully used, expired 2 months ago ──
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status, purchased_at)
  VALUES (v_bert_id, v_pack_10, 10, 0, NOW() - INTERVAL '60 days', 'bert_seed_002', 'active', NOW() - INTERVAL '120 days');

  -- ── PAST PACK 2: 5 credits, fully used, expired 4 months ago ──
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status, purchased_at)
  VALUES (v_bert_id, v_pack_5, 5, 0, NOW() - INTERVAL '120 days', 'bert_seed_003', 'active', NOW() - INTERVAL '150 days');

  -- ── PAST PACK 3: unlimited month, expired 5 months ago ──
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status, purchased_at)
  VALUES (v_bert_id, v_pack_unlimited, NULL, NULL, NOW() - INTERVAL '150 days', 'bert_seed_004', 'active', NOW() - INTERVAL '180 days');

  -- ── PAST PACK 4: 1 credit single, fully used, 6 months ago ──
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status, purchased_at)
  VALUES (v_bert_id, v_pack_1, 1, 0, NOW() - INTERVAL '180 days', 'bert_seed_005', 'active', NOW() - INTERVAL '210 days');

  -- ── PAST PACK 5: 10 credits, fully used, 8 months ago ──
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status, purchased_at)
  VALUES (v_bert_id, v_pack_10, 10, 0, NOW() - INTERVAL '240 days', 'bert_seed_006', 'active', NOW() - INTERVAL '300 days');

  -- Bert's upcoming bookings
  INSERT INTO bookings (user_id, class_schedule_id, status) VALUES
    (v_bert_id, 'c0000002-0000-0000-0000-000000000001', 'confirmed'),
    (v_bert_id, 'c0000003-0000-0000-0000-000000000001', 'confirmed'),  -- fills Day 2 BOXXBEGINNER to 6/6
    (v_bert_id, 'c0000003-0000-0000-0000-000000000002', 'confirmed'),
    (v_bert_id, 'c0000005-0000-0000-0000-000000000001', 'confirmed');

  -- Bert attended today's class
  INSERT INTO bookings (user_id, class_schedule_id, status, created_at) VALUES
    (v_bert_id, 'c0000001-0000-0000-0000-000000000001', 'attended', NOW() - INTERVAL '2 hours');

  -- Bert cancelled a class (Day 3 BOXX&TRAIN was admin-cancelled)
  INSERT INTO bookings (user_id, class_schedule_id, status, cancelled_at, credit_returned) VALUES
    (v_bert_id, 'c0000004-0000-0000-0000-000000000001', 'cancelled', NOW(), true);

  -- Bert past attended classes
  INSERT INTO bookings (user_id, class_schedule_id, status, created_at) VALUES
    (v_bert_id, 'c0000001-0000-0000-0000-000000000002', 'attended', NOW() - INTERVAL '1 day');

  RAISE NOTICE 'Seeded Bert account: %', v_bert_id;
END $$;

-- ─── YOUR ACCOUNT: CREDITS + BOOKINGS ────

DO $$
DECLARE
  v_user_id UUID;
  v_pack_10 UUID;
  v_pack_5 UUID;
  v_pack_1 UUID;
BEGIN
  SELECT id INTO v_user_id FROM users
    WHERE email NOT LIKE '%@example.com'
      AND email != 'bertduff@gmail.com'
    ORDER BY created_at ASC LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No real user found — skipping';
    RETURN;
  END IF;

  SELECT id INTO v_pack_10 FROM class_packs WHERE credits = 10 AND NOT is_intro LIMIT 1;
  SELECT id INTO v_pack_5 FROM class_packs WHERE credits = 5 AND NOT is_intro LIMIT 1;
  SELECT id INTO v_pack_1 FROM class_packs WHERE credits = 1 AND NOT is_intro LIMIT 1;

  -- Current active: 10 credits, 9 remaining
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status, purchased_at)
  VALUES (v_user_id, v_pack_10, 10, 9, NOW() + INTERVAL '60 days', 'seed_payment_001', 'active', NOW() - INTERVAL '5 days');

  -- Old expired pack: 5 credits, fully used, 2 months ago
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status, purchased_at)
  VALUES (v_user_id, v_pack_5, 5, 0, NOW() - INTERVAL '30 days', 'seed_payment_002', 'active', NOW() - INTERVAL '60 days');

  -- Old expired pack: 1 credit single, used, 3 months ago
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status, purchased_at)
  VALUES (v_user_id, v_pack_1, 1, 0, NOW() - INTERVAL '60 days', 'seed_payment_003', 'active', NOW() - INTERVAL '90 days');

  -- Upcoming: tomorrow's BOXXINTER
  INSERT INTO bookings (user_id, class_schedule_id, status) VALUES
    (v_user_id, 'c0000002-0000-0000-0000-000000000001', 'confirmed');

  -- Admin-cancelled: Day 3 BOXX&TRAIN was cancelled, credit returned
  INSERT INTO bookings (user_id, class_schedule_id, status, cancelled_at, credit_returned)
  VALUES (v_user_id, 'c0000004-0000-0000-0000-000000000001', 'cancelled', NOW(), true);

  -- Past: attended today's morning class
  INSERT INTO bookings (user_id, class_schedule_id, status, created_at)
  VALUES (v_user_id, 'c0000001-0000-0000-0000-000000000001', 'attended', NOW() - INTERVAL '2 hours');

  -- Past: cancelled yesterday
  INSERT INTO bookings (user_id, class_schedule_id, status, cancelled_at, credit_returned, created_at)
  VALUES (v_user_id, 'c0000001-0000-0000-0000-000000000003', 'cancelled', NOW() - INTERVAL '1 day', true, NOW() - INTERVAL '2 days');

  RAISE NOTICE 'Seeded for user: %', v_user_id;
END $$;
