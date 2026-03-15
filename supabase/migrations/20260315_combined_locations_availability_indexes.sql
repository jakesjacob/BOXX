-- ═══════════════════════════════════════════════════════════════
-- COMBINED MIGRATION: Locations, Zones, Availability, Indexes
--
-- Combines these 4 migrations into one runnable block:
--   20260313_locations_zones_availability.sql
--   20260314_availability_overhaul.sql
--   20260314_performance_indexes.sql
--   add_composite_indexes.sql
--
-- Safe to run — all statements use IF NOT EXISTS / IF EXISTS guards.
-- Run in Supabase SQL Editor as a single paste.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────
-- PART 1: Zones (areas within locations)
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS zones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  capacity    INT,
  description TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zones_tenant_id ON zones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_zones_location_id ON zones(location_id);

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public_read_zones') THEN
    CREATE POLICY "public_read_zones" ON zones FOR SELECT USING (true);
  END IF;
END $$;

-- ─────────────────────────────────────
-- PART 2: Instructor ↔ Location junction
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS instructor_locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  location_id   UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(instructor_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_instructor_locations_tenant ON instructor_locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_instructor_locations_instructor ON instructor_locations(instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_locations_location ON instructor_locations(location_id);

ALTER TABLE instructor_locations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public_read_instructor_locations') THEN
    CREATE POLICY "public_read_instructor_locations" ON instructor_locations FOR SELECT USING (true);
  END IF;
END $$;

-- ─────────────────────────────────────
-- PART 3: Instructor Availability (Calendly-style)
-- instructor_id nullable = "anyone available"
-- buffer_mins included from the start
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS instructor_availability (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instructor_id     UUID REFERENCES instructors(id) ON DELETE CASCADE,
  location_id       UUID REFERENCES locations(id) ON DELETE SET NULL,
  zone_id           UUID REFERENCES zones(id) ON DELETE SET NULL,
  day_of_week       INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  session_duration  INT NOT NULL DEFAULT 60,
  concurrent_slots  INT NOT NULL DEFAULT 1,
  credits_cost      INT NOT NULL DEFAULT 1,
  buffer_mins       INT NOT NULL DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_instructor_availability_tenant ON instructor_availability(tenant_id);
CREATE INDEX IF NOT EXISTS idx_instructor_availability_instructor ON instructor_availability(instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_availability_day ON instructor_availability(tenant_id, day_of_week);

ALTER TABLE instructor_availability ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public_read_instructor_availability') THEN
    CREATE POLICY "public_read_instructor_availability" ON instructor_availability FOR SELECT USING (true);
  END IF;
END $$;

COMMENT ON COLUMN instructor_availability.instructor_id IS 'NULL = any available instructor at this location';
COMMENT ON COLUMN instructor_availability.buffer_mins IS 'Minutes gap between appointments (travel/cleanup time)';

-- If table already existed from earlier migration, apply the overhaul changes:
-- Make instructor_id nullable (may already be nullable from CREATE above)
ALTER TABLE instructor_availability ALTER COLUMN instructor_id DROP NOT NULL;
-- Add buffer_mins if missing (may already exist from CREATE above)
ALTER TABLE instructor_availability ADD COLUMN IF NOT EXISTS buffer_mins INT NOT NULL DEFAULT 0;

-- ─────────────────────────────────────
-- PART 4: Instructor Unavailability (holidays/exceptions)
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS instructor_unavailability (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  reason        TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_instructor_unavailability_tenant ON instructor_unavailability(tenant_id);
CREATE INDEX IF NOT EXISTS idx_instructor_unavailability_instructor ON instructor_unavailability(instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_unavailability_dates ON instructor_unavailability(instructor_id, start_date, end_date);

ALTER TABLE instructor_unavailability ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public_read_instructor_unavailability') THEN
    CREATE POLICY "public_read_instructor_unavailability" ON instructor_unavailability FOR SELECT USING (true);
  END IF;
END $$;

-- ─────────────────────────────────────
-- PART 5: class_schedule new columns
-- ─────────────────────────────────────
ALTER TABLE class_schedule ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES zones(id) ON DELETE SET NULL;
ALTER TABLE class_schedule ADD COLUMN IF NOT EXISTS is_appointment BOOLEAN DEFAULT false;
ALTER TABLE class_schedule ADD COLUMN IF NOT EXISTS availability_id UUID REFERENCES instructor_availability(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_class_schedule_zone_id ON class_schedule(zone_id);

-- ─────────────────────────────────────
-- PART 6: locations.buffer_mins
-- ─────────────────────────────────────
ALTER TABLE locations ADD COLUMN IF NOT EXISTS buffer_mins INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN locations.buffer_mins IS 'Default buffer time for availability windows at this location';

-- ─────────────────────────────────────
-- PART 7: Feature flags & plan limits
-- ─────────────────────────────────────
INSERT INTO feature_flags (key, description, default_enabled, enabled_for_plans)
VALUES
  ('zones', 'Zones/areas within locations', false, '{growth,pro,enterprise}')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS max_zones INT NOT NULL DEFAULT 0;

UPDATE plan_limits SET max_zones = 0 WHERE plan = 'free';
UPDATE plan_limits SET max_zones = 5 WHERE plan = 'starter';
UPDATE plan_limits SET max_zones = 20 WHERE plan = 'growth';
UPDATE plan_limits SET max_zones = 50 WHERE plan = 'pro';
UPDATE plan_limits SET max_zones = 9999 WHERE plan = 'enterprise';

-- ─────────────────────────────────────
-- PART 8: Performance indexes (new tables)
-- ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_zones_tenant_location ON zones(tenant_id, location_id);
CREATE INDEX IF NOT EXISTS idx_instructor_availability_tenant_location ON instructor_availability(tenant_id, location_id);
CREATE INDEX IF NOT EXISTS idx_instructor_availability_zone ON instructor_availability(zone_id);
CREATE INDEX IF NOT EXISTS idx_instructor_availability_any ON instructor_availability(tenant_id, day_of_week) WHERE instructor_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_class_schedule_availability_id ON class_schedule(availability_id);
CREATE INDEX IF NOT EXISTS idx_class_schedule_is_appointment ON class_schedule(tenant_id, is_appointment) WHERE is_appointment = true;
CREATE INDEX IF NOT EXISTS idx_instructor_locations_location_tenant ON instructor_locations(location_id, tenant_id);

-- ─────────────────────────────────────
-- PART 9: Performance indexes (existing tables)
-- ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_status_created ON bookings(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_class_schedule_tenant_status_starts ON class_schedule(tenant_id, status, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_user_credits_tenant_status_expires ON user_credits(tenant_id, status, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_tenant_created ON page_views(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_tenant_created ON email_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_tenant_updated ON agent_conversations(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_tenant_created ON agent_messages(tenant_id, created_at DESC);

COMMIT;

-- ─────────────────────────────────────
-- VERIFICATION QUERIES (run after migration)
-- ─────────────────────────────────────
-- Uncomment and run these to verify everything applied:
--
-- SELECT 'zones' AS tbl, count(*) FROM zones
-- UNION ALL SELECT 'instructor_locations', count(*) FROM instructor_locations
-- UNION ALL SELECT 'instructor_availability', count(*) FROM instructor_availability
-- UNION ALL SELECT 'instructor_unavailability', count(*) FROM instructor_unavailability;
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'class_schedule' AND column_name IN ('zone_id', 'is_appointment', 'availability_id');
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'locations' AND column_name = 'buffer_mins';
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'plan_limits' AND column_name = 'max_zones';
--
-- SELECT * FROM feature_flags WHERE key = 'zones';
--
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE tablename IN ('zones','instructor_locations','instructor_availability','instructor_unavailability');
