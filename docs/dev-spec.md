# BOXX Development Spec & Progress Tracker

> Last updated: 2026-03-10

---

## Status Key

- [x] Complete
- [ ] Not started
- [~] Partially done

---

## Phase 1 — Homepage & Marketing Site

- [x] Hero section with CTA
- [x] Navbar with auth links
- [x] About section (founder bio, studio story)
- [x] Features/benefits section
- [x] Classes section (4 class types, expandable cards)
- [x] Gallery (5-image grid)
- [x] Testimonials
- [x] Community section (animated 2x2 grid, cycling featured image)
- [x] Process ("How to get started")
- [x] CTA Banner
- [x] FAQ accordion
- [x] Contact form + details
- [x] Footer with social links
- [x] Loading screen
- [x] Marquee banner
- [x] Favicon + OG image generation (sharp)
- [x] SEO metadata
- [x] Security headers (HSTS, X-Frame-Options, CSP, etc.)
- [x] Responsive / mobile

---

## Phase 2 — Auth & Payments

### 2.1 Authentication
- [x] NextAuth setup (JWT strategy)
- [x] Google OAuth provider
- [x] Email/password credentials provider (bcrypt)
- [x] Registration page + API (`/api/auth/register`)
- [x] Login page (Google + email/password)
- [x] Middleware: protect member routes, protect admin routes (role check)
- [x] Admin session expiry (8 hours)
- [x] Rate limiting on registration (5/15min per IP)

### 2.2 Stripe Payments
- [x] Stripe Connect OAuth flow (studio connects their account)
- [x] Checkout session creation (`/api/stripe/checkout`)
- [x] Webhook handler (payment success → credit allocation)
- [x] Billing portal link (`/api/stripe/portal`)
- [x] Buy Classes page (pack cards with Stripe checkout)
- [x] Confirmation page (post-purchase)

---

## Phase 3 — Member Dashboard

### 3.1 Core Dashboard
- [x] Dashboard API (`/api/dashboard`) — user data, credits, schedule
- [x] Profile section (avatar, name, phone, bio, roster toggle)
- [x] Avatar upload (`/api/profile/avatar` → Supabase storage)
- [x] Credit packs display (expandable, color-coded health)
- [x] Schedule view (calendar + list, week navigation)
- [x] Class booking flow (credit deduction, capacity check)
- [x] Booking cancellation (free vs late cancel logic)
- [x] Class roster display (avatars of booked members)
- [x] Share class link
- [x] My Bookings tab (upcoming + past, expandable cards)

### 3.2 Waitlist
- [x] Join waitlist API (`/api/waitlist/join`)
- [x] Leave waitlist API (`/api/waitlist/leave`)
- [x] Waitlist UI in schedule view (join/leave buttons, position badge)

### 3.3 Account Management
- [x] Change password API (`/api/profile/password`) — rate limited
- [x] Delete account API (`DELETE /api/profile`) — cascading cleanup, anonymization
- [x] Data export API (`/api/profile/export`) — GDPR/PDPA JSON download
- [x] Account Settings UI in dashboard (password, export, delete)

### 3.4 Calendar Download
- [x] .ics file generation (`/api/bookings/ical`)
- [x] Calendar icon on booked classes (schedule + my bookings)

---

## Phase 4 — Admin Panel: Schedule & Classes

- [x] Admin dashboard page (stats: members, credits, bookings, revenue)
- [x] Admin dashboard API (`/api/admin/dashboard`)
- [x] Today's classes with capacity indicators (schedule-style cards, clickable)
- [x] Recent signups list
- [x] Low-credit member alerts
- [x] Schedule management page (weekly calendar, 7-column grid)
- [x] Create class (dialog + form, class type + instructor selects)
- [x] Edit class (single, all recurring, or unlink from recurring)
- [x] Cancel class API — single or all recurring, cascading: cancel bookings → refund credits → clear waitlist
- [x] Schedule options API (`/api/admin/schedule/options`)
- [x] Category hue system: purple=recurring, amber=private, sky=singular (cards + dialogs)
- [x] Business logic: lock class type after creation, capacity floor, time clash detection
- [x] Add members when creating private events (search + invite flow)
- [x] Private event default capacity = 1

---

## Phase 5 — Admin Panel: Bookings, Members, Packs, Instructors

### 5.1 Activity / Events Log (was Bookings)
- [x] Activity log page — unified feed of bookings, cancellations, signups, admin actions
- [x] Events API (`/api/admin/events`) — aggregates from bookings, users, audit log
- [x] Filters: event type, date range, search by member, sort

### 5.2 Members Management
- [x] Members list page (searchable, credits + booking counts)
- [x] Members API (`/api/admin/members`)
- [x] Grant credits (comp session) — API + dialog UI

### 5.3 Packs Management
- [x] Packs CRUD page (create/edit/toggle active)
- [x] Packs API (`/api/admin/packs`) — GET, POST, PUT

### 5.4 Instructors Management
- [x] Instructors CRUD page (name, bio, photo, Instagram, active toggle)
- [x] Instructors API (`/api/admin/instructors`) — GET, POST, PUT

---

## Phase 6 — Email & Cron Jobs

- [x] Email service (`src/lib/email.js`) — Resend, branded HTML templates
- [x] Booking confirmation email (wired into `/api/bookings/create`)
- [x] Class reminder cron (`/api/cron/reminders`) — 1hr before, every 15min
- [x] Credit expiry cron (`/api/cron/expire-credits`) — daily, zeros expired + warns 3-day
- [x] Waitlist auto-promotion (`src/lib/waitlist.js`) — instant promotion when spot opens (cancel/remove)
- [x] Waitlist processing cron (`/api/cron/process-waitlist`) — every 5min safety net, uses shared utility
- [x] Vercel cron config (`vercel.json`)

**Env vars needed:** `RESEND_API_KEY`, `CRON_SECRET`

---

## Phase 7 — Security & Polish

- [x] Rate limiting on auth endpoints (`src/lib/rate-limit.js`)
- [x] Security headers (next.config.mjs)
- [x] Input validation (Zod on all API routes)
- [x] RLS policies on all tables
- [x] Admin audit logging

---

## TODO — Not Yet Started

### Admin Panel — Member Management
- [x] **Member detail view** — click member → full profile, booking history, credit history, waitlist, stats
- [x] **Member edit** — admin can edit member profile (name, email, phone, role)
- [x] **Member delete/deactivate** — cascading: cancel bookings, void credits, clear waitlist, anonymize
- [x] **Member stats** — total bookings, attendance rate, last visit, active credits
- [ ] **Member credit management** — view full credit history, adjust credits, void packs
- [ ] **Internal notes** — admin-only notes on member records

### Admin Panel — Bookings & Schedule
- [x] **Booking cancel on behalf** — admin can cancel a member's booking (with optional credit refund)
- [x] **Mark attendance** — attended / no-show buttons on bookings
- [x] **Recurring class generation** — day picker + weeks selector, grouped by recurring_id
- [x] **Recurring class management** — delete one/all, edit one/all, unlink from recurring set
- [x] **Time clash detection** — prevents overlapping classes for same instructor (create, edit, recurring)
- [x] **Class roster view** — click booking count in admin schedule to see full roster
- [x] **Private classes** — `is_private` on class_types, auto-applied to scheduled classes, hidden from public schedule
- [x] **Recurring in add class** — recurring toggle in main add class form (days + weeks), no separate dialog
- [x] **Notify members on class change** — popup after editing a class with bookings, stub API ready for Resend
- [x] **Booking override** — admin can manually book a member into a class (bypass capacity/credits) via roster dialog
- [x] **Roster waitlist management** — view waitlist, promote to attendee, remove from waitlist
- [ ] **CSV export** of bookings

### Admin Panel — Class Types
- [x] **Class types CRUD page** (`/admin/class-types`) — create/edit/toggle active, color picker, private toggle
- [x] **Class types API** (`/api/admin/class-types`) — GET, POST, PUT with audit logging

### Admin Panel — Private Classes (remaining)
- [x] **Add members to private class** — admin selects users to add via roster dialog, auto-creates bookings
- [ ] **Private class notifications** — email members when added to a private class

### Admin Panel — Other
- [x] **Admin activity feed** — unified events log on Activity page (replaced old Bookings page)
- [ ] **Pack reorder** — drag to change display_order
- [ ] **Instructor photo upload** to Supabase Storage

### Admin Settings (remaining tabs)
- [ ] **Studio Info tab** — name, address, phone, email, website
- [ ] **Booking Rules tab** — capacity default, cancellation window, waitlist claim hours
- [ ] **Reminders tab** — toggle 24h/2h reminders, edit reminder copy
- [ ] **Roster tab** — default show/hide setting
- [ ] **Data tab** — export all data, danger zone

### Email Notifications (all need `RESEND_API_KEY`)

All email templates live in `src/lib/email.js` (Resend, branded dark HTML).

**Coded & wired — just needs RESEND_API_KEY to go live:**
| # | Email Event | Trigger | Template fn | Called from |
|---|-------------|---------|-------------|------------|
| 1 | Booking confirmation | Member books a class | `sendBookingConfirmation` | `/api/bookings/create` |
| 2 | Class reminder (1hr before) | Cron every 15min | `sendClassReminder` | `/api/cron/reminders` |
| 3 | Waitlist auto-promotion | Spot opens (cancel/remove) | `sendWaitlistPromotion` | `src/lib/waitlist.js` (called from cancel, roster remove, admin booking cancel) |
| 4 | Waitlist promotion (cron) | Cron every 5min safety net | `sendWaitlistPromotion` | `/api/cron/process-waitlist` |
| 5 | Credit expiry warning (3 days) | Cron daily midnight | `sendCreditExpiryWarning` | `/api/cron/expire-credits` |

**Stub/API ready — needs email template + wiring:**
| # | Email Event | Trigger | Status |
|---|-------------|---------|--------|
| 6 | Class change notification | Admin edits class with bookings | API stub at `/api/admin/schedule/notify`, no template |
| 7 | Private class invitation | Admin adds member to private class | No template, no call wired |

**Not yet built — needs template + API + wiring:**
| # | Email Event | Trigger | Notes |
|---|-------------|---------|-------|
| 8 | Welcome email | User registers | Send from `/api/auth/register` |
| 9 | Cancellation confirmation | Member cancels booking | Send from `/api/bookings/cancel` |
| 10 | Class cancelled by admin | Admin cancels a class | Notify all booked members |
| 11 | Pack purchase confirmation | Stripe webhook payment success | Send from `/api/stripe/webhook` |
| 12 | Credits low warning | Credit drops to 1 remaining | Could be in booking create or cron |
| 13 | Admin direct email | Admin sends message to member | Done — compose UI on Emails page + engagement widget reminder |
| 14 | Password reset | User requests reset | Needs forgot-password flow + token |
| 15 | Admin removes from class | Admin removes member via roster | Notify the removed member |
| 16 | Admin cancels booking | Admin cancels on behalf of member | Notify the member |

### Dashboard Enhancements
- [x] **Today's classes** — schedule-style cards on admin dashboard (colored border, time range, capacity bar, clickable to schedule page)
- [x] **Member engagement widget** — two tabs: "At Risk" (inactive 14+ days with credits, one-click email reminder) + "Top Members" (leaderboard, last 30 days)
- [x] **Revenue widget admin-only** — hidden from employee role
- [ ] Password reset / forgot password flow (token-based, email link)
- [ ] Google account linking (merge email + Google accounts)

### Reporting
- [ ] Revenue reports (daily/weekly/monthly)
- [ ] Attendance reports (by class, by instructor, by time)
- [ ] Member retention / churn metrics
- [ ] Export reports to CSV

### Owner Role & Platform Limits
- [ ] **Owner role** — new top-level role above admin. Only assignable by platform operator (Jacob) via DB or `PLATFORM_OWNER_ID` env var
- [ ] **Owner permissions** — can edit all admins/employees, connect Stripe, change platform limits, access billing
- [ ] **Admin restrictions** — admins cannot edit other admins (only employees + members). Cannot assign admin/owner roles
- [ ] **Platform resource limits** — server-side enforcement on all creation endpoints:
  - Max classes/month (default 200)
  - Max active members (default 500)
  - Max instructors (default 20)
  - Max class types (default 30)
  - Max storage (default 500MB)
  - Max emails/month (default 2000)
  - Max active packs (default 20)
- [ ] **Usage dashboard** — owner-only page showing current usage vs limits
- [ ] **Limit override** — owner can adjust via platform settings, future: tie to billing tiers
- [ ] **Security fixes** — see `docs/security-audit.md` for 19 findings (2 critical, 6 high, 6 medium, 5 low)

### Infrastructure
- [ ] **Set up env vars** — `RESEND_API_KEY` (Resend email), `CRON_SECRET` (cron job auth), `PLATFORM_OWNER_ID` (owner user ID)
- [ ] Vercel deployment config
- [ ] Custom domain setup
- [ ] Supabase production environment
- [ ] Stripe production keys + webhook endpoint
- [ ] Resend domain verification
- [ ] **Run migration SQL** — add `expiry_warned` column to `user_credits` table (see schema.sql)
- [ ] **Run migration SQL** — add `is_private BOOLEAN DEFAULT false` column to `class_schedule` table
- [ ] **Run migration SQL** — add `is_private BOOLEAN DEFAULT false` column to `class_types` table

### Missing Pages
- [ ] **Forgot password page** (`/forgot-password`) — token-based email reset flow
- [ ] **Privacy policy page** (`/privacy`)
- [ ] **Terms of service page** (`/terms`)
- [ ] **404 page**

### Member Dashboard Gaps
- [x] **Waitlist UI in dashboard** — backend exists but member can't see their waitlist positions
- [x] **Calendar view** — referenced in member dashboard tabs but not rendered

### Quality
- [ ] Mobile QA pass on all member pages
- [ ] Accessibility audit (ARIA, keyboard nav, contrast)
- [ ] Loading states and error boundaries on all pages
- [ ] Empty states for all lists

---

## Technical PM Review — Critical Findings (2026-03-09)

### Blockers for Production Launch

1. **Stripe not wired to UI** — Checkout sessions, webhook handler, and billing portal are all built but the Buy Classes page has no working payment flow. Direct purchase only (no real money moves).
2. **Email not functional** — `RESEND_API_KEY` not set. All email code (confirmations, reminders, waitlist promotions, expiry warnings) is dead code until configured.
3. **Notify endpoint is a stub** — `/api/admin/schedule/notify` sends no actual emails.
4. **Rate limiting is in-memory** — `Map`-based rate limiter resets on each Vercel cold start and doesn't share state across instances. Needs Redis or Vercel KV for production.
5. **Missing DB migrations** — `is_private` on `class_types`, `expiry_warned` on `user_credits` may not exist in production Supabase. Must run migration SQL.

### High Priority

6. **Admin Settings page** — 3 of 4 tabs are stubs (Studio Info, Booking Rules, Reminders). Only Emails tab is rendered (also placeholder).
7. **Admin Emails page** — placeholder, no functionality.
8. **No instructor photo upload** — form field exists but no upload-to-storage flow.
9. **No reporting/analytics** — no revenue, attendance, or retention reports.
10. **Forgot password flow missing** — no page, no token generation, no reset email.

### Medium Priority

11. **No `/privacy` or `/terms` pages** — footer links to nowhere.
12. **Member waitlist UI missing** — backend fully built but dashboard doesn't show waitlist positions.
13. **Calendar view tab** in member dashboard referenced but not rendered.
14. **Google account linking** — can't merge email + Google identities.
15. **Booking cancellation email** — member cancels but gets no confirmation.
16. **Class cancelled by admin** — booked members get no notification.

---

## Potential Extra Features

### Analytics & Reporting
- [ ] **Admin analytics dashboard** — visual charts (attendance trends, popular class times, busiest days)
- [ ] **Instructor performance** — classes taught, avg attendance rate, member ratings
- [ ] **Class popularity ranking** — most booked class types, fill rate comparison
- [ ] **Peak hours heatmap** — visualize busiest booking times across the week
- [ ] **Member retention metrics** — active vs lapsed members, churn rate, avg lifetime
- [ ] **Revenue reports** — daily/weekly/monthly breakdown, pack sales, avg revenue per member
- [ ] **Export reports to CSV/PDF**

### Member Badges & Awards
- [ ] **Achievement badges** — auto-awarded milestones (first class, 10 classes, 50 classes, 100 classes, etc.)
- [ ] **Streak tracking** — consecutive weeks attending, longest streak record
- [ ] **Class variety badge** — attended X different class types
- [ ] **Early bird / night owl** — badges for morning vs evening attendance patterns
- [ ] **Loyalty badge** — member for 3/6/12 months
- [ ] **Leaderboard** — opt-in monthly attendance leaderboard among members
- [ ] **Badge showcase on profile** — members can view their collection on dashboard
- [ ] **Admin badge management** — create custom badges, manually award to members

### Manual Member Management
- [ ] **Admin manual member creation** — add a member directly (name, email, phone) without them registering
- [ ] **Assign credits manually** — give a new member a pack/credits on creation
- [ ] **Invite member via email** — send a registration link with pre-filled details
- [ ] **Bulk member import** — CSV upload to onboard multiple members at once
- [ ] **Walk-in registration** — simplified form for front-desk sign-up (minimal fields)

### Community & Engagement
- [ ] **Class reviews/ratings** — members rate classes after attending
- [ ] **Announcements/news feed** — admin posts updates visible on member dashboard
- [ ] **Referral program** — members share a referral link, earn bonus credits
- [ ] **Birthday perks** — auto-detect birthday month, trigger reward or email
- [ ] **Push notifications** — browser push for class reminders, waitlist promotions

### Scheduling Enhancements
- [ ] **Instructor availability** — instructors set their own availability, admin sees conflicts
- [ ] **Substitute instructor flow** — assign a sub, notify booked members
- [ ] **Class templates** — save a weekly template, one-click apply to future weeks
- [ ] **Holiday/closure management** — mark dates as closed, auto-cancel affected classes

---

## Database Schema (12 tables)

| Table | Purpose |
|-------|---------|
| `users` | Auth & profiles |
| `password_reset_tokens` | Password recovery |
| `login_attempts` | Login audit |
| `class_types` | Class definitions |
| `instructors` | Coach profiles |
| `class_schedule` | Scheduled classes |
| `class_packs` | Purchasable packs |
| `user_credits` | Member credit balances |
| `bookings` | Class bookings |
| `waitlist` | Overflow queue |
| `admin_audit_log` | Admin actions |
| `studio_settings` | KV config store |

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** JavaScript (no TypeScript)
- **Styling:** Tailwind CSS v4 + Framer Motion
- **Auth:** NextAuth v5 (Google OAuth + Credentials)
- **Database:** Supabase (Postgres + Storage)
- **Payments:** Stripe (Connect model)
- **Email:** Resend
- **UI Components:** shadcn/ui (Button, Card, Input, Label, Badge, Tabs, Dialog, Switch)
- **Hosting:** Vercel (planned)


---

## BUILD BATCH 1 — Autonomous Build (no Stripe/Resend keys needed)

> **Instructions for Claude:** This is the next batch to build. Work through items in order of section.
> All email code is safe without RESEND_API_KEY (guarded by `if (!resend) return`).
> Do NOT attempt: Stripe key wiring, Resend domain verification, password reset (needs email), Google account linking, reporting dashboards.

### A. Admin Emails Page — Full Build
- [x] A1. **Email log viewer** — replace placeholder with reference table of all 16 email events (live/stubbed/not built status)
- [x] A2. **Branded email template system** — create a rich Mailchimp-style HTML base template (dark theme, gold accents, BOXX logo, footer). All emails share this base.
- [x] A3. **Build remaining email templates** in `src/lib/email.js`: `sendWelcomeEmail`, `sendCancellationConfirmation`, `sendClassCancelledByAdmin`, `sendPackPurchaseConfirmation`, `sendCreditsLowWarning`, `sendRemovedFromClass`, `sendAdminCancelledBooking`
- [x] A4. **Wire templates into trigger points** — register route, cancel route, admin cancel class, stripe webhook, booking create (low credit check), admin roster remove, admin booking cancel
- [x] A5. **Admin compose email** — form on Emails page to send a direct email to any member (select member, subject, body)
- [x] A6. **Admin email template editor** — let admins preview and customize email copy/branding from Emails page (store overrides in `studio_settings`)

### B. Admin Settings — Build Real Tabs
- [x] B1. **Studio Info tab** — name, address, phone, email, website (read/write `studio_settings`)
- [x] B2. **Booking Rules tab** — default capacity, cancellation window hours, max advance booking days
- [x] B3. **Reminders tab** — toggle 24h/1h reminders on/off

### C. Missing Pages
- [x] C1. **Privacy Policy page** (`/privacy`) — standard template with BOXX details
- [x] C2. **Terms of Service page** (`/terms`) — standard template
- [x] C3. **404 page** (`not-found.js`) — branded dark theme with back/home links

### D. Admin Activity Page — Redesign
- [x] D1. **Richer event cards** — more details (member name, class, time, credit info), color-coded by event type
- [x] D2. **Expandable event detail view** — click to expand with full context (booking details, credit used, admin who actioned, timestamps)
- [x] D3. **Better filtering and grouping** — group by day, clearer visual hierarchy

### E. Employee Role
- [x] E1. **New `employee` role** — can view entire admin dashboard, schedule, members, activity. Restricted from: deleting/deactivating members, changing settings, managing packs/pricing, connecting Stripe. Can: mark attendance, manage roster (add/remove members), create/edit classes, view activity. Middleware + UI enforcement.

### F. Member Dashboard Gaps
- [x] F1. **Waitlist positions in dashboard** — show active waitlist entries with position badges
- [x] F2. **Private class image/badge** — distinct visual for private classes in My Bookings
- [x] F3. **Fix iCal/Add to Calendar** — debug the JSON error page on `.ics` download
- [x] F4. **Hue effect on My Bookings calendar** — category color system like admin schedule (purple=recurring, amber=private, sky=regular)

### G. Buy Packs Page — Full Redesign
- [x] G1. **Research-driven redesign** — study pricing psychology (anchoring, "Most Popular" badge, urgency, value framing, comparison layout). Tiered cards with visual hierarchy, per-class price breakdown, savings percentage, social proof, smooth purchase flow. Make it a genuinely compelling sales page.

### H. Gamification & Member Profiles
- [x] H1. **Weekly streak tracker** — consecutive weeks with at least 1 class
- [x] H2. **Total classes counter** — lifetime attendance
- [x] H3. **Achievement badges** — milestones (First Class, 10/25/50/100 classes, streak badges, class variety)
- [x] H4. **Profile gamification display** — show streak, total classes, badges on member profile visible in Book Classes view
- [x] H5. **Badge showcase** — visual badge grid on profile

### I. Admin Dashboard Review
- [x] I1. **Audit and improve admin dashboard** — review current stats, assess usefulness for a studio owner. Add/replace with: today's revenue, week-over-week trends, upcoming classes needing attention (low bookings, full), recent cancellations, quick actions.

### J. Admin Design/CMS Page
- [x] J1. **New `/admin/design` page** — let admins customize public homepage: social media links, gallery images (upload/reorder), hero text/CTA, contact info overrides. Store in `studio_settings`, read from public pages.

### K. Notify Endpoint + Business Logic
- [x] K1. **Complete `/api/admin/schedule/notify`** — build `sendClassChanged` template, wire actual sending
- [x] K2. **Class type deletion safety** — soft-delete or prevent if future classes exist
- [x] K3. **Instructor deletion safety** — same pattern
- [x] K4. **Pack deletion safety** — prevent deleting packs with active credits
- [x] K5. **Freeze member** (instead of deactivate) — preserves data, blocks login, reversible by admin
- [x] K6. **Fix login redirect** — ensure proper same-tab redirect behavior

### L. CSV Export
- [x] L1. **Bookings CSV export** — download button on Activity page

---

### Handwritten Notes (reviewed → absorbed into batch above)
- ~~Update the public UI to include the Hue effect~~ → F4
- ~~Improve the dashboard~~ → I1
- ~~Include a send email to attendees option in the events~~ → K1
- ~~More business logic tests, what happens if a class type gets deleted? etc~~ → K2, K3, K4
- ~~Test the admin on mobile~~ (done — mobile responsive fixes applied across all admin pages)
- ~~Add a new image for the private classes for when it shows in a users my bookings~~ → F2
- ~~redo the buy packs screen~~ → G1
- ~~open new tab when logging in~~ → K6
- ~~change location of toast message on the public app~~ (done — member dashboard + buy-classes toasts moved to fixed bottom-right floating)
- ~~Freeze member instead of deactivate is better~~ → K5

---

## POST-BATCH POLISH (2026-03-10)

> UI/UX improvements, engagement features, and fixes applied after BUILD BATCH 1.

### Activity Page
- [x] **Enriched admin events** — human-readable details (e.g., "Removed Sarah from BOXXBEGINNER" instead of "Removed member from class")
- [x] **Batch-resolved audit log** — old entries missing enriched JSONB get backfilled via batch lookups at read time

### My Bookings & Schedule
- [x] **Private class colors** — use admin-set class type color from DB, fallback to name-based detection (`private`, `1:1`, `personal`)
- [x] **Private class card image** — uses `pt-session.webp` instead of generic class images
- [x] **Google Calendar button** — teal pill with calendar+plus icon, "Add" label, only shown for Google OAuth users
- [x] **Calendar button layout** — next to Share button, cancellation info on separate row below
- [x] **Default to list view** — schedule defaults to card list instead of calendar, toggle icons swapped

### Buy Packs Page
- [x] **Equal height cards** — CSS grid with `h-full` + `flex-1` for consistent card heights
- [x] **Mobile 2x2 grid** — `min-[400px]:grid-cols-2`, stacked vertically on very small screens
- [x] **Removed "Most Popular" from single class** — only multi-credit packs get the badge

### Gamification
- [x] **Widget always visible** — shows even with 0 classes attended (was hidden for new members)

### Admin Dashboard
- [x] **Revenue widget admin-only** — hidden from employee role, employees see 3 stat cards
- [x] **Member engagement widget** — full-width, two tabs:
  - **At Risk:** members with active credits but no bookings in 14+ days, "Never booked" badge, one-click "Remind" email button
  - **Top Members:** leaderboard of most active members by bookings in last 30 days (gold/silver/bronze styling)

### Homepage
- [x] **Hero button consistency** — equal-width buttons (sm:w-[260px] + whitespace-nowrap), transparent hover fill on secondary buttons
- [x] **Nav legibility gradient** — dark gradient at top of hero for visible nav links against background image
- [x] **WhatsApp floating widget** — desktop-only, bottom-right, dark card style with gold WhatsApp icon, breathing pulse ring, tooltip card on hover ("Message us on WhatsApp")

### Member Dashboard
- [x] **Profile widget redesign** — merged ProfileSection + GamificationWidget into one cohesive card: larger avatar (72px), inline stats (classes/streak/badges as subtitle), collapsible badges, credits in distinct bottom band
- [x] **Avatar upload fix (mobile)** — accept any image/* MIME type (was failing on mobile Chrome HEIC/HEIF), increased max to 10MB
- [x] **Avatar instant update** — local state for immediate preview after upload, switched from Next.js Image to plain img to avoid aggressive caching
- [x] **Hide bio/email from profile view** — kept in edit form only
- [x] **Buy Packs CTA** — only shown when user has no active credits, inside credit widget

### Seed Data
- [x] **Rich seed SQL** — varied data for Jacob, Bert, Test User across 6 weeks: streaks, badges, waitlists, cancellations, multiple active packs with different expiry/usage states