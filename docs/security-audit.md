# Security Audit Report — BOXX

> **Date:** 2026-03-10
> **Scope:** 44 API routes, all client pages, all lib utilities, all components
> **Status:** Review complete — fixes pending

---

## Status Key

- [ ] Not fixed
- [x] Fixed
- [~] Partially fixed

---

## CRITICAL

### 1. PostgREST Filter Injection in Admin Search
**Files:** `src/app/api/admin/members/route.js`, `src/app/api/admin/bookings/route.js`, `src/app/api/admin/events/route.js`
**Status:** [ ]

The `search` query param is interpolated directly into Supabase `.or()` filter strings:
```js
query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
```
A crafted search string containing PostgREST syntax (commas, periods, parentheses) can break out of the filter and inject arbitrary conditions, potentially exposing data.

**Fix:** Escape special PostgREST characters before interpolation:
```js
const escaped = search.replace(/[%_,().]/g, '\\$&')
query = query.or(`name.ilike.%${escaped}%,email.ilike.%${escaped}%`)
```

### 2. Direct Purchase Bypasses Payment
**File:** `src/app/api/packs/purchase/route.js`
**Status:** [ ]

Any authenticated user can call this endpoint to receive credits instantly with no payment. The `stripe_payment_id` is faked as `direct_${Date.now()}`. This is a business-critical vulnerability in production.

**Fix:** Gate behind `ENABLE_DIRECT_PURCHASE` env var or restrict to admin-only:
```js
if (process.env.ENABLE_DIRECT_PURCHASE !== 'true') {
  return NextResponse.json({ error: 'Direct purchase is disabled' }, { status: 403 })
}
```

---

## HIGH

### 3. Race Conditions in Booking/Credit Operations
**Files:** `src/app/api/bookings/create/route.js`, `src/app/api/bookings/cancel/route.js`, `src/app/api/waitlist/join/route.js`, `src/app/api/admin/schedule/cancel/route.js`, `src/app/api/admin/schedule/roster/route.js`
**Status:** [ ]

Credit deduction, capacity checks, waitlist positions, and credit refunds all use read-then-write patterns. Concurrent requests can double-book, double-spend credits, or lose refund increments.

**Fix:** Use Postgres RPC functions with atomic operations:
```sql
-- Example: atomic credit deduction
CREATE FUNCTION deduct_credit(credit_id UUID)
RETURNS user_credits AS $$
  UPDATE user_credits
  SET credits_remaining = credits_remaining - 1
  WHERE id = credit_id AND credits_remaining > 0
  RETURNING *;
$$ LANGUAGE sql;
```
Add a unique constraint on `(user_id, class_schedule_id)` for confirmed bookings.

### 4. Employee Can Edit Admin User Accounts
**File:** `src/app/api/admin/members/[id]/route.js`
**Status:** [ ]

Employees can't change roles, but they can change the email on any user — including admins — enabling account takeover via password reset.

**Fix:** Block employees from editing admin user records:
```js
const targetUser = await supabaseAdmin.from('users').select('role').eq('id', id).single()
if (session.user.role === 'employee' && targetUser.data?.role === 'admin') {
  return NextResponse.json({ error: 'Cannot edit admin accounts' }, { status: 403 })
}
```

### 5. In-Memory Rate Limiter Ineffective on Vercel
**File:** `src/lib/rate-limit.js`
**Status:** [ ]

The `Map`-based rate limiter resets on cold starts and isn't shared across instances. Provides almost no real protection on serverless.

**Fix:** Replace with Upstash Redis (`@upstash/ratelimit`) or Vercel KV for production.

### 6. Most Endpoints Lack Rate Limiting
**Status:** [ ]

Only 2 of 44 routes have rate limiting (register + password change). Missing on: booking create, cancel, purchase, admin email send, avatar upload, waitlist join.

**Fix:** Add rate limiting to all mutation endpoints, keyed by user ID.

### 7. XSS in Email Templates
**File:** `src/lib/email.js`
**Status:** [ ]

Admin-composed email body/heading are interpolated into raw HTML without sanitization. Allows HTML injection in emails (phishing links, fake forms).

**Fix:** HTML-encode all interpolated values before insertion:
```js
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}
```

### 8. Admin Layout Defaults Role to 'admin'
**File:** `src/app/(admin)/admin/layout.js` (line 28)
**Status:** [ ]

`const userRole = session?.user?.role || 'admin'` — if session has no role, UI defaults to showing all admin features. API routes enforce server-side, but this is a bad pattern.

**Fix:** Default to `'member'` instead of `'admin'`.

---

## MEDIUM

### 9. Avatar Upload Accepts SVG (XSS Risk)
**File:** `src/app/api/profile/avatar/route.js`
**Status:** [ ]

Checks `fileType.startsWith('image/')` but the `ALLOWED_TYPES` array defined on line 5 is never used. SVGs (`image/svg+xml`) can contain JavaScript. Also, error message says "Maximum 5MB" but the actual limit is 10MB.

**Fix:** Validate against the existing `ALLOWED_TYPES` array:
```js
if (fileType && !ALLOWED_TYPES.includes(fileType)) {
  return NextResponse.json({ error: 'Invalid file type.' }, { status: 400 })
}
```
Fix error message to say 10MB.

### 10. Auth Check Operator Precedence (Fragile)
**Files:** 25+ admin API routes
**Status:** [ ]

```js
if (!session || session.user.role !== 'admin' && session.user.role !== 'employee')
```
Works by coincidence due to `&&` binding tighter than `||`, but fragile and misleading.

**Fix:** Use the existing `requireStaff()` helper from `src/lib/admin-auth.js` (currently unused by any route), or add explicit parentheses:
```js
if (!session || (session.user.role !== 'admin' && session.user.role !== 'employee'))
```

### 11. Stripe Access Token in Settings API Response
**File:** `src/app/api/admin/settings/route.js`
**Status:** [ ]

GET returns all `studio_settings` rows including `stripe_access_token`. If an admin session is compromised, attacker gets the Stripe token.

**Fix:** Filter out sensitive keys from the response:
```js
const sensitiveKeys = ['stripe_access_token']
const settings = Object.fromEntries(
  (data || []).filter(r => !sensitiveKeys.includes(r.key)).map(r => [r.key, r.value])
)
```

### 12. Missing UUID Validation on ID Params
**Files:** Multiple booking/waitlist/schedule/purchase routes
**Status:** [ ]

IDs validated as `.min(1)` instead of `.uuid()`. Non-UUID strings pass application validation (Postgres will still reject them, but errors are less clean).

**Fix:** Change `.min(1)` to `.uuid()` on all ID fields in Zod schemas.

### 13. `google_id` Exposed in Dashboard Response
**File:** `src/app/api/dashboard/route.js` (line 34)
**Status:** [ ]

Returns `google_id` to the client unnecessarily.

**Fix:** Remove from select, return a derived boolean:
```js
const user = { ...rawUser, is_google_user: !!rawUser.google_id }
delete user.google_id
```

### 14. Cron Endpoints — Weak Authentication
**Files:** `src/app/api/cron/expire-credits/route.js`, `src/app/api/cron/reminders/route.js`, `src/app/api/cron/process-waitlist/route.js`
**Status:** [ ]

Only check `CRON_SECRET` bearer token. If the secret is weak or leaked, anyone can trigger crons.

**Fix:** Ensure `CRON_SECRET` is 32+ random characters. Consider also checking `x-vercel-cron` header if available.

---

## LOW

### 15. Account Deletion Doesn't Invalidate Session
**File:** `src/app/api/profile/route.js` (DELETE handler)
**Status:** [ ]

JWT remains valid after account anonymization until natural expiry (30 days).

**Fix:** Set role to `'frozen'` on deletion so the auth callback's frozen check blocks future requests.

### 16. iCal Output Not Sanitized
**File:** `src/app/api/bookings/ical/route.js`
**Status:** [ ]

Class names and instructor names from DB are injected into iCal output without escaping special characters (backslash, semicolons, commas, newlines).

**Fix:** Escape iCal field values:
```js
const escapeIcal = (s) => s.replace(/[\\;,\n]/g, (c) => '\\' + c)
```

### 17. Admin Email Can Send to Any Address
**File:** `src/app/api/admin/emails/route.js`
**Status:** [ ]

The `to` field accepts any email address, not just registered members. An employee could use the studio's Resend account to email arbitrary addresses.

**Fix:** Restrict `to` to emails that exist in the `users` table, or add rate limiting + audit logging.

### 18. No CSRF Tokens
**Status:** [ ] (Acceptable)

Relies on `SameSite: lax` cookies and JSON content-type checks. Acceptable for current threat model but worth documenting.

### 19. Console.error May Log DB Details in Production
**Status:** [ ]

`console.error` calls throughout API routes log full Supabase error objects. Internal table/column names visible in Vercel function logs.

**Fix:** Sanitize logged errors to only include message strings in production.

---

---

## TODO — Owner Role & Platform Limits

### Owner Role (NEW)
- [ ] **Add `owner` role to users table** — highest privilege level, above `admin`
- [ ] **Only assignable via direct DB update or env var** — no UI to promote to owner, only Jacob (platform operator) can assign. Hardcode owner user ID in env var `PLATFORM_OWNER_ID` as a safety check
- [ ] **Owner can edit all admins/employees** — full CRUD on all staff accounts including role changes
- [ ] **Admins cannot edit other admins** — admins can only manage employees and members. Cannot change another admin's email, role, or profile. Can still manage their own profile
- [ ] **Employees cannot edit admins or other employees** — employees can only manage members (existing behavior, but enforce more strictly)
- [ ] **Owner-only actions:**
  - Assign/revoke admin role
  - Connect/disconnect Stripe
  - Change platform limits (see below)
  - Access billing/usage dashboard
  - Delete admin accounts
- [ ] **Update middleware** — recognize `owner` role, grant access to all admin routes
- [ ] **Update all admin API auth checks** — `owner` gets full access, `admin` gets current access minus editing other admins, `employee` stays the same
- [ ] **Update admin layout sidebar** — show "Platform" section for owner only (limits, billing)

### Platform Resource Limits
> Protects scaling costs. Limits stored in `studio_settings` (or a dedicated `platform_limits` table). Enforced server-side on every relevant API route. Owner can adjust limits via a dedicated settings page or direct DB update.

- [ ] **Max scheduled classes per month** — default 200. Checked on class creation (`/api/admin/schedule` POST). Prevents runaway schedule creation that increases DB/compute costs
- [ ] **Max active members** — default 500. Checked on registration (`/api/auth/register`). Counts non-frozen, non-deleted users with role `member`
- [ ] **Max instructors** — default 20. Checked on instructor creation (`/api/admin/instructors` POST)
- [ ] **Max class types** — default 30. Checked on class type creation (`/api/admin/class-types` POST)
- [ ] **Max storage per studio** — default 500MB. Checked on avatar upload and any future file uploads. Query Supabase Storage usage before allowing upload
- [ ] **Max emails per month** — default 2000. Checked on all email sends (admin compose, automated emails). Counter stored in `studio_settings` with monthly reset
- [ ] **Max active class packs** — default 20. Checked on pack creation (`/api/admin/packs` POST)
- [ ] **Limit enforcement API** — all creation endpoints check against limits before proceeding, return `{ error: 'Limit reached. Contact support to increase.' , status: 403 }`
- [ ] **Usage dashboard (owner-only page)** — shows current usage vs limits: classes this month, active members, storage used, emails sent, active packs. Visual bars showing usage percentage
- [ ] **Limit override mechanism** — owner can increase limits via platform settings page or env vars. Future: tie to billing tier so increasing limits triggers a pricing change

### Pricing Tier Model (Future)
> If costs scale, these limits become the basis for tiered pricing:

| Tier | Classes/mo | Members | Instructors | Emails/mo | Storage | Price |
|------|-----------|---------|-------------|-----------|---------|-------|
| Starter | 100 | 200 | 5 | 500 | 100MB | Base retainer |
| Growth | 300 | 500 | 15 | 2000 | 500MB | Base + increment |
| Pro | Unlimited | Unlimited | Unlimited | 5000 | 2GB | Base + higher increment |

---

## Positive Findings

The codebase has many strong security patterns already in place:

- Auth checked on every API route via `auth()` session
- Middleware enforces route protection for both member and admin areas
- Zod input validation used consistently across mutation endpoints
- No `dangerouslySetInnerHTML` anywhere in the codebase
- Supabase admin client only imported in server-side API routes
- Stripe webhook signature verification implemented correctly
- Bcrypt with cost factor 12 for password hashing
- No secrets exposed in `NEXT_PUBLIC_*` environment variables
- `.env*` files in `.gitignore`
- Frozen user blocking at sign-in, middleware, and session callback levels
- GDPR/PDPA-compliant account anonymization on deletion
- Idempotent Stripe webhook handling (checks for existing credits before allocating)
- Protected Stripe settings (blocks updates to `stripe_account_id` and `stripe_access_token` via settings API)
