-- ─────────────────────────────────────
-- Migration: Performance indexes for new tables
-- Date: 2026-03-14
-- ─────────────────────────────────────

BEGIN;

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_zones_tenant_location ON zones(tenant_id, location_id);
CREATE INDEX IF NOT EXISTS idx_instructor_availability_tenant_location ON instructor_availability(tenant_id, location_id);
CREATE INDEX IF NOT EXISTS idx_instructor_availability_zone ON instructor_availability(zone_id);

-- class_schedule indexes for new columns
CREATE INDEX IF NOT EXISTS idx_class_schedule_availability_id ON class_schedule(availability_id);
CREATE INDEX IF NOT EXISTS idx_class_schedule_is_appointment ON class_schedule(tenant_id, is_appointment) WHERE is_appointment = true;

-- Instructor location reverse lookup
CREATE INDEX IF NOT EXISTS idx_instructor_locations_location_tenant ON instructor_locations(location_id, tenant_id);

COMMIT;
