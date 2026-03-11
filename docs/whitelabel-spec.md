# BOXX White-Label Feasibility Analysis
Version 1.0 · March 2026

---

## 1. Executive Summary

The BOXX codebase is well-structured for a single-tenant application but would require significant refactoring to become a true white-label multi-tenant SaaS. The effort is **moderate-to-high** — the core business logic is solid, but data isolation, auth, branding, and deployment all need rethinking.

**Estimated effort:** 4–8 weeks for a competent team, depending on chosen tenancy model.

---

## 2. Current Architecture

| Layer | Technology | Tenant-Ready? |
|---|---|---|
| Frontend | Next.js 16 (App Router) | Partially — hardcoded brand refs |
| Auth | NextAuth v5 (Google + email) | Needs per-tenant config |
| Database | Supabase (Postgres + RLS) | Single-tenant RLS policies |
| Payments | Stripe Connect | Already multi-merchant capable |
| Email | Resend | Single sender domain |
| Hosting | Vercel | Single deployment |
| AI Agent | Claude API | Single API key |

---

## 3. Multi-Tenancy Models

### Option A: Schema-per-Tenant (Recommended for <50 tenants)
- Each tenant gets their own Supabase project or schema
- Strongest isolation, simplest migration from current code
- Higher operational overhead per tenant
- Best for premium white-label pricing

### Option B: Row-Level Tenancy (Recommended for scale)
- Add `tenant_id` column to every table
- Update all RLS policies to include tenant filtering
- Single database, lower cost per tenant
- Highest development effort upfront
- Risk of data leaks if any query misses the filter

### Option C: Separate Deployments (Simplest)
- Fork the codebase per client
- Each client gets their own Vercel project + Supabase project
- Zero code changes needed initially
- Unmaintainable beyond 3-5 clients (merge hell)

**Recommendation:** Option A for near-term (5-20 clients), migrate to Option B if scaling beyond that.

---

## 4. What Needs to Change

### 4.1 Database (High Effort)
- **Row-level tenancy:** Add `tenant_id` to all 12+ tables
- **RLS policies:** Rewrite every policy to include tenant check
- **Migrations:** Per-tenant migration runner or shared migrations
- **Seed data:** Tenant-specific defaults (class types, packs, settings)

### 4.2 Authentication (Medium Effort)
- Per-tenant Google OAuth credentials (different redirect URIs)
- Tenant resolution: subdomain (`studio.boxx.app`) or custom domain
- Session must carry `tenant_id`
- NextAuth config becomes dynamic based on resolved tenant

### 4.3 Branding & Theming (Medium Effort)
- Extract all hardcoded values to a `tenant_config` table:
  - Logo URLs, studio name, colors, contact info
  - Landing page content (hero text, testimonials, gallery)
  - Email templates (sender name, brand colors)
- CSS variables already in use (good) — just need to be dynamic
- Replace `BOXX` string references throughout (~50+ occurrences)

### 4.4 Stripe Integration (Low Effort)
- Already uses Stripe Connect architecture
- Each tenant would have their own connected account
- Checkout sessions already scoped — just needs tenant routing

### 4.5 Email (Medium Effort)
- Per-tenant sender domain or shared domain with tenant name
- Template variables for studio name, logo, colors
- Resend supports multiple domains

### 4.6 AI Agent (Low-Medium Effort)
- System prompt needs tenant context (studio name, business rules)
- Tool definitions are generic enough — executor needs tenant scoping
- Usage tracking already per-user — add tenant aggregation
- API key management: shared key (simpler) vs per-tenant keys

### 4.7 File Storage (Low Effort)
- Supabase Storage buckets per tenant
- Or prefixed paths within shared bucket
- Gallery images, logos, brand assets

### 4.8 Deployment & Routing (Medium Effort)
- Tenant resolution middleware (subdomain or custom domain)
- Vercel supports wildcard subdomains
- Custom domains: Vercel API for programmatic domain addition
- Environment variables become tenant-specific config

---

## 5. Files Requiring Changes

### Critical (must change for any tenancy model)
- `src/app/layout.js` — metadata, fonts, brand name
- `src/app/(admin)/admin/layout.js` — sidebar brand
- `src/lib/email.js` — all email templates
- `src/app/page.js` — landing page content
- All 14 landing page components — hardcoded copy
- `next.config.mjs` — image domains
- `middleware.js` — auth + tenant resolution

### Important (data isolation)
- All API routes (32+) — tenant scoping on queries
- `supabase/schema.sql` — tenant_id columns + RLS
- Auth configuration — per-tenant OAuth

### Nice to Have (full white-label experience)
- Customizable class types, default packs
- Per-tenant analytics dashboards
- Tenant admin panel for self-service branding

---

## 6. What's Already Good

These aspects of the codebase are already white-label friendly:

1. **CSS Variables for theming** — colors defined as variables, easy to make dynamic
2. **Stripe Connect** — multi-merchant payment architecture
3. **Generic business logic** — class booking, packs, credits system is not BOXX-specific
4. **Component architecture** — clean separation of concerns
5. **API route structure** — RESTful, easy to add middleware
6. **Referral system spec** — written with configurable thresholds (tenant-ready)

---

## 7. Revenue Model Considerations

| Model | Pricing | Best For |
|---|---|---|
| Monthly SaaS | $99-299/mo per studio | Volume play, lower touch |
| Setup + Monthly | $500 setup + $149/mo | Balance of value and scale |
| Revenue Share | 2-5% of bookings | Aligned incentives, harder to track |
| Enterprise | Custom pricing | Large chains, custom features |

---

## 8. Recommended Implementation Order

### Phase 1: Extract Configuration (1-2 weeks)
- Create `tenant_config` table with all brand/business settings
- Replace hardcoded strings with config lookups
- Make email templates use config values
- Keep single-tenant but config-driven

### Phase 2: Multi-Tenant Data Layer (2-3 weeks)
- Add tenant resolution middleware
- Add `tenant_id` to all tables (or set up schema-per-tenant)
- Update RLS policies
- Scope all API queries

### Phase 3: Auth & Onboarding (1-2 weeks)
- Per-tenant auth configuration
- Tenant signup/onboarding flow
- Stripe Connect onboarding per tenant

### Phase 4: Landing Page Builder (1-2 weeks)
- Dynamic landing page from tenant config
- Image upload for gallery, logo, etc.
- Custom domain support

---

## 9. Decision Points

Before starting, decide:

1. **Tenancy model** — Schema-per-tenant vs row-level vs separate deployments
2. **Landing page** — Shared template with config vs fully custom per tenant
3. **AI agent** — Shared API key with tenant context vs per-tenant keys
4. **Pricing** — Determines how much self-service to build
5. **Target market** — Boxing gyms only, or any fitness studio?

---

## 10. Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Data leak between tenants | Critical | Thorough RLS testing, query auditing |
| Performance at scale | High | Connection pooling, query optimization |
| Migration complexity | Medium | Feature flags, gradual rollout |
| Support burden | Medium | Self-service admin, good docs |
| Feature divergence | Medium | Strict core + plugins model |
