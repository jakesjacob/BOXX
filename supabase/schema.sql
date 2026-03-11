-- ─────────────────────────────────────
-- BOXX Full Database Schema
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────

-- ─────────────────────────────────────
-- USERS
-- ─────────────────────────────────────
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  name            TEXT,
  phone           TEXT,
  avatar_url      TEXT,
  bio             TEXT,
  show_in_roster  BOOLEAN DEFAULT true,
  role            TEXT DEFAULT 'member',
  google_id       TEXT,
  password_hash   TEXT,
  stripe_customer_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────
-- AUTH TABLES
-- ─────────────────────────────────────
CREATE TABLE password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE login_attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  ip_address    TEXT,
  success       BOOLEAN,
  attempted_at  TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────
-- CLASS TYPES
-- ─────────────────────────────────────
CREATE TABLE class_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  duration_mins INT DEFAULT 60,
  color         TEXT,
  icon          TEXT,
  is_private    BOOLEAN DEFAULT false,
  active        BOOLEAN DEFAULT true
);

-- ─────────────────────────────────────
-- INSTRUCTORS
-- ─────────────────────────────────────
CREATE TABLE instructors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  bio           TEXT,
  photo_url     TEXT,
  instagram_url TEXT,
  active        BOOLEAN DEFAULT true
);

-- ─────────────────────────────────────
-- CLASS SCHEDULE
-- ─────────────────────────────────────
CREATE TABLE class_schedule (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- ─────────────────────────────────────
-- CLASS PACKS
-- ─────────────────────────────────────
CREATE TABLE class_packs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

INSERT INTO class_packs
  (name, description, credits, validity_days, price_thb, is_intro, is_membership, badge_text, display_order)
VALUES
  ('NEW CUSTOMER OFFER – 1 Single Class', '1 class credit valid for all BOXX classes. For NEW CUSTOMERS ONLY.', 1, 30, 300, true, false, 'New Members Only', 1),
  ('1 Single Class', '1 class credit valid for all BOXX classes. Perfect for a drop-in.', 1, 30, 600, false, false, null, 2),
  ('5 Class Pack', '5 class credits valid for all BOXX classes.', 5, 30, 2750, false, false, null, 3),
  ('10 Class Pack', '10 class credits valid for all BOXX classes.', 10, 60, 5200, false, false, 'Best Value', 4),
  ('Monthly Unlimited Classes', 'Unlimited class credits valid for all BOXX classes.', null, 30, 5500, false, true, 'Most Popular', 5);

-- ─────────────────────────────────────
-- USER CREDITS
-- ─────────────────────────────────────
CREATE TABLE user_credits (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- ─────────────────────────────────────
-- BOOKINGS
-- ─────────────────────────────────────
CREATE TABLE bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- ─────────────────────────────────────
-- WAITLIST
-- ─────────────────────────────────────
CREATE TABLE waitlist (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  class_schedule_id UUID REFERENCES class_schedule(id),
  position          INT NOT NULL,
  notified          BOOLEAN DEFAULT false,
  notified_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, class_schedule_id)
);

-- ─────────────────────────────────────
-- ADMIN AUDIT LOG
-- ─────────────────────────────────────
CREATE TABLE admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID REFERENCES users(id),
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   UUID,
  details     JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────
-- STUDIO SETTINGS
-- ─────────────────────────────────────
CREATE TABLE studio_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

INSERT INTO studio_settings VALUES
  ('studio_name',                   'BOXX'),
  ('studio_tagline',                'Chiang Mai''s Premier Boxing Studio'),
  ('studio_timezone',               'Asia/Bangkok'),
  ('studio_address',                '89/2 Bumruang Road, Wat Ket, Chiang Mai 50000'),
  ('studio_phone',                  '+66 93 497 2306'),
  ('studio_email',                  'hello@boxxthailand.com'),
  ('studio_instagram',              'https://instagram.com/boxxthailand'),
  ('studio_facebook',               ''),
  ('studio_logo_url',               ''),
  ('studio_hero_image_url',         ''),
  ('cancellation_hours',            '24'),
  ('class_capacity',                '6'),
  ('booking_opens_days_before',     '7'),
  ('reminder_24h_enabled',          'true'),
  ('reminder_2h_enabled',           'true'),
  ('show_class_roster',             'true'),
  ('roster_max_avatars',            '6'),
  ('google_login_primary',          'true'),
  ('from_email',                    'hello@boxxthailand.com'),
  ('from_name',                     'BOXX Chiang Mai'),
  ('email_welcome_subject',         'Welcome to BOXX 🥊'),
  ('email_welcome_body',            'Hey {{member_name}}, welcome to BOXX! Book your first class and come train with us.'),
  ('email_booking_subject',         'You''re booked! See you at BOXX 🥊'),
  ('email_booking_body',            'Hi {{member_name}}, your spot in {{class_name}} on {{date}} at {{time}} is confirmed.'),
  ('email_reminder_24h_subject',    'Class tomorrow: {{class_name}} at {{time}}'),
  ('email_reminder_2h_subject',     'Class in 2 hours — {{class_name}} 🥊'),
  ('email_cancel_free_subject',     'Booking cancelled — see you next time'),
  ('email_cancel_late_subject',     'Booking cancelled (late cancellation — credit not returned)'),
  ('email_pack_purchased_subject',  'Your classes are ready 🥊'),
  ('email_credits_low_subject',     'You have 1 class credit left'),
  ('email_credits_expired_subject', 'Your class pack has expired'),
  ('stripe_account_id',             ''),
  ('stripe_access_token',           '');

-- ─────────────────────────────────────
-- AGENT CONVERSATIONS
-- ─────────────────────────────────────
CREATE TABLE agent_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title       TEXT NOT NULL DEFAULT 'New conversation',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_conversations_user_id ON agent_conversations(user_id);
CREATE INDEX idx_agent_conversations_updated_at ON agent_conversations(updated_at DESC);

-- ─────────────────────────────────────
-- AGENT MESSAGES
-- ─────────────────────────────────────
CREATE TABLE agent_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  patterns    JSONB DEFAULT '[]'::jsonb,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Public read for class_types, instructors, class_schedule, class_packs, studio_settings
ALTER TABLE class_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_settings ENABLE ROW LEVEL SECURITY;

-- Allow anon read access to public data
CREATE POLICY "public_read_class_types" ON class_types FOR SELECT USING (true);
CREATE POLICY "public_read_instructors" ON instructors FOR SELECT USING (true);
CREATE POLICY "public_read_class_schedule" ON class_schedule FOR SELECT USING (true);
CREATE POLICY "public_read_class_packs" ON class_packs FOR SELECT USING (true);
CREATE POLICY "public_read_studio_settings" ON studio_settings FOR SELECT USING (true);

-- Users can read their own record
CREATE POLICY "users_own_record" ON users FOR ALL USING (auth.uid() = id);

-- Bookings: users can read/write their own
CREATE POLICY "bookings_own" ON bookings FOR ALL USING (auth.uid() = user_id);

-- Credits: users can read their own
CREATE POLICY "credits_own_read" ON user_credits FOR SELECT USING (auth.uid() = user_id);

-- Waitlist: users can manage their own
CREATE POLICY "waitlist_own" ON waitlist FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────
-- EMAIL LOG
-- ─────────────────────────────────────
CREATE TABLE email_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- ─────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_class_schedule_starts_at ON class_schedule(starts_at);
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_class_schedule_id ON bookings(class_schedule_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX idx_user_credits_status ON user_credits(status);
CREATE INDEX idx_waitlist_class_schedule_id ON waitlist(class_schedule_id);
CREATE INDEX idx_login_attempts_email ON login_attempts(email);

-- ─────────────────────────────────────
-- UNIQUE CONSTRAINTS (payment security)
-- ─────────────────────────────────────
-- Prevent duplicate credit allocation from webhook replays
CREATE UNIQUE INDEX idx_user_credits_stripe_payment_id
  ON user_credits(stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;

-- ─────────────────────────────────────
-- FUNCTIONS (atomic credit operations)
-- ─────────────────────────────────────

-- Atomically deduct 1 credit; returns true if successful, false if no credits
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

-- Atomically restore 1 credit (used when booking insert fails)
CREATE OR REPLACE FUNCTION restore_credit(credit_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_credits
  SET credits_remaining = credits_remaining + 1
  WHERE id = credit_id
    AND credits_remaining IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────
-- AGENT USAGE TRACKING
-- ─────────────────────────────────────
CREATE TABLE agent_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Atomically increment agent usage counters (avoids race conditions)
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
-- PAGE VIEW ANALYTICS
-- ─────────────────────────────────────
CREATE TABLE page_views (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
