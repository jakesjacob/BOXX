-- ─────────────────────────────────────
-- Test Tenant #2 — "TenantTest"
-- Used for multi-tenant isolation validation.
-- Run AFTER the multi-tenant migration and main seed data.
-- ─────────────────────────────────────

-- Clean up any previous test tenant #2 data
DELETE FROM waitlist WHERE tenant_id = 'a0000000-0000-0000-0000-000000000002';
DELETE FROM bookings WHERE tenant_id = 'a0000000-0000-0000-0000-000000000002';
DELETE FROM user_credits WHERE tenant_id = 'a0000000-0000-0000-0000-000000000002';
DELETE FROM class_schedule WHERE tenant_id = 'a0000000-0000-0000-0000-000000000002';
DELETE FROM staff_tenants WHERE tenant_id = 'a0000000-0000-0000-0000-000000000002';
DELETE FROM users WHERE tenant_id = 'a0000000-0000-0000-0000-000000000002';
DELETE FROM instructors WHERE tenant_id = 'a0000000-0000-0000-0000-000000000002';
DELETE FROM class_types WHERE tenant_id = 'a0000000-0000-0000-0000-000000000002';
DELETE FROM class_packs WHERE tenant_id = 'a0000000-0000-0000-0000-000000000002';
DELETE FROM studio_settings WHERE tenant_id = 'a0000000-0000-0000-0000-000000000002';
DELETE FROM tenant_feature_flags WHERE tenant_id = 'a0000000-0000-0000-0000-000000000002';
DELETE FROM locations WHERE tenant_id = 'a0000000-0000-0000-0000-000000000002';
DELETE FROM tenants WHERE id = 'a0000000-0000-0000-0000-000000000002';

-- ─── Tenant ───
INSERT INTO tenants (id, name, slug, vertical, plan, timezone, currency, primary_color, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000002',
  'TenantTest',
  'tenanttest',
  'fitness',
  'starter',
  'Europe/London',
  'GBP',
  '#3b82f6',
  true
);

-- ─── Location ───
INSERT INTO locations (id, tenant_id, name, address, city, country, phone, timezone)
VALUES (
  'b0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000002',
  'TenantTest HQ',
  '1 Test Street',
  'London',
  'UK',
  '+44 20 1234 5678',
  'Europe/London'
);

-- ─── Feature flags (enable all for testing) ───
INSERT INTO tenant_feature_flags (tenant_id, flag_key, enabled)
SELECT 'a0000000-0000-0000-0000-000000000002', key, true
FROM feature_flags;

-- ─── Owner ───
INSERT INTO users (id, tenant_id, email, name, role, password_hash)
VALUES (
  'e0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'owner@tenanttest.com',
  'TenantTest Owner',
  'owner',
  -- password: "test1234"
  '$2a$10$8K1p/a0dR1xqM8KJF1OagOEFzGDG7bA4KXm5kEqRvKr.9MqNWCKS2'
);

INSERT INTO staff_tenants (user_id, tenant_id, role)
VALUES ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'owner');

-- ─── Member ───
INSERT INTO users (id, tenant_id, email, name, role, password_hash)
VALUES (
  'e0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000002',
  'member@tenanttest.com',
  'TenantTest Member',
  'member',
  '$2a$10$8K1p/a0dR1xqM8KJF1OagOEFzGDG7bA4KXm5kEqRvKr.9MqNWCKS2'
);

INSERT INTO staff_tenants (user_id, tenant_id, role)
VALUES ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'member');

-- ─── Class Types ───
INSERT INTO class_types (id, tenant_id, name, description, color, active) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'HIIT Blast', 'High intensity interval training', '#ef4444', true),
  ('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Yoga Flow', 'Relaxing yoga session', '#22c55e', true);

-- ─── Instructors ───
INSERT INTO instructors (id, tenant_id, name, bio, active) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Coach Zoe', 'HIIT specialist', true),
  ('f1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Coach Alex', 'Yoga instructor', true);

-- ─── Class Packs ───
INSERT INTO class_packs (id, tenant_id, name, credits, price_thb, validity_days, active) VALUES
  ('f2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', '5-Class Pack', 5, 2500, 30, true),
  ('f2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', '10-Class Pack', 10, 4500, 60, true);

-- ─── Schedule (a few future classes) ───
INSERT INTO class_schedule (id, tenant_id, location_id, class_type_id, instructor_id, starts_at, ends_at, capacity, status) VALUES
  ('f3000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002',
   'f0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
   CURRENT_DATE + INTERVAL '1 day' + TIME '09:00', CURRENT_DATE + INTERVAL '1 day' + TIME '10:00', 15, 'active'),
  ('f3000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002',
   'f0000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000002',
   CURRENT_DATE + INTERVAL '2 days' + TIME '17:00', CURRENT_DATE + INTERVAL '2 days' + TIME '18:00', 20, 'active');

-- ─── Credits for the member ───
INSERT INTO user_credits (id, tenant_id, user_id, class_pack_id, credits_total, credits_remaining, expires_at, status, stripe_payment_id)
VALUES (
  'f4000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'e0000000-0000-0000-0000-000000000002',
  'f2000000-0000-0000-0000-000000000001',
  5, 5,
  CURRENT_DATE + INTERVAL '30 days',
  'active',
  'seed_tenanttest_001'
);

-- ─── A booking for the member ───
INSERT INTO bookings (id, tenant_id, user_id, class_schedule_id, credit_id, status)
VALUES (
  'f5000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'e0000000-0000-0000-0000-000000000002',
  'f3000000-0000-0000-0000-000000000001',
  'f4000000-0000-0000-0000-000000000001',
  'confirmed'
);

-- ─── Studio settings ───
INSERT INTO studio_settings (tenant_id, key, value) VALUES
  ('a0000000-0000-0000-0000-000000000002', 'studio_name', 'TenantTest'),
  ('a0000000-0000-0000-0000-000000000002', 'cancellation_window_hours', '12');
