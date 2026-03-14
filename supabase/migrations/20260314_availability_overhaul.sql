-- Migration: Availability system overhaul
-- Adds buffer time support, allows "any instructor" availability,
-- and adds location-level default buffer times.

-- 1. Make instructor_id nullable for "anyone available" mode
ALTER TABLE instructor_availability ALTER COLUMN instructor_id DROP NOT NULL;

-- 2. Add buffer time (minutes between appointments)
ALTER TABLE instructor_availability
  ADD COLUMN IF NOT EXISTS buffer_mins INT NOT NULL DEFAULT 0;

-- 3. Add default buffer to locations (auto-fills when creating availability)
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS buffer_mins INT NOT NULL DEFAULT 0;

-- 4. Index for "any instructor" queries
CREATE INDEX IF NOT EXISTS idx_instructor_availability_any
  ON instructor_availability(tenant_id, day_of_week)
  WHERE instructor_id IS NULL;

-- 5. Update schema.sql comment: instructor_id is now nullable
COMMENT ON COLUMN instructor_availability.instructor_id IS 'NULL = any available instructor at this location';
COMMENT ON COLUMN instructor_availability.buffer_mins IS 'Minutes gap between appointments (travel/cleanup time)';
COMMENT ON COLUMN locations.buffer_mins IS 'Default buffer time for availability windows at this location';
