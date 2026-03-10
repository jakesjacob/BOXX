-- ─────────────────────────────────────
-- BOXX Seed Data — Run in Supabase SQL Editor
-- First run: DELETE FROM to clean existing seed data
-- Then re-seeds with BOXX-branded class types
-- ─────────────────────────────────────

-- ─── CLEAN UP (safe — only removes seed data) ────
-- 1. Waitlist + bookings referencing seed schedule
DELETE FROM waitlist WHERE class_schedule_id::text LIKE 'c0000%' OR class_schedule_id::text LIKE 'c9990%';
DELETE FROM bookings WHERE class_schedule_id::text LIKE 'c0000%' OR class_schedule_id::text LIKE 'c9990%';
DELETE FROM bookings WHERE user_id IN (
  'd1111111-1111-1111-1111-111111111111',
  'd2222222-2222-2222-2222-222222222222',
  'd3333333-3333-3333-3333-333333333333',
  'd4444444-4444-4444-4444-444444444444',
  'd5555555-5555-5555-5555-555555555555'
);
-- 2. Seed schedule entries
DELETE FROM class_schedule WHERE id::text LIKE 'c0000%' OR id::text LIKE 'c9990%';
-- 3. ALL schedule entries referencing seed instructors/class_types (admin-created ones too)
DELETE FROM waitlist WHERE class_schedule_id IN (SELECT id FROM class_schedule WHERE instructor_id IN ('b1111111-1111-1111-1111-111111111111','b2222222-2222-2222-2222-222222222222','b3333333-3333-3333-3333-333333333333'));
DELETE FROM bookings WHERE class_schedule_id IN (SELECT id FROM class_schedule WHERE instructor_id IN ('b1111111-1111-1111-1111-111111111111','b2222222-2222-2222-2222-222222222222','b3333333-3333-3333-3333-333333333333'));
DELETE FROM class_schedule WHERE instructor_id IN ('b1111111-1111-1111-1111-111111111111','b2222222-2222-2222-2222-222222222222','b3333333-3333-3333-3333-333333333333');
DELETE FROM class_schedule WHERE class_type_id IN ('a1111111-1111-1111-1111-111111111111','a2222222-2222-2222-2222-222222222222','a3333333-3333-3333-3333-333333333333','a4444444-4444-4444-4444-444444444444','a5555555-5555-5555-5555-555555555555');
-- 4. Credits, users, instructors, class types
DELETE FROM user_credits WHERE stripe_payment_id LIKE 'seed_%' OR stripe_payment_id LIKE 'direct_%' OR stripe_payment_id LIKE 'bert_seed_%' OR stripe_payment_id LIKE 'test_seed_%' OR stripe_payment_id LIKE 'seed_j_%' OR stripe_payment_id LIKE 'seed_b_%' OR stripe_payment_id LIKE 'seed_t_%';
DELETE FROM users WHERE email IN ('sarah@example.com','tom@example.com','mia@example.com','jake@example.com','luna@example.com','bertduff@gmail.com','test@boxxthailand.com');
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

-- ─── TEST ACCOUNT (shareable login for anyone to test) ────
-- Email: test@boxxthailand.com | Password: boxxtest123
INSERT INTO users (id, email, name, bio, show_in_roster, role, password_hash) VALUES
  ('d6666666-6666-6666-6666-666666666666', 'test@boxxthailand.com', 'Test User', 'Demo account for testing BOXX.', true, 'member',
   '$2b$12$zDKgEOkopSp1ttz2rrnuy.WA.0a2n6x7YlbcwoNWcyWvcEaLSHAq.')
ON CONFLICT (email) DO UPDATE SET
  password_hash = '$2b$12$zDKgEOkopSp1ttz2rrnuy.WA.0a2n6x7YlbcwoNWcyWvcEaLSHAq.',
  name = 'Test User',
  bio = 'Demo account for testing BOXX.';

-- ─── BERT'S ACCOUNT (admin + heavy user) ────
INSERT INTO users (id, email, name, bio, show_in_roster, role) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'bertduff@gmail.com', 'Bert S.', 'Founder. Glasgow-raised, Chiang Mai-based. Building BOXX.', true, 'admin')
ON CONFLICT (email) DO UPDATE SET role = 'admin', bio = 'Founder. Glasgow-raised, Chiang Mai-based. Building BOXX.';


-- ═══════════════════════════════════════════════════════════════
-- SCHEDULE: PAST CLASSES (6 weeks of history for streaks/badges)
-- ═══════════════════════════════════════════════════════════════

-- Week -1 (3-7 days ago) — 4 classes
INSERT INTO class_schedule (id, class_type_id, instructor_id, starts_at, ends_at, capacity, status) VALUES
  ('c9990001-0000-0000-0000-000000000001', 'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   (CURRENT_DATE - INTERVAL '3 days' + INTERVAL '7 hours')::timestamptz,
   (CURRENT_DATE - INTERVAL '3 days' + INTERVAL '7 hours 55 minutes')::timestamptz, 6, 'active'),
  ('c9990001-0000-0000-0000-000000000002', 'a2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222',
   (CURRENT_DATE - INTERVAL '4 days' + INTERVAL '17 hours')::timestamptz,
   (CURRENT_DATE - INTERVAL '4 days' + INTERVAL '17 hours 55 minutes')::timestamptz, 6, 'active'),
  ('c9990001-0000-0000-0000-000000000003', 'a3333333-3333-3333-3333-333333333333', 'b3333333-3333-3333-3333-333333333333',
   (CURRENT_DATE - INTERVAL '5 days' + INTERVAL '9 hours')::timestamptz,
   (CURRENT_DATE - INTERVAL '5 days' + INTERVAL '9 hours 55 minutes')::timestamptz, 6, 'active'),
  ('c9990001-0000-0000-0000-000000000004', 'a4444444-4444-4444-4444-444444444444', 'b1111111-1111-1111-1111-111111111111',
   (CURRENT_DATE - INTERVAL '6 days' + INTERVAL '10 hours')::timestamptz,
   (CURRENT_DATE - INTERVAL '6 days' + INTERVAL '10 hours 55 minutes')::timestamptz, 10, 'active');

-- Week -2 (8-14 days ago) — 4 classes
INSERT INTO class_schedule (id, class_type_id, instructor_id, starts_at, ends_at, capacity, status) VALUES
  ('c9990002-0000-0000-0000-000000000001', 'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   (CURRENT_DATE - INTERVAL '10 days' + INTERVAL '7 hours')::timestamptz,
   (CURRENT_DATE - INTERVAL '10 days' + INTERVAL '7 hours 55 minutes')::timestamptz, 6, 'active'),
  ('c9990002-0000-0000-0000-000000000002', 'a3333333-3333-3333-3333-333333333333', 'b3333333-3333-3333-3333-333333333333',
   (CURRENT_DATE - INTERVAL '11 days' + INTERVAL '9 hours')::timestamptz,
   (CURRENT_DATE - INTERVAL '11 days' + INTERVAL '9 hours 55 minutes')::timestamptz, 6, 'active'),
  ('c9990002-0000-0000-0000-000000000003', 'a2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222',
   (CURRENT_DATE - INTERVAL '12 days' + INTERVAL '17 hours')::timestamptz,
   (CURRENT_DATE - INTERVAL '12 days' + INTERVAL '17 hours 55 minutes')::timestamptz, 6, 'active'),
  ('c9990002-0000-0000-0000-000000000004', 'a4444444-4444-4444-4444-444444444444', 'b1111111-1111-1111-1111-111111111111',
   (CURRENT_DATE - INTERVAL '13 days' + INTERVAL '10 hours')::timestamptz,
   (CURRENT_DATE - INTERVAL '13 days' + INTERVAL '10 hours 55 minutes')::timestamptz, 10, 'active');

-- Week -3 (15-21 days ago) — 3 classes
INSERT INTO class_schedule (id, class_type_id, instructor_id, starts_at, ends_at, capacity, status) VALUES
  ('c9990003-0000-0000-0000-000000000001', 'a2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111',
   (CURRENT_DATE - INTERVAL '17 days' + INTERVAL '7 hours')::timestamptz,
   (CURRENT_DATE - INTERVAL '17 days' + INTERVAL '7 hours 55 minutes')::timestamptz, 6, 'active'),
  ('c9990003-0000-0000-0000-000000000002', 'a1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222',
   (CURRENT_DATE - INTERVAL '19 days' + INTERVAL '7 hours')::timestamptz,
   (CURRENT_DATE - INTERVAL '19 days' + INTERVAL '7 hours 55 minutes')::timestamptz, 6, 'active'),
  ('c9990003-0000-0000-0000-000000000003', 'a3333333-3333-3333-3333-333333333333', 'b3333333-3333-3333-3333-333333333333',
   (CURRENT_DATE - INTERVAL '20 days' + INTERVAL '9 hours')::timestamptz,
   (CURRENT_DATE - INTERVAL '20 days' + INTERVAL '9 hours 55 minutes')::timestamptz, 6, 'active');

-- Week -4 (22-28 days ago) — 3 classes
INSERT INTO class_schedule (id, class_type_id, instructor_id, starts_at, ends_at, capacity, status) VALUES
  ('c9990004-0000-0000-0000-000000000001', 'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   (CURRENT_DATE - INTERVAL '24 days' + INTERVAL '7 hours')::timestamptz,
   (CURRENT_DATE - INTERVAL '24 days' + INTERVAL '7 hours 55 minutes')::timestamptz, 6, 'active'),
  ('c9990004-0000-0000-0000-000000000002', 'a2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222',
   (CURRENT_DATE - INTERVAL '25 days' + INTERVAL '17 hours')::timestamptz,
   (CURRENT_DATE - INTERVAL '25 days' + INTERVAL '17 hours 55 minutes')::timestamptz, 6, 'active'),
  ('c9990004-0000-0000-0000-000000000003', 'a3333333-3333-3333-3333-333333333333', 'b3333333-3333-3333-3333-333333333333',
   (CURRENT_DATE - INTERVAL '27 days' + INTERVAL '9 hours')::timestamptz,
   (CURRENT_DATE - INTERVAL '27 days' + INTERVAL '9 hours 55 minutes')::timestamptz, 6, 'active');

-- Week -5 (29-35 days ago) — 2 classes
INSERT INTO class_schedule (id, class_type_id, instructor_id, starts_at, ends_at, capacity, status) VALUES
  ('c9990005-0000-0000-0000-000000000001', 'a2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111',
   (CURRENT_DATE - INTERVAL '31 days' + INTERVAL '7 hours')::timestamptz,
   (CURRENT_DATE - INTERVAL '31 days' + INTERVAL '7 hours 55 minutes')::timestamptz, 6, 'active'),
  ('c9990005-0000-0000-0000-000000000002', 'a1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222',
   (CURRENT_DATE - INTERVAL '33 days' + INTERVAL '17 hours')::timestamptz,
   (CURRENT_DATE - INTERVAL '33 days' + INTERVAL '17 hours 55 minutes')::timestamptz, 6, 'active');

-- Week -6 (36-42 days ago) — 2 classes
INSERT INTO class_schedule (id, class_type_id, instructor_id, starts_at, ends_at, capacity, status) VALUES
  ('c9990006-0000-0000-0000-000000000001', 'a3333333-3333-3333-3333-333333333333', 'b3333333-3333-3333-3333-333333333333',
   (CURRENT_DATE - INTERVAL '38 days' + INTERVAL '9 hours')::timestamptz,
   (CURRENT_DATE - INTERVAL '38 days' + INTERVAL '9 hours 55 minutes')::timestamptz, 6, 'active'),
  ('c9990006-0000-0000-0000-000000000002', 'a4444444-4444-4444-4444-444444444444', 'b1111111-1111-1111-1111-111111111111',
   (CURRENT_DATE - INTERVAL '40 days' + INTERVAL '10 hours')::timestamptz,
   (CURRENT_DATE - INTERVAL '40 days' + INTERVAL '10 hours 55 minutes')::timestamptz, 10, 'active');


-- ═══════════════════════════════════════════════════════════════
-- SCHEDULE: UPCOMING CLASSES (next 7 days)
-- ═══════════════════════════════════════════════════════════════

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

-- DAY 5
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

-- DAY 6
INSERT INTO class_schedule (id, class_type_id, instructor_id, starts_at, ends_at, capacity, credits_cost, status) VALUES
  ('c0000007-0000-0000-0000-000000000001',
   'a3333333-3333-3333-3333-333333333333', 'b3333333-3333-3333-3333-333333333333',
   (CURRENT_DATE + INTERVAL '6 days 9 hours')::timestamptz,
   (CURRENT_DATE + INTERVAL '6 days 9 hours 55 minutes')::timestamptz,
   6, 1, 'active');


-- ═══════════════════════════════════════════════════════════════
-- DUMMY MEMBER BOOKINGS (roster population for upcoming classes)
-- ═══════════════════════════════════════════════════════════════

-- Today's BOXXBEGINNER: Sarah, Tom, Mia
INSERT INTO bookings (user_id, class_schedule_id, status) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'c0000001-0000-0000-0000-000000000001', 'confirmed'),
  ('d2222222-2222-2222-2222-222222222222', 'c0000001-0000-0000-0000-000000000001', 'confirmed'),
  ('d3333333-3333-3333-3333-333333333333', 'c0000001-0000-0000-0000-000000000001', 'confirmed');

-- Today's BOXXINTER: Jake, Luna
INSERT INTO bookings (user_id, class_schedule_id, status) VALUES
  ('d4444444-4444-4444-4444-444444444444', 'c0000001-0000-0000-0000-000000000003', 'confirmed'),
  ('d5555555-5555-5555-5555-555555555555', 'c0000001-0000-0000-0000-000000000003', 'confirmed');

-- Tomorrow BOXXINTER: Sarah
INSERT INTO bookings (user_id, class_schedule_id, status) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'c0000002-0000-0000-0000-000000000001', 'confirmed');

-- Day 2 BOXXBEGINNER: FULL (5 dummy members fill it)
INSERT INTO bookings (user_id, class_schedule_id, status) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'c0000003-0000-0000-0000-000000000001', 'confirmed'),
  ('d2222222-2222-2222-2222-222222222222', 'c0000003-0000-0000-0000-000000000001', 'confirmed'),
  ('d3333333-3333-3333-3333-333333333333', 'c0000003-0000-0000-0000-000000000001', 'confirmed'),
  ('d4444444-4444-4444-4444-444444444444', 'c0000003-0000-0000-0000-000000000001', 'confirmed'),
  ('d5555555-5555-5555-5555-555555555555', 'c0000003-0000-0000-0000-000000000001', 'confirmed');

-- Day 3 BOXX&TRAIN cancelled — Sarah & Tom had bookings
INSERT INTO bookings (user_id, class_schedule_id, status, cancelled_at, credit_returned) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'c0000004-0000-0000-0000-000000000001', 'cancelled', NOW(), true),
  ('d2222222-2222-2222-2222-222222222222', 'c0000004-0000-0000-0000-000000000001', 'cancelled', NOW(), true);

-- Day 3 BOXXINTER: Sarah, Tom
INSERT INTO bookings (user_id, class_schedule_id, status) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'c0000004-0000-0000-0000-000000000002', 'confirmed'),
  ('d2222222-2222-2222-2222-222222222222', 'c0000004-0000-0000-0000-000000000002', 'confirmed');


-- ═══════════════════════════════════════════════════════════════
-- JACOB (your account) — POWER USER
-- 5-week streak, 13 total classes, 3 class types tried
-- 2 active packs (one expiring soon), waitlisted, 1 late cancel
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_id UUID;
  v_pack_10 UUID; v_pack_5 UUID; v_pack_1 UUID; v_pack_unlimited UUID;
BEGIN
  SELECT id INTO v_id FROM users
    WHERE email NOT LIKE '%@example.com'
      AND email != 'bertduff@gmail.com'
      AND email != 'test@boxxthailand.com'
    ORDER BY created_at ASC LIMIT 1;
  IF v_id IS NULL THEN RAISE NOTICE 'No real user — skip'; RETURN; END IF;

  SELECT id INTO v_pack_10 FROM class_packs WHERE credits = 10 AND NOT is_intro LIMIT 1;
  SELECT id INTO v_pack_5 FROM class_packs WHERE credits = 5 AND NOT is_intro LIMIT 1;
  SELECT id INTO v_pack_1 FROM class_packs WHERE credits = 1 AND NOT is_intro LIMIT 1;
  SELECT id INTO v_pack_unlimited FROM class_packs WHERE credits IS NULL LIMIT 1;

  -- ACTIVE: 10-pack, 3 remaining, 30 days left
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status, purchased_at)
  VALUES (v_id, v_pack_10, 10, 3, NOW() + INTERVAL '30 days', 'seed_j_001', 'active', NOW() - INTERVAL '30 days');

  -- ACTIVE: 5-pack, 1 remaining, EXPIRING IN 4 DAYS
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status, purchased_at)
  VALUES (v_id, v_pack_5, 5, 1, NOW() + INTERVAL '4 days', 'seed_j_002', 'active', NOW() - INTERVAL '26 days');

  -- PAST: 10-pack used up
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status, purchased_at)
  VALUES (v_id, v_pack_10, 10, 0, NOW() - INTERVAL '60 days', 'seed_j_003', 'active', NOW() - INTERVAL '120 days');

  -- PAST: unlimited month
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status, purchased_at)
  VALUES (v_id, v_pack_unlimited, NULL, NULL, NOW() - INTERVAL '120 days', 'seed_j_004', 'active', NOW() - INTERVAL '150 days');

  -- PAST: single class
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status, purchased_at)
  VALUES (v_id, v_pack_1, 1, 0, NOW() - INTERVAL '150 days', 'seed_j_005', 'active', NOW() - INTERVAL '180 days');

  -- UPCOMING BOOKINGS: 4 future classes
  INSERT INTO bookings (user_id, class_schedule_id, status) VALUES
    (v_id, 'c0000002-0000-0000-0000-000000000001', 'confirmed'),  -- Tomorrow BOXXINTER
    (v_id, 'c0000003-0000-0000-0000-000000000002', 'confirmed'),  -- Day 2 BOXX&TRAIN
    (v_id, 'c0000005-0000-0000-0000-000000000001', 'confirmed'),  -- Day 4 BOXXBEGINNER
    (v_id, 'c0000006-0000-0000-0000-000000000002', 'confirmed');  -- Day 5 BOXXINTER

  -- WAITLIST: Day 2 BOXXBEGINNER is full, Jacob is #1
  INSERT INTO waitlist (user_id, class_schedule_id, position) VALUES
    (v_id, 'c0000003-0000-0000-0000-000000000001', 1);

  -- CANCELLED: admin-cancelled Day 3 BOXX&TRAIN
  INSERT INTO bookings (user_id, class_schedule_id, status, cancelled_at, credit_returned) VALUES
    (v_id, 'c0000004-0000-0000-0000-000000000001', 'cancelled', NOW(), true);

  -- LATE CANCEL: Day 3 BOXXINTER
  INSERT INTO bookings (user_id, class_schedule_id, status, cancelled_at, late_cancel, credit_returned) VALUES
    (v_id, 'c0000004-0000-0000-0000-000000000002', 'cancelled', NOW() - INTERVAL '2 hours', true, false);

  -- PAST ATTENDED: 13 classes across 5 weeks = strong streak + badges
  -- This week (today)
  INSERT INTO bookings (user_id, class_schedule_id, status, created_at) VALUES
    (v_id, 'c0000001-0000-0000-0000-000000000001', 'attended', NOW() - INTERVAL '3 hours');
  -- Week -1: 3 classes (BEGINNER, INTER, BOXX&TRAIN = 3 class types)
  INSERT INTO bookings (user_id, class_schedule_id, status, created_at) VALUES
    (v_id, 'c9990001-0000-0000-0000-000000000001', 'attended', NOW() - INTERVAL '3 days'),
    (v_id, 'c9990001-0000-0000-0000-000000000002', 'attended', NOW() - INTERVAL '4 days'),
    (v_id, 'c9990001-0000-0000-0000-000000000003', 'attended', NOW() - INTERVAL '5 days');
  -- Week -2: 2 classes
  INSERT INTO bookings (user_id, class_schedule_id, status, created_at) VALUES
    (v_id, 'c9990002-0000-0000-0000-000000000001', 'attended', NOW() - INTERVAL '10 days'),
    (v_id, 'c9990002-0000-0000-0000-000000000002', 'attended', NOW() - INTERVAL '11 days');
  -- Week -3: 2 classes
  INSERT INTO bookings (user_id, class_schedule_id, status, created_at) VALUES
    (v_id, 'c9990003-0000-0000-0000-000000000001', 'attended', NOW() - INTERVAL '17 days'),
    (v_id, 'c9990003-0000-0000-0000-000000000002', 'attended', NOW() - INTERVAL '19 days');
  -- Week -4: 2 classes
  INSERT INTO bookings (user_id, class_schedule_id, status, created_at) VALUES
    (v_id, 'c9990004-0000-0000-0000-000000000001', 'attended', NOW() - INTERVAL '24 days'),
    (v_id, 'c9990004-0000-0000-0000-000000000002', 'attended', NOW() - INTERVAL '25 days');
  -- Week -5: 2 classes
  INSERT INTO bookings (user_id, class_schedule_id, status, created_at) VALUES
    (v_id, 'c9990005-0000-0000-0000-000000000001', 'attended', NOW() - INTERVAL '31 days'),
    (v_id, 'c9990005-0000-0000-0000-000000000002', 'attended', NOW() - INTERVAL '33 days');

  RAISE NOTICE 'Jacob: % — 4 credits, 5wk streak, 13 classes, waitlisted, late cancel', v_id;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- BERT — ADMIN + ACTIVE MEMBER
-- 4-week streak, 9 total classes, mix of all 4 class types
-- 1 active pack (healthy), 3 past packs, upcoming bookings,
-- on waitlist, 1 normal cancel
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_id UUID;
  v_pack_10 UUID; v_pack_5 UUID; v_pack_unlimited UUID;
BEGIN
  SELECT id INTO v_id FROM users WHERE email = 'bertduff@gmail.com' LIMIT 1;
  IF v_id IS NULL THEN RAISE NOTICE 'Bert not found — skip'; RETURN; END IF;

  SELECT id INTO v_pack_10 FROM class_packs WHERE credits = 10 AND NOT is_intro LIMIT 1;
  SELECT id INTO v_pack_5 FROM class_packs WHERE credits = 5 AND NOT is_intro LIMIT 1;
  SELECT id INTO v_pack_unlimited FROM class_packs WHERE credits IS NULL LIMIT 1;

  -- ACTIVE: 10-pack, 6 remaining, 40 days left
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status, purchased_at)
  VALUES (v_id, v_pack_10, 10, 6, NOW() + INTERVAL '40 days', 'seed_b_001', 'active', NOW() - INTERVAL '20 days');

  -- PAST: 5-pack fully used
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status, purchased_at)
  VALUES (v_id, v_pack_5, 5, 0, NOW() - INTERVAL '30 days', 'seed_b_002', 'active', NOW() - INTERVAL '60 days');

  -- PAST: unlimited month
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status, purchased_at)
  VALUES (v_id, v_pack_unlimited, NULL, NULL, NOW() - INTERVAL '90 days', 'seed_b_003', 'active', NOW() - INTERVAL '120 days');

  -- PAST: 10-pack fully used
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status, purchased_at)
  VALUES (v_id, v_pack_10, 10, 0, NOW() - INTERVAL '150 days', 'seed_b_004', 'active', NOW() - INTERVAL '210 days');

  -- UPCOMING: 3 future classes
  INSERT INTO bookings (user_id, class_schedule_id, status) VALUES
    (v_id, 'c0000002-0000-0000-0000-000000000001', 'confirmed'),  -- Tomorrow BOXXINTER
    (v_id, 'c0000003-0000-0000-0000-000000000002', 'confirmed'),  -- Day 2 BOXX&TRAIN
    (v_id, 'c0000005-0000-0000-0000-000000000001', 'confirmed');  -- Day 4 BOXXBEGINNER

  -- WAITLIST: Day 2 BOXXBEGINNER full, Bert is #2
  INSERT INTO waitlist (user_id, class_schedule_id, position) VALUES
    (v_id, 'c0000003-0000-0000-0000-000000000001', 2);

  -- CANCELLED: admin-cancelled Day 3 BOXX&TRAIN (credit returned)
  INSERT INTO bookings (user_id, class_schedule_id, status, cancelled_at, credit_returned) VALUES
    (v_id, 'c0000004-0000-0000-0000-000000000001', 'cancelled', NOW(), true);

  -- NORMAL CANCEL: cancelled Day 5 BOXXBEGINNER with plenty of notice
  INSERT INTO bookings (user_id, class_schedule_id, status, cancelled_at, credit_returned, created_at) VALUES
    (v_id, 'c0000006-0000-0000-0000-000000000001', 'cancelled', NOW() - INTERVAL '2 days', true, NOW() - INTERVAL '5 days');

  -- PAST ATTENDED: 9 classes, 4 class types tried, 4-week streak
  -- This week
  INSERT INTO bookings (user_id, class_schedule_id, status, created_at) VALUES
    (v_id, 'c0000001-0000-0000-0000-000000000001', 'attended', NOW() - INTERVAL '3 hours'),
    (v_id, 'c0000001-0000-0000-0000-000000000002', 'attended', NOW() - INTERVAL '1 hour');
  -- Week -1: BEGINNER + JUNIORS (variety!)
  INSERT INTO bookings (user_id, class_schedule_id, status, created_at) VALUES
    (v_id, 'c9990001-0000-0000-0000-000000000001', 'attended', NOW() - INTERVAL '3 days'),
    (v_id, 'c9990001-0000-0000-0000-000000000004', 'attended', NOW() - INTERVAL '6 days');
  -- Week -2: BOXX&TRAIN + INTER
  INSERT INTO bookings (user_id, class_schedule_id, status, created_at) VALUES
    (v_id, 'c9990002-0000-0000-0000-000000000002', 'attended', NOW() - INTERVAL '11 days'),
    (v_id, 'c9990002-0000-0000-0000-000000000003', 'attended', NOW() - INTERVAL '12 days');
  -- Week -3: BOXXINTER
  INSERT INTO bookings (user_id, class_schedule_id, status, created_at) VALUES
    (v_id, 'c9990003-0000-0000-0000-000000000001', 'attended', NOW() - INTERVAL '17 days');
  -- Week -5 (gap at week -4 = streak broken before that)
  INSERT INTO bookings (user_id, class_schedule_id, status, created_at) VALUES
    (v_id, 'c9990005-0000-0000-0000-000000000001', 'attended', NOW() - INTERVAL '31 days'),
    (v_id, 'c9990006-0000-0000-0000-000000000001', 'attended', NOW() - INTERVAL '38 days');

  RAISE NOTICE 'Bert: % — 6 credits, 4wk streak (broken before), 9 classes, waitlisted, 1 cancel', v_id;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- TEST USER — RETURNING MEMBER WITH MIXED HISTORY
-- 3-week streak (current), 7 total classes, 2 class types
-- 1 active pack (2 credits, expiring in 8 days), past intro pack
-- Upcoming bookings, on waitlist, 1 late cancel in past
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_id UUID;
  v_pack_5 UUID; v_pack_intro UUID; v_pack_1 UUID;
BEGIN
  SELECT id INTO v_id FROM users WHERE email = 'test@boxxthailand.com' LIMIT 1;
  IF v_id IS NULL THEN RAISE NOTICE 'Test user not found — skip'; RETURN; END IF;

  SELECT id INTO v_pack_5 FROM class_packs WHERE credits = 5 AND NOT is_intro LIMIT 1;
  SELECT id INTO v_pack_1 FROM class_packs WHERE credits = 1 AND NOT is_intro LIMIT 1;
  SELECT id INTO v_pack_intro FROM class_packs WHERE is_intro = true LIMIT 1;

  -- ACTIVE: 5-pack, 2 remaining, expiring in 8 days
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status, purchased_at)
  VALUES (v_id, v_pack_5, 5, 2, NOW() + INTERVAL '8 days', 'seed_t_001', 'active', NOW() - INTERVAL '22 days');

  -- PAST: intro 1-class pack, used 3 months ago
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status, purchased_at)
  VALUES (v_id, v_pack_intro, 1, 0, NOW() - INTERVAL '60 days', 'seed_t_002', 'active', NOW() - INTERVAL '90 days');

  -- PAST: single class, used 2 months ago
  INSERT INTO user_credits (user_id, class_pack_id, credits_total, credits_remaining, expires_at, stripe_payment_id, status, purchased_at)
  VALUES (v_id, v_pack_1, 1, 0, NOW() - INTERVAL '45 days', 'seed_t_003', 'active', NOW() - INTERVAL '75 days');

  -- UPCOMING: 2 future classes
  INSERT INTO bookings (user_id, class_schedule_id, status) VALUES
    (v_id, 'c0000002-0000-0000-0000-000000000002', 'confirmed'),  -- Tomorrow BOXXBEGINNER evening
    (v_id, 'c0000005-0000-0000-0000-000000000002', 'confirmed');  -- Day 4 BOXX&TRAIN

  -- WAITLIST: Day 5 BOXXBEGINNER, position #1
  INSERT INTO waitlist (user_id, class_schedule_id, position) VALUES
    (v_id, 'c0000006-0000-0000-0000-000000000001', 1);

  -- CANCELLED: admin-cancelled Day 3 BOXX&TRAIN
  INSERT INTO bookings (user_id, class_schedule_id, status, cancelled_at, credit_returned) VALUES
    (v_id, 'c0000004-0000-0000-0000-000000000001', 'cancelled', NOW(), true);

  -- LATE CANCEL: cancelled Day 2 BOXX&TRAIN too late
  INSERT INTO bookings (user_id, class_schedule_id, status, cancelled_at, late_cancel, credit_returned, created_at) VALUES
    (v_id, 'c0000003-0000-0000-0000-000000000003', 'cancelled', NOW() - INTERVAL '1 day', true, false, NOW() - INTERVAL '3 days');

  -- NORMAL CANCEL: cancelled Day 6 BOXX&TRAIN with time
  INSERT INTO bookings (user_id, class_schedule_id, status, cancelled_at, credit_returned, created_at) VALUES
    (v_id, 'c0000007-0000-0000-0000-000000000001', 'cancelled', NOW() - INTERVAL '3 days', true, NOW() - INTERVAL '5 days');

  -- PAST ATTENDED: 7 classes, 3-week current streak
  -- This week
  INSERT INTO bookings (user_id, class_schedule_id, status, created_at) VALUES
    (v_id, 'c0000001-0000-0000-0000-000000000002', 'attended', NOW() - INTERVAL '1 hour');
  -- Week -1: 2 classes
  INSERT INTO bookings (user_id, class_schedule_id, status, created_at) VALUES
    (v_id, 'c9990001-0000-0000-0000-000000000002', 'attended', NOW() - INTERVAL '4 days'),
    (v_id, 'c9990001-0000-0000-0000-000000000003', 'attended', NOW() - INTERVAL '5 days');
  -- Week -2: 1 class
  INSERT INTO bookings (user_id, class_schedule_id, status, created_at) VALUES
    (v_id, 'c9990002-0000-0000-0000-000000000001', 'attended', NOW() - INTERVAL '10 days');
  -- (gap at week -3 = 3-week current streak)
  -- Week -4: 1 class (before the gap)
  INSERT INTO bookings (user_id, class_schedule_id, status, created_at) VALUES
    (v_id, 'c9990004-0000-0000-0000-000000000003', 'attended', NOW() - INTERVAL '27 days');
  -- Week -5-6: 2 classes (early days, intro pack era)
  INSERT INTO bookings (user_id, class_schedule_id, status, created_at) VALUES
    (v_id, 'c9990005-0000-0000-0000-000000000002', 'attended', NOW() - INTERVAL '33 days'),
    (v_id, 'c9990006-0000-0000-0000-000000000002', 'attended', NOW() - INTERVAL '40 days');

  RAISE NOTICE 'Test User: % — 2 credits (8d), 3wk streak, 7 classes, waitlisted, late cancel', v_id;
END $$;
