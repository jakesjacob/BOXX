-- Performance: composite indexes for common multi-column queries
-- Run this on your Supabase database via SQL Editor

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
