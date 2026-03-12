-- ─────────────────────────────────────
-- Studio SaaS — Full Database Schema
-- Multi-tenant with Row Level Security
-- ─────────────────────────────────────

-- ─────────────────────────────────────
-- TENANTS
-- ─────────────────────────────────────
CREATE TABLE tenants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  slug           TEXT UNIQUE NOT NULL,
  custom_domain  TEXT UNIQUE,
  vertical       TEXT NOT NULL DEFAULT 'boxing',
  plan           TEXT NOT NULL DEFAULT 'free',
  logo_url       TEXT,
  primary_color  TEXT DEFAULT '#c8a750',
  timezone       TEXT DEFAULT 'UTC',
  currency       TEXT DEFAULT 'USD',
  stripe_customer_id TEXT,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_custom_domain ON tenants(custom_domain) WHERE custom_domain IS NOT NULL;

-- ─────────────────────────────────────
-- LOCATIONS
-- ─────────────────────────────────────
CREATE TABLE locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  address     TEXT,
  city        TEXT,
  country     TEXT,
  phone       TEXT,
  timezone    TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_locations_tenant_id ON locations(tenant_id);

-- ─────────────────────────────────────
-- USERS
-- ─────────────────────────────────────
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  email           TEXT NOT NULL,
  name            TEXT,
  phone           TEXT,
  avatar_url      TEXT,
  bio             TEXT,
  show_in_roster  BOOLEAN DEFAULT true,
  role            TEXT DEFAULT 'member',
  google_id       TEXT,
  password_hash   TEXT,
  stripe_customer_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_tenant_email ON users(tenant_id, email);

-- ─────────────────────────────────────
-- STAFF-TENANT MEMBERSHIP
-- ─────────────────────────────────────
CREATE TABLE staff_tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member',
  location_ids UUID[] DEFAULT '{}',
  invited_at  TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ DEFAULT now(),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX idx_staff_tenants_user_id ON staff_tenants(user_id);
CREATE INDEX idx_staff_tenants_tenant_id ON staff_tenants(tenant_id);

-- ─────────────────────────────────────
-- AUTH TABLES
-- ─────────────────────────────────────
CREATE TABLE password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE login_attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id),
  email         TEXT NOT NULL,
  ip_address    TEXT,
  success       BOOLEAN,
  attempted_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_login_attempts_email ON login_attempts(email);

-- ─────────────────────────────────────
-- CLASS TYPES
-- ─────────────────────────────────────
CREATE TABLE class_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  name          TEXT NOT NULL,
  description   TEXT,
  duration_mins INT DEFAULT 60,
  color         TEXT,
  icon          TEXT,
  image_url     TEXT,
  is_private    BOOLEAN DEFAULT false,
  active        BOOLEAN DEFAULT true
);

CREATE INDEX idx_class_types_tenant_id ON class_types(tenant_id);

-- ─────────────────────────────────────
-- INSTRUCTORS
-- ─────────────────────────────────────
CREATE TABLE instructors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  name          TEXT NOT NULL,
  bio           TEXT,
  photo_url     TEXT,
  instagram_url TEXT,
  active        BOOLEAN DEFAULT true
);

CREATE INDEX idx_instructors_tenant_id ON instructors(tenant_id);

-- ─────────────────────────────────────
-- CLASS SCHEDULE
-- ─────────────────────────────────────
CREATE TABLE class_schedule (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  location_id       UUID REFERENCES locations(id),
  class_type_id     UUID REFERENCES class_types(id),
  instructor_id     UUID REFERENCES instructors(id),
  starts_at         TIMESTAMPTZ NOT NULL,
  ends_at           TIMESTAMPTZ NOT NULL,
  capacity          INT DEFAULT 6,
  credits_cost      INT DEFAULT 1,
  status            TEXT DEFAULT 'active',
  notes             TEXT,
  recurring_id      UUID,
  is_private        BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_class_schedule_starts_at ON class_schedule(starts_at);
CREATE INDEX idx_class_schedule_tenant_id ON class_schedule(tenant_id);
CREATE INDEX idx_class_schedule_location_id ON class_schedule(location_id);
CREATE INDEX idx_class_schedule_tenant_starts ON class_schedule(tenant_id, starts_at);

-- ─────────────────────────────────────
-- CLASS PACKS
-- ─────────────────────────────────────
CREATE TABLE class_packs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  name              TEXT NOT NULL,
  description       TEXT,
  credits           INT,
  validity_days     INT,
  price_thb         INT NOT NULL,
  stripe_price_id   TEXT,
  stripe_product_id TEXT,
  is_membership     BOOLEAN DEFAULT false,
  is_intro          BOOLEAN DEFAULT false,
  badge_text        TEXT,
  active            BOOLEAN DEFAULT true,
  display_order     INT DEFAULT 0
);

CREATE INDEX idx_class_packs_tenant_id ON class_packs(tenant_id);

-- ─────────────────────────────────────
-- USER CREDITS
-- ─────────────────────────────────────
CREATE TABLE user_credits (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  class_pack_id       UUID REFERENCES class_packs(id),
  credits_total       INT,
  credits_remaining   INT,
  expires_at          TIMESTAMPTZ,
  stripe_payment_id   TEXT,
  stripe_sub_id       TEXT,
  status              TEXT DEFAULT 'active',
  expiry_warned       BOOLEAN DEFAULT false,
  purchased_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX idx_user_credits_status ON user_credits(status);
CREATE INDEX idx_user_credits_tenant_id ON user_credits(tenant_id);
CREATE INDEX idx_user_credits_tenant_status ON user_credits(tenant_id, status);

CREATE UNIQUE INDEX idx_user_credits_stripe_payment_id
  ON user_credits(stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;

-- ─────────────────────────────────────
-- BOOKINGS
-- ─────────────────────────────────────
CREATE TABLE bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  class_schedule_id UUID REFERENCES class_schedule(id),
  credit_id         UUID REFERENCES user_credits(id),
  status            TEXT DEFAULT 'confirmed',
  late_cancel       BOOLEAN DEFAULT false,
  credit_returned   BOOLEAN DEFAULT false,
  reminder_24h_sent BOOLEAN DEFAULT false,
  reminder_2h_sent  BOOLEAN DEFAULT false,
  cancelled_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_class_schedule_id ON bookings(class_schedule_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX idx_bookings_tenant_status ON bookings(tenant_id, status);

-- ─────────────────────────────────────
-- WAITLIST
-- ─────────────────────────────────────
CREATE TABLE waitlist (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  class_schedule_id UUID REFERENCES class_schedule(id),
  position          INT NOT NULL,
  notified          BOOLEAN DEFAULT false,
  notified_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, class_schedule_id)
);

CREATE INDEX idx_waitlist_class_schedule_id ON waitlist(class_schedule_id);
CREATE INDEX idx_waitlist_tenant_id ON waitlist(tenant_id);

-- ─────────────────────────────────────
-- ADMIN AUDIT LOG
-- ─────────────────────────────────────
CREATE TABLE admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id),
  admin_id    UUID REFERENCES users(id),
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   UUID,
  details     JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_tenant_id ON admin_audit_log(tenant_id);

-- ─────────────────────────────────────
-- STUDIO SETTINGS (per-tenant key-value)
-- ─────────────────────────────────────
CREATE TABLE studio_settings (
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  key       TEXT NOT NULL,
  value     TEXT,
  PRIMARY KEY (tenant_id, key)
);

-- ─────────────────────────────────────
-- AGENT CONVERSATIONS
-- ─────────────────────────────────────
CREATE TABLE agent_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title       TEXT NOT NULL DEFAULT 'New conversation',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_conversations_user_id ON agent_conversations(user_id);
CREATE INDEX idx_agent_conversations_updated_at ON agent_conversations(updated_at DESC);
CREATE INDEX idx_agent_conversations_tenant_id ON agent_conversations(tenant_id);

-- ─────────────────────────────────────
-- AGENT MESSAGES
-- ─────────────────────────────────────
CREATE TABLE agent_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID REFERENCES tenants(id),
  conversation_id  UUID REFERENCES agent_conversations(id) ON DELETE CASCADE NOT NULL,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT NOT NULL,
  tool_results     JSONB,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_messages_conversation_id ON agent_messages(conversation_id);

-- ─────────────────────────────────────
-- AGENT MEMORY
-- ─────────────────────────────────────
CREATE TABLE agent_memory (
  tenant_id   UUID REFERENCES tenants(id),
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  patterns    JSONB DEFAULT '[]'::jsonb,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────
-- AGENT USAGE TRACKING
-- ─────────────────────────────────────
CREATE TABLE agent_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  month           TEXT NOT NULL,
  input_tokens    BIGINT DEFAULT 0,
  output_tokens   BIGINT DEFAULT 0,
  cost_usd        NUMERIC(10,6) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month)
);

CREATE INDEX idx_agent_usage_user_month ON agent_usage(user_id, month);
CREATE INDEX idx_agent_usage_tenant_id ON agent_usage(tenant_id);

-- ─────────────────────────────────────
-- EMAIL LOG
-- ─────────────────────────────────────
CREATE TABLE email_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id),
  email_type  TEXT NOT NULL,
  recipient   TEXT NOT NULL,
  subject     TEXT,
  status      TEXT NOT NULL DEFAULT 'sent',
  error       TEXT,
  resend_id   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_email_log_created_at ON email_log(created_at DESC);
CREATE INDEX idx_email_log_email_type ON email_log(email_type);
CREATE INDEX idx_email_log_tenant_id ON email_log(tenant_id);

-- ─────────────────────────────────────
-- PAGE VIEW ANALYTICS
-- ─────────────────────────────────────
CREATE TABLE page_views (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id),
  path         TEXT NOT NULL,
  referrer     TEXT,
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  device_type  TEXT DEFAULT 'desktop',
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_page_views_created_at ON page_views(created_at DESC);
CREATE INDEX idx_page_views_path ON page_views(path);

-- ─────────────────────────────────────
-- PLAN LIMITS (reference table)
-- ─────────────────────────────────────
CREATE TABLE plan_limits (
  plan              TEXT PRIMARY KEY,
  max_locations     INT NOT NULL,
  max_members       INT NOT NULL,
  max_ai_queries    INT NOT NULL,
  max_classes_month INT NOT NULL DEFAULT 9999,
  max_instructors   INT NOT NULL DEFAULT 9999,
  max_class_types   INT NOT NULL DEFAULT 9999,
  max_packs         INT NOT NULL DEFAULT 9999
);

-- ─────────────────────────────────────
-- FEATURE FLAGS
-- ─────────────────────────────────────
CREATE TABLE feature_flags (
  key               TEXT PRIMARY KEY,
  description       TEXT,
  default_enabled   BOOLEAN DEFAULT false,
  enabled_for_plans TEXT[] DEFAULT '{}',
  is_killed         BOOLEAN DEFAULT false,
  rollout_pct       INT DEFAULT 100,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tenant_feature_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  flag_key    TEXT NOT NULL REFERENCES feature_flags(key) ON DELETE CASCADE,
  enabled     BOOLEAN NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, flag_key)
);

CREATE INDEX idx_tenant_feature_flags_tenant_id ON tenant_feature_flags(tenant_id);

-- ─────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_feature_flags ENABLE ROW LEVEL SECURITY;

-- Public read for reference/public data
CREATE POLICY "public_read_tenants" ON tenants FOR SELECT USING (true);
CREATE POLICY "public_read_locations" ON locations FOR SELECT USING (true);
CREATE POLICY "public_read_class_types" ON class_types FOR SELECT USING (true);
CREATE POLICY "public_read_instructors" ON instructors FOR SELECT USING (true);
CREATE POLICY "public_read_class_schedule" ON class_schedule FOR SELECT USING (true);
CREATE POLICY "public_read_class_packs" ON class_packs FOR SELECT USING (true);
CREATE POLICY "public_read_studio_settings" ON studio_settings FOR SELECT USING (true);
CREATE POLICY "public_read_plan_limits" ON plan_limits FOR SELECT USING (true);
CREATE POLICY "public_read_feature_flags" ON feature_flags FOR SELECT USING (true);
CREATE POLICY "public_read_tenant_flags" ON tenant_feature_flags FOR SELECT USING (true);

-- Users can read their own record
CREATE POLICY "users_own_record" ON users FOR ALL USING (auth.uid() = id);

-- Bookings: users can read/write their own
CREATE POLICY "bookings_own" ON bookings FOR ALL USING (auth.uid() = user_id);

-- Credits: users can read their own
CREATE POLICY "credits_own_read" ON user_credits FOR SELECT USING (auth.uid() = user_id);

-- Waitlist: users can manage their own
CREATE POLICY "waitlist_own" ON waitlist FOR ALL USING (auth.uid() = user_id);

-- Staff tenants: users can read their own memberships
CREATE POLICY "staff_own_read" ON staff_tenants FOR SELECT USING (auth.uid() = user_id);

-- ─────────────────────────────────────
-- FUNCTIONS (atomic credit operations)
-- ─────────────────────────────────────

CREATE OR REPLACE FUNCTION deduct_credit(credit_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  rows_affected INT;
BEGIN
  UPDATE user_credits
  SET credits_remaining = credits_remaining - 1
  WHERE id = credit_id
    AND credits_remaining > 0;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION restore_credit(credit_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_credits
  SET credits_remaining = credits_remaining + 1
  WHERE id = credit_id
    AND credits_remaining IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_agent_usage(
  p_user_id UUID,
  p_month TEXT,
  p_input_tokens BIGINT,
  p_output_tokens BIGINT,
  p_cost NUMERIC
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO agent_usage (user_id, month, input_tokens, output_tokens, cost_usd)
  VALUES (p_user_id, p_month, p_input_tokens, p_output_tokens, p_cost)
  ON CONFLICT (user_id, month)
  DO UPDATE SET
    input_tokens = agent_usage.input_tokens + EXCLUDED.input_tokens,
    output_tokens = agent_usage.output_tokens + EXCLUDED.output_tokens,
    cost_usd = agent_usage.cost_usd + EXCLUDED.cost_usd,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────
-- COMPOSITE INDEXES FOR PERFORMANCE
-- ─────────────────────────────────────

-- Bookings: dashboard timeline, week-over-week, monthly comparisons
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_status_created ON bookings(tenant_id, status, created_at DESC);

-- Class schedule: filtered by status + date range (admin dashboard, cron)
CREATE INDEX IF NOT EXISTS idx_class_schedule_tenant_status_starts ON class_schedule(tenant_id, status, starts_at DESC);

-- Users: member counts, signups by tenant + role
CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role);

-- User credits: active credits lookup (dashboard, waitlist, booking)
CREATE INDEX IF NOT EXISTS idx_user_credits_tenant_status_expires ON user_credits(tenant_id, status, expires_at DESC);

-- Page views: analytics queries by tenant + date
CREATE INDEX IF NOT EXISTS idx_page_views_tenant_created ON page_views(tenant_id, created_at DESC);

-- Email log: tenant-scoped email history
CREATE INDEX IF NOT EXISTS idx_email_log_tenant_created ON email_log(tenant_id, created_at DESC);

-- Agent conversations: sorted by recency per tenant
CREATE INDEX IF NOT EXISTS idx_agent_conversations_tenant_updated ON agent_conversations(tenant_id, updated_at DESC);

-- Agent messages: daily usage counting
CREATE INDEX IF NOT EXISTS idx_agent_messages_tenant_created ON agent_messages(tenant_id, created_at DESC);
