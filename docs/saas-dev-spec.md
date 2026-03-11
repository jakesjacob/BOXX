# Studio SaaS — Development Spec & Task Tracker

> Source of truth for all development work. Read at start of every session.
> Last updated: 2026-03-11

---

## Status Key

- [x] Complete
- [~] In progress
- [ ] Not started
- [!] Blocked

---

## Architecture Summary

**Model:** Shared-database multi-tenancy. `tenant_id` on every table. Row Level Security enforces isolation.

**Hierarchy:** Tenant → Location → Zone → Resource (class / appointment)

**Stack:** Next.js 16, React 19, JavaScript, Tailwind CSS v4, shadcn/ui, Supabase (Postgres + Storage), NextAuth v5, Stripe Connect + Stripe Billing, Resend, Claude API

**Existing codebase:** 52 API routes, 12 DB tables, 15 email templates, 4 cron jobs, AI assistant with 12 tools. All currently single-tenant (BOXX Boxing Studio).

**Bert's seed IDs (hardcoded, never change):**
- Tenant: `a0000000-0000-0000-0000-000000000001`
- Location: `b0000000-0000-0000-0000-000000000001`
- Vertical: `boxing`, Plan: `pro`

---

## Phase 1 — Database Migration

> Goal: Add multi-tenancy columns, create new tables, backfill Bert's data. Zero downtime. Bert's app must work identically after.

### 1A. New Core Tables
- [x] `tenants` — id, name, slug, custom_domain, vertical, plan, trial_ends_at, logo_url, primary_color, timezone, currency, created_at
- [x] `locations` — id, tenant_id, name, address, city, country, phone, timezone, is_active
- [ ] `zones` — id, location_id, name, capacity, description (deferred — not needed for MVP)
- [x] `staff_tenants` — user_id, tenant_id, role, location_ids[], invited_at, accepted_at
- [x] `plan_limits` — plan, max_locations, max_members, max_ai_queries, feature flags reference
- [x] `feature_flags` — key, description, default_enabled, enabled_for_plans[], is_killed, rollout_pct
- [x] `tenant_feature_flags` — tenant_id, flag_key, enabled (override)

### 1B. Add tenant_id to Existing Tables
- [x] `users` — add tenant_id (FK to tenants)
- [x] `class_types` — add tenant_id
- [x] `instructors` — add tenant_id
- [x] `class_schedule` — add tenant_id, location_id
- [x] `bookings` — add tenant_id
- [x] `user_credits` — add tenant_id
- [x] `class_packs` — add tenant_id
- [x] `waitlist` — add tenant_id
- [x] `studio_settings` — add tenant_id, restructured PK to (tenant_id, key)
- [x] `admin_audit_log` — add tenant_id
- [x] `email_log` — add tenant_id
- [x] `page_views` — add tenant_id
- [x] `agent_conversations` — add tenant_id
- [x] `agent_messages` — add tenant_id
- [x] `agent_memory` — add tenant_id
- [x] `agent_usage` — add tenant_id

### 1C. Backfill & Constraints
- [x] Write migration script: INSERT Bert's tenant and location rows
- [x] Backfill all existing rows with Bert's tenant_id
- [x] Apply NOT NULL + FK constraints (core tables)
- [x] Create indexes on all tenant_id columns
- [x] Create composite indexes: (tenant_id, starts_at), (tenant_id, status), (tenant_id, email)
- [x] All feature flags overridden to enabled for Bert's tenant
- [x] Staff_tenants entries created for all existing users

### 1D. Update RLS Policies
- [x] RLS enabled on all new tables
- [x] Public read policies for reference tables
- [x] User-scoped policies for staff_tenants
- [ ] Test: query from tenant A cannot see tenant B data

### 1E. Migration File
- [x] `supabase/migrations/20260311_multi_tenant.sql` — full migration wrapped in transaction
- [x] `supabase/schema.sql` — updated to reflect multi-tenant schema

### 1F. Validation (after running migration on Supabase)
- [ ] Run migration on Supabase SQL Editor
- [ ] Verify zero NULLs on tenant_id columns
- [ ] Run full app as Bert — all pages load, all CRUD works
- [ ] No data loss — row counts match pre-migration

### Security Checkpoint 1
- [ ] SQL injection review on migration scripts
- [ ] Verify RLS policies enforce tenant isolation (test with 2 tenants)
- [ ] Confirm no raw SQL bypasses RLS
- [ ] Check that supabaseAdmin client is never exposed to client-side

---

## Pre-SaaS Cleanup (done)

> These items were identified by codebase audit and resolved before starting SaaS phases.

- [x] Class type images: added `image_url` column, upload API, admin UI, member gradient fallback
- [x] Removed 5 hardcoded static class images from `public/images/studio/`
- [x] Removed BOXX defaults from admin settings page (all fallbacks now empty strings)
- [x] Removed boxing-specific marketing copy from buy-classes page
- [x] Cleaned up BOXX-specific email preview sample data

### Deferred to SaaS framework (will resolve naturally during Phases 2-4)

These items are currently hardcoded to BOXX but will be resolved when tenant scoping is built — they'll read from `tenant` / `studio_settings` / `location` once those are tenant-aware:

- Email FROM address, footer branding, CTA URLs → reads tenant's `studio_settings` (Phase 2)
- Login/register page "BOXX" headlines → reads `tenant.name` from middleware (Phase 2)
- Admin layout "BOXX Admin" → reads `tenant.name` (Phase 2)
- Member footer "BOXX Thailand" copyright → reads `tenant.name` (Phase 2)
- Logo references (`/images/brand/logo-primary-white.png`) → `tenants.logo_url` from onboarding upload (Phase 4)
- OG image / favicon → generated from tenant branding (Phase 4)
- Currency `฿` hardcoded in 11 places → `tenants.currency` field (Phase 2)
- Google Calendar / iCal event details → reads tenant's location address (Phase 2)
- AI assistant system prompt → `buildSystemPrompt(tenant, ...)` (Phase 10)
- `metadataBase` URL in layout.js → tenant domain (Phase 2)
- Password reset fallback URL → tenant domain (Phase 2)
- Analytics hostname filtering → tenant domain (Phase 2)
- Cancellation policy copy "24 hours" → reads `studio_settings.cancellation_window_hours` (Phase 2)
- Platform alert email FROM → platform-level config (Phase 8)

---

## Phase 2 — Auth & Tenant Resolution

> Goal: Every request is scoped to a tenant. JWT carries tenant context. Middleware resolves tenant from subdomain/domain.

### 2A. Tenant Resolution
- [x] Create `src/lib/tenant.js` — `resolveTenant(request)`:
  1. Check `x-tenant-id` header (from middleware)
  2. Check subdomain against `tenants.slug`
  3. Check `tenants.custom_domain` against request host
  4. Return tenant object or null
- [x] Update `src/middleware.js`:
  - Resolves tenant from host (subdomain/custom domain)
  - Injects `x-tenant-id` and `x-tenant-match-type`/`x-tenant-match-value` headers
  - Added `/api/:path*` to matcher for tenant header injection
  - [ ] Redirect to SaaS marketing site if no tenant resolved (deferred)
  - [ ] Block frozen tenants (deferred)

### 2B. Auth Updates
- [x] Update `src/lib/auth.js`:
  - JWT now carries `tenantId` (from `user.tenant_id`)
  - Credentials login: optional `tenantId` scopes user lookup
  - Google OAuth: reads tenant_id from existing user or uses DEFAULT_TENANT_ID for new users
  - Session exposes `session.user.tenantId`
- [x] Create `src/lib/api-helpers.js`:
  - `getTenantId(session, request)` — JWT → header → DEFAULT fallback
  - `requireAuth(request)` — returns `{ session, tenantId }` or 401
  - `requireStaff(request)` — returns `{ session, tenantId, isOwner, isAdmin, isEmployee }` or 401
  - `requireAdmin(request)` — returns `{ session, tenantId, isOwner }` or 401
  - `requireOwner(request)` — returns `{ session, tenantId }` or 401
- [ ] `staff_tenants` lookup on sign-in for multi-tenant users (deferred to tenant switcher)
- [ ] `locationIds[]` in JWT (deferred to multi-location phase)

### 2C. Scope All API Routes
- [x] Admin routes (25 files): all imports switched from `admin-auth` to `api-helpers`, all queries scoped with `.eq('tenant_id', tenantId)`, all INSERTs include `tenant_id: tenantId`
- [x] Member routes (18 files): all auth switched to `requireAuth()`, all queries scoped
- [x] Public routes: `/api/settings/public` uses DEFAULT_TENANT_ID, `/api/analytics/track` includes tenant_id in INSERTs
- [x] Auth routes (3): register accepts optional tenantId, scopes email uniqueness check; forgot-password and reset-password scoped
- [x] Stripe webhook: extracts tenantId from Stripe metadata, scopes all operations
- [x] Cron routes (4): reviewed — no changes needed (operate on existing records which already have tenant_id; waitlist promotion fixed to include tenant_id on booking INSERT)

### 2D. Scope Library Functions
- [x] `src/lib/email.js` — `isEmailEnabled()` and `getCustomMessage()` accept tenantId, scope studio_settings queries
- [x] `src/lib/waitlist.js` — booking INSERT now includes `tenant_id` from class record
- [x] `src/lib/gamification.js` — pure computation, no DB queries (no changes needed)
- [x] `src/lib/platform-limits.js` — all functions accept tenantId, all queries scoped by tenant_id
- [x] `src/lib/stripe.js` — per-tenant Stripe keys from studio_settings, cached per key, all queries scoped
- [x] `src/lib/confirm-pending-invitations.js` — accepts tenantId parameter, callers updated

### 2E. Validation
- [x] Create test tenant #2 (seed data) — `supabase/seed-tenant2.sql` (FitZone Studio)
- [x] Tenant isolation validation: 28/28 tests passed (`scripts/validate-tenant-isolation.js`)
- [x] Code audit: 45/45 route files clean, 18 warnings all verified as false positives (`scripts/audit-tenant-scoping.js`)
- [x] Zero NULL tenant_ids across all 7 core tables
- [x] Zero cross-tenant foreign key references (bookings→schedule, credits→packs)
- [ ] Live browser test: two sessions, two tenants — verify zero data bleed in UI
- [ ] Test: cron jobs process each tenant independently

### Security Checkpoint 2
- [ ] Penetration test: IDOR (change tenant_id in request)
- [ ] Penetration test: JWT tampering (modify tenantId claim)
- [ ] Verify no API route missing tenant scoping (grep audit)
- [ ] Rate limiter updated to per-tenant + per-user
- [ ] Session fixation check across tenants
- [ ] CORS validation per tenant domain

---

## Phase 3 — Feature Flags & Plan Enforcement

> Goal: Features gated by plan. Kill switches for emergencies. Per-tenant overrides.

### 3A. Feature Flag Engine
- [x] Create `src/lib/feature-flags.js`:
  - `isFeatureEnabled(tenantId, flagKey, plan)` — resolution order:
    1. `is_killed = true` → always false
    2. Per-tenant override from `tenant_feature_flags` → explicit true/false
    3. Plan gate: `enabled_for_plans` includes tenant plan
    4. Rollout %: deterministic hash of `tenantId:flagKey`
    5. `default_enabled` fallback
  - `getTenantFlags(tenantId, plan)` — all flags resolved to object
  - `getPlanLimits(plan)` — get plan tier limits
  - `checkPlanLimit(tenantId, plan, limitKey, currentCount)` — check specific limit
  - `invalidateFlagCache(tenantId)` — bust cache on plan/flag changes
  - 30s in-memory cache per tenant
- [x] `feature_flags` table seeded (24 flags) — done in Phase 1 migration
- [x] `plan_limits` table seeded (5 tiers) — done in Phase 1 migration

### 3B. Plan Enforcement in API Routes
- [x] `requireFeature(tenantId, flagKey)` helper in api-helpers.js — returns 402 with upgradeUrl
- [x] `getTenantPlan(tenantId)` helper with 1-minute cache
- [x] AI agent routes gated by `ai_assistant` flag (3 route files, all handlers)
- [x] `checkTenantPlanLimit(tenantId, limitKey)` in platform-limits.js — queries tenant plan + plan_limits table + current count
- [x] Member count limit on registration (`max_members`)
- [x] Class count limit on class creation (`max_classes_month`)
- [x] Instructor limit on instructor creation (`max_instructors`)
- [x] Class type limit on class type creation (`max_class_types`)
- [x] Pack limit on pack creation (`max_packs`)
- [x] AI query limit on agent route (`max_ai_queries`)
- [x] `GET /api/admin/flags` endpoint — returns plan, all resolved flags, and plan limits
- [ ] Check email/SMS limits on send operations (deferred — SMS not built yet)

### 3C. Plan Enforcement in UI
- [ ] Admin sidebar: hide/disable menu items based on flags
- [ ] Settings pages: show upgrade prompts for locked features
- [ ] Member pages: hide features not on tenant's plan

### Validation
- [ ] Test: free plan tenant cannot access AI, SMS, custom domain
- [ ] Test: kill switch instantly disables feature for all tenants
- [ ] Test: per-tenant override bypasses plan gate
- [ ] Test: upgrading plan unlocks features immediately

---

## Phase 4 — Tenant Onboarding Wizard

> Goal: New business owner signs up and is live in < 15 minutes.

### 4A. Onboarding UI
- [x] Route: `/onboarding` — 5-step wizard
- [x] Step 1 — Account: name, email, password (with show/hide toggle)
- [x] Step 2 — Studio: name, slug (auto-generated, live availability check), vertical selector (6 types), timezone, currency
- [x] Step 3 — Location: name, address, city, country, phone (all optional)
- [x] Step 4 — Brand: logo upload, color picker (preset swatches + custom), live preview of buttons/branding
- [x] Step 5 — Launch: celebration, studio URL shown, getting-started checklist, admin dashboard link
- [ ] Step (deferred): Stripe Connect setup (skippable) — not built yet, can be done from admin settings
- [ ] Step (deferred): AI data migration (skippable) — "Import your existing data" with drag-and-drop (see Phase 7J)

### 4B. Onboarding API
- [x] `POST /api/onboarding/create-tenant`:
  - Creates tenant row (14-day free trial)
  - Creates location row
  - Creates owner user (hashed password)
  - Creates staff_tenants row (role: owner)
  - Enables all feature flags for trial period
  - Seeds vertical-specific defaults (class types, packs, studio_settings)
  - Adds studio_name to studio_settings
  - Sends welcome email (non-blocking)
  - Auto-logs in owner after creation
  - Rollback: deletes tenant if owner creation fails
- [x] `POST /api/onboarding/check-slug` — real-time availability check with reserved word list + regex validation
- [x] `POST /api/onboarding/upload-logo` — Supabase Storage `tenant-logos` bucket, 2MB limit, updates tenant.logo_url

### 4C. First-Week Checklist
- [x] Static checklist shown on launch step (6 items)
- [ ] Stored in `studio_settings` key `onboarding_checklist` (deferred — dynamic tracking)
- [ ] Dismissible after 7 days (deferred)
- [ ] Show in admin dashboard (deferred)

### 4D. Vertical Defaults
- [x] `src/lib/vertical-defaults.js` — seed data per vertical
- [x] 6 verticals: boxing, yoga, fitness, dance, pt, other
- [x] Each defines: class types (with colors, durations, private flags), packs (with pricing), studio settings

### Validation
- [ ] End-to-end: sign up → onboard → create class → book as member → verify isolation
- [ ] Test: duplicate slug rejected
- [ ] Test: onboarding with Stripe skip works
- [ ] Test: vertical defaults seed correctly

### Security Checkpoint 3
- [x] Rate limit on signup endpoint (5 per minute per IP)
- [x] Slug validation: regex (alphanumeric + hyphens, 3-50 chars), reserved words list
- [x] Logo upload: file type validation (JPEG/PNG/WebP/SVG), 2MB size limit, sanitized filename
- [x] All inputs validated via Zod schema
- [ ] Create `tenant-logos` Supabase Storage bucket (needs manual creation)

---

## Phase 5 — SaaS Billing (Your Revenue)

> Goal: Charge tenants for plans via your own Stripe account (separate from tenant Stripe Connect).

### 5A. Billing Infrastructure
- [ ] Create Stripe Products + Prices for each plan tier
- [ ] `POST /api/billing/create-subscription` — create Stripe subscription for tenant
- [ ] `POST /api/billing/change-plan` — upgrade/downgrade
- [ ] `POST /api/billing/cancel` — cancel subscription (downgrade to free at period end)
- [ ] `GET /api/billing/portal` — Stripe Customer Portal link
- [ ] `POST /api/webhooks/stripe-billing` — handle subscription events:
  - `customer.subscription.created` → update tenant plan
  - `customer.subscription.updated` → handle plan changes
  - `customer.subscription.deleted` → downgrade to free
  - `invoice.payment_failed` → notify owner, grace period
  - `invoice.paid` → clear payment failure state

### 5B. Trial Management
- [ ] 14-day free trial on paid plans (no credit card required)
- [ ] `cron/trial-expiry` — daily check, expire trials → downgrade to free
- [ ] Trial expiry warning emails (7 days, 3 days, 1 day, expired)
- [ ] Banner in admin UI during trial: "X days left — upgrade now"

### 5C. Billing UI
- [ ] Admin → Settings → Billing page
- [ ] Current plan display, usage stats, upgrade/downgrade buttons
- [ ] Invoice history (from Stripe)
- [ ] Payment method management (via Stripe Portal)

### Validation
- [ ] Test: full subscription lifecycle (trial → subscribe → upgrade → cancel)
- [ ] Test: failed payment → grace period → downgrade
- [ ] Test: Stripe webhook signature verification
- [ ] Test: plan change immediately updates feature flags

### Security Checkpoint 4
- [ ] Webhook signature verification on billing endpoint
- [ ] Only owner can manage billing
- [ ] Stripe Customer Portal scoped to correct customer
- [ ] No plan data in client-side JS (always server-verified)

---

## Phase 6 — Terminology & Branding System

> Goal: Each vertical uses its own language. Each tenant has custom branding.

### 6A. Terminology Engine
- [ ] Create `src/lib/terminology.js`:
  - Map vertical → { class, instructor, member, credit, session_mode }
  - e.g., boxing: Class/Coach/Member/Credit, spa: Treatment/Therapist/Guest/Credit
- [ ] Store in tenant record or studio_settings
- [ ] Pass terminology to all UI components via context/props
- [ ] Update admin UI labels dynamically
- [ ] Update member-facing UI labels dynamically
- [ ] Update email templates to use terminology

### 6B. Tenant Branding
- [ ] Logo display in admin header, member pages, emails
- [ ] Primary color applied to accent elements
- [ ] "Powered by [SaaS Name]" watermark on free plan (removable on growth+)
- [ ] Favicon generation from logo

### Validation
- [ ] Test: boxing studio shows "Coach", yoga studio shows "Teacher"
- [ ] Test: branding colors apply throughout app
- [ ] Test: free plan shows watermark, paid plan doesn't

---

## Phase 7 — Additional Tables & Features (Growth+ tier)

> These tables from the master spec are NOT needed for MVP launch. Build after core multi-tenancy is solid.

### 7A. Check-In System (Starter+)
- [ ] `check_ins` table
- [ ] Admin roster check-in: checkbox per member on class detail
- [ ] QR code per class: deep link with signed JWT
- [ ] Self check-in: member scans QR
- [ ] `cron/no-show-processor` — mark no-shows 30min after class

### 7B. Instructor Management (Growth+)
- [ ] `instructor_locations` — scope instructors to locations
- [ ] `instructor_availability` — weekly availability windows
- [ ] `instructor_unavailability` — holiday exceptions

### 7C. Messaging Channels (Growth+)
- [ ] `message_log` table
- [ ] `notification_preferences` table
- [ ] Create `src/lib/messaging.js` — unified `sendMessage()` function
- [ ] SMS via Twilio
- [ ] WhatsApp via Twilio WhatsApp Business
- [ ] Telegram Bot API
- [ ] LINE Messaging API

### 7D. Discount Codes & Gift Cards (Growth+)
- [ ] `discount_codes`, `discount_code_packs`, `discount_code_uses` tables
- [ ] `gift_cards` table
- [ ] Admin UI for code creation/management
- [ ] Apply code at checkout

### 7E. CRM & Leads (Growth+)
- [ ] `leads`, `lead_activities` tables
- [ ] Admin `/admin/leads` page
- [ ] Pipeline: New → Contacted → Trial Booked → Converted → Lost
- [ ] One-click convert to member

### 7F. Referral System (Growth+)
- [ ] `referral_config`, `referrals`, `referral_credit_adjustments` tables
- [ ] Unique referral code per member
- [ ] Trigger on first paid purchase
- [ ] Abuse prevention (email verification, self-referral block)

### 7G. Reviews & Retention (Pro+)
- [ ] `reviews` table — post-class ratings
- [ ] `retention_events` table — inactivity alerts, birthday triggers
- [ ] `cron/retention-engine` — daily processing
- [ ] `cron/review-requests` — 24h post-class emails

### 7H. Cancel Fees & Family Accounts (Growth+)
- [ ] `cancel_fees` table — late cancel / no-show charges
- [ ] `account_links` table — family/group linked accounts
- [ ] `payment_failures` table — dunning state

### 7I. Public API & Webhooks (Pro+)
- [ ] `api_keys` table — bcrypt hashed, prefix shown in UI
- [ ] `webhook_endpoints`, `webhook_deliveries` tables
- [ ] `/api/public/v1/*` routes (schedule, members, bookings, credits, analytics)
- [ ] HMAC-SHA256 webhook signing
- [ ] 3 retries with exponential backoff
- [ ] `cron/webhook-retry`

### 7J. AI Data Migration (Starter+)

> Goal: Zero-friction onboarding. Drop in any data and we populate your Zatrovo automatically. Minimises switching cost.

#### Migration Engine
- [ ] `migration_jobs` table — id, tenant_id, status (pending/processing/mapping/reviewing/importing/complete/failed), source_type, file_urls[], row_counts, error_log, created_at
- [ ] `migration_mappings` table — job_id, source_column, target_table, target_column, transform_fn, confidence, user_confirmed
- [ ] `POST /api/onboarding/migrate` — upload endpoint (CSV, XLSX, JSON, or raw export dump)
- [ ] `POST /api/onboarding/migrate/confirm` — user confirms AI-proposed column mappings
- [ ] `GET /api/onboarding/migrate/[jobId]` — poll job status + progress

#### AI Column Mapping
- [ ] Claude API analyzes uploaded file headers + sample rows
- [ ] Auto-maps columns to Zatrovo schema (members → users, appointments → bookings, packages → class_packs, etc.)
- [ ] Handles messy data: inconsistent date formats, merged name fields, currency symbols, phone formats
- [ ] Confidence scoring per mapping (high/medium/low) — user reviews medium/low
- [ ] Smart defaults: fills timezone, currency, tenant_id automatically

#### Supported Data Sources
- [ ] Generic CSV/XLSX (any column names — AI figures out the mapping)
- [ ] Mindbody export format (known schema)
- [ ] Glofox export format (known schema)
- [ ] WellnessLiving export format
- [ ] Google Sheets link (fetch via Sheets API)
- [ ] Raw JSON / API dump
- [ ] Multi-file upload (e.g., separate members.csv + bookings.csv)

#### Import Pipeline
- [ ] Step 1: Upload file(s) → validate format, extract headers + 5 sample rows
- [ ] Step 2: AI mapping → show proposed column mappings with confidence indicators
- [ ] Step 3: User review → confirm/adjust mappings, handle conflicts (duplicate emails, etc.)
- [ ] Step 4: Dry run → import to staging, show summary (X members, Y bookings, Z packs to import)
- [ ] Step 5: Execute → import with progress bar, rollback on critical failure
- [ ] Step 6: Report → show imported counts, skipped rows with reasons, warnings

#### Data Transforms
- [ ] Name splitting (full name → first + last)
- [ ] Date parsing (any format → ISO 8601)
- [ ] Phone normalization (any format → E.164)
- [ ] Email validation + dedup
- [ ] Credit/pack balance migration (map source pack → closest Zatrovo pack)
- [ ] Booking history import (historical records, no double-charging)
- [ ] Membership status inference (active/expired/cancelled from dates)

#### Onboarding Integration
- [ ] Optional step in onboarding wizard (between Brand and Launch): "Import your existing data"
- [ ] Also accessible from Admin → Settings → Import Data (post-onboarding)
- [ ] "Switching from..." selector with known platforms for optimized import
- [ ] Drag-and-drop file upload with progress

#### Safety & Validation
- [ ] All imports wrapped in DB transaction — atomic commit or full rollback
- [ ] Duplicate detection: email, phone, booking date+time combos
- [ ] Row-level error reporting (don't fail entire import for one bad row)
- [ ] Max file size: 10MB per file, 50MB total per job
- [ ] Rate limit: 1 active migration job per tenant
- [ ] Imported data gets `source: 'migration'` tag for audit trail
- [ ] Admin can undo entire migration (soft delete imported rows) within 7 days

### 7K. Forms & Waivers (Growth+)
- [ ] `forms`, `form_responses` tables
- [ ] Form builder in admin
- [ ] Member fills out on signup or before first class

---

## Phase 8 — Platform Admin (Your Ops Dashboard)

> Goal: Internal dashboard for managing tenants, monitoring health, feature flags.

- [ ] Route: `/platform-admin` — gated by `PLATFORM_ADMIN_EMAILS` env var
- [ ] Overview: MRR, total tenants, new this week, churn, plan distribution
- [ ] Tenant list + detail (stats, manual plan override, impersonate login)
- [ ] Feature flag management UI (kill switches, rollout %, per-tenant overrides)
- [ ] `changelog_entries`, `changelog_reads` tables
- [ ] Changelog management: publish what's new entries
- [ ] `platform_events` table + event stream viewer

---

## Phase 9 — SaaS Marketing Site

> Goal: Public-facing website for the SaaS product itself. Lives at base domain.

- [ ] Routes (base domain only): `/` `/pricing` `/features` `/verticals/[vertical]` `/signup` `/login` `/blog` `/docs` `/about` `/changelog` `/legal/privacy` `/legal/terms`
- [ ] Middleware: detect base domain vs tenant subdomain, route accordingly
- [ ] Pricing page with plan comparison table
- [ ] Feature pages per vertical
- [ ] Blog (MDX or CMS)

---

## Phase 10 — AI Assistant Expansion

> Goal: Expand AI tools and make system prompt tenant-aware.

- [ ] Dynamic system prompt: `buildSystemPrompt(tenant, location, terminology, flags)`
- [ ] New tools: `get_revenue_summary`, `get_at_risk_members`, `send_bulk_email`, `get_class_analytics`, `bulk_cancel_classes`, `suggest_schedule_optimisations`, `check_in_member`, `create_discount_code`, `get_lead_summary`, `get_no_show_report`, `waive_cancel_fee`
- [ ] Bulk action safety: confirm before executing on > 10 records
- [ ] Query counting against plan limit

---

## Pre-Production Security Review

> Run before any tenant goes live. Not a phase — a gate.

### Authentication & Authorization
- [ ] JWT cannot be tampered to switch tenants
- [ ] Session fixation impossible across tenants
- [ ] Password reset scoped to tenant
- [ ] OAuth callback validates tenant context
- [ ] Frozen accounts blocked at middleware level

### Data Isolation
- [ ] Every Supabase query includes `.eq('tenant_id', tenantId)` — automated grep check
- [ ] RLS policies tested with cross-tenant queries
- [ ] Supabase Storage buckets isolated per tenant
- [ ] Cron jobs never mix tenant data
- [ ] AI assistant memory isolated per tenant

### Input Validation
- [ ] All user inputs sanitized (XSS prevention)
- [ ] SQL injection impossible (parameterized queries only)
- [ ] File upload validation (type, size, filename sanitization)
- [ ] Slug validation (no reserved words, no special chars)
- [ ] Email template injection prevention

### API Security
- [ ] Rate limiting per tenant + per user (not in-memory — DB-backed or Redis)
- [ ] CORS configured per tenant domain
- [ ] Webhook signature verification on all webhook endpoints
- [ ] API keys stored as bcrypt hashes
- [ ] No secrets in client-side bundle (automated check)

### Stripe Security
- [ ] Billing webhooks verify Stripe signature
- [ ] Connect webhooks verify per-tenant Stripe signature
- [ ] No Stripe secret keys in frontend
- [ ] Idempotency on payment processing

### Infrastructure
- [ ] Environment variables documented and validated on startup
- [ ] Error messages don't leak tenant data to other tenants
- [ ] Logging doesn't expose PII across tenant boundaries
- [ ] Database connection pooling configured for multi-tenant load

---

## Not Building in v1

Revisit after 50 paying tenants:
- Native iOS/Android apps
- Inventory/retail POS
- Staff payroll & commission
- Video/on-demand classes
- Drip email marketing automation
- Franchise corporate dashboard
- Wearables integration
- In-app social/community features

---

## Environment Variables (new, on top of existing)

```bash
NEXT_PUBLIC_BASE_DOMAIN=yoursaas.com

# SaaS billing (YOUR Stripe)
STRIPE_BILLING_SECRET_KEY=sk_live_xxx
STRIPE_BILLING_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_STARTER=price_xxx
STRIPE_PRICE_GROWTH=price_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_ENTERPRISE=price_xxx

# Messaging (Phase 7)
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14xxxxxxxx
TELEGRAM_BOT_TOKEN=xxx:xxx
LINE_CHANNEL_ACCESS_TOKEN=xxx
LINE_CHANNEL_SECRET=xxx

# Security
PLATFORM_ADMIN_EMAILS=you@youremail.com
CHECKIN_SECRET=min_32_chars_random_string
WEBHOOK_SIGNING_SECRET=min_32_chars_random_string
```

---

## CLAUDE.md Update Triggers

> After completing each phase, add the corresponding rules to CLAUDE.md so Claude Code works with the codebase as it actually is.

### After Phase 1 (Database Migration)
Add to CLAUDE.md:
```
## Database
Supabase (Postgres) with Row Level Security. Every table has `tenant_id`.
Bert's seed IDs (never use in app logic):
- Tenant: a0000000-0000-0000-0000-000000000001
- Location: b0000000-0000-0000-0000-000000000001
```

### After Phase 2 (Auth & Tenant Scoping)
Add to CLAUDE.md Critical Rules section:
```
## Critical Rules
1. Every Supabase query MUST include `.eq('tenant_id', tenantId)`. Missing this leaks data between tenants.
2. Every API route MUST start with `requireAuth()`, `requireAdmin()`, or `requireOwner()` from `src/lib/api-helpers.js`.
3. Never hardcode tenant IDs in application logic — always derive from JWT/session.
```
Add to Architecture section:
```
src/lib/tenant.js       — resolveTenant(): subdomain/custom domain → tenant
src/lib/api-helpers.js  — requireAuth / requireAdmin / requireOwner
src/middleware.js       — tenant resolution, auth guards, injects x-tenant-id header
```

### After Phase 3 (Feature Flags)
Add to CLAUDE.md:
```
- Check feature flags via `getTenantFlags(tenantId, plan)` before gated operations
- Return 402 with upgradeUrl when feature not on tenant's plan
```
Add to Architecture section:
```
src/lib/feature-flags.js — getTenantFlags(): plan gate + per-tenant overrides, 30s cache
```

### After Phase 5 (SaaS Billing)
Add to CLAUDE.md Conventions:
```
- Two Stripe accounts: `STRIPE_BILLING_*` = your SaaS revenue, `STRIPE_*` = tenant member payments
```

### After Phase 6 (Terminology)
Add to CLAUDE.md Critical Rules:
```
- Never hardcode terminology ("Class", "Member", "Instructor") in UI — use terminology from tenant's vertical config
```
Add to Architecture section:
```
src/lib/terminology.js — getTerminology(): vertical-specific labels
```

### After Phase 7C (Messaging)
Add to CLAUDE.md Critical Rules:
```
- Never send messages without checking notification_preferences first. Use sendMessage() from src/lib/messaging.js.
```
Add to Architecture section:
```
src/lib/messaging.js — sendMessage(): routes SMS/WhatsApp/Telegram/LINE per user preference
```

### After Phase 10 (AI Expansion)
Add to CLAUDE.md:
```
- Bulk AI actions (bulk email, bulk SMS, bulk cancel) MUST show the user exactly what will happen and wait for explicit confirmation before executing on > 10 records.
```

---

## Notes & Decisions

### Why shared-DB multi-tenancy?
- Simplest to manage at our scale (< 1000 tenants)
- RLS provides strong isolation without schema/DB overhead
- Single migration path, single deployment
- Can shard later if needed

### Phase order rationale
- Phases 1-2 (DB + auth) are foundations — nothing else works without them
- Phase 3 (flags) gates all future features — build it early
- Phase 4 (onboarding) is the first thing a new customer sees
- Phase 5 (billing) generates revenue — needed before growth features
- Phase 6 (terminology) is polish — doesn't block anything
- Phase 7 (features) is the long tail — build based on customer demand
- Phases 8-10 are operational and growth — ongoing work

### Bert's migration guarantee
Every phase must pass the "Bert test": BOXX Boxing Studio works identically before and after. No regressions, no data loss, no downtime.
