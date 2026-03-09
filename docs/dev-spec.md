# BOXX Development Spec & Progress Tracker

> Last updated: 2026-03-09 (post technical PM review)

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
- [x] Waitlist processing cron (`/api/cron/process-waitlist`) — every 5min, auto-book + email
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

**Already coded (need Resend API key to activate):**
- [ ] Booking confirmation email (in `/api/bookings/create`)
- [ ] Class reminder — 1hr before (in `/api/cron/reminders`)
- [ ] Waitlist promotion notification (in `/api/cron/process-waitlist`)
- [ ] Credit expiry warning — 3 days (in `/api/cron/expire-credits`)

**Stub/API ready, email template needed:**
- [ ] Class change notification — admin edits class, notify booked members (`/api/admin/schedule/notify`)
- [ ] Private class invitation — admin adds member to private class

**Not yet built:**
- [ ] Welcome email on registration
- [ ] Cancellation confirmation email (member cancels booking)
- [ ] Class cancelled by admin — notify booked members
- [ ] Pack purchase confirmation email
- [ ] Credits low warning email (1 credit remaining)
- [ ] Admin direct email to individual member
- [ ] Password reset email (token-based link)

### Dashboard Enhancements
- [x] **Today's classes** — schedule-style cards on admin dashboard (colored border, time range, capacity bar, clickable to schedule page)
- [ ] Password reset / forgot password flow (token-based, email link)
- [ ] Google account linking (merge email + Google accounts)

### Reporting
- [ ] Revenue reports (daily/weekly/monthly)
- [ ] Attendance reports (by class, by instructor, by time)
- [ ] Member retention / churn metrics
- [ ] Export reports to CSV

### Infrastructure
- [ ] **Set up env vars** — `RESEND_API_KEY` (Resend email), `CRON_SECRET` (cron job auth)
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
- [ ] **Waitlist UI in dashboard** — backend exists but member can't see their waitlist positions
- [ ] **Calendar view** — referenced in member dashboard tabs but not rendered

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





My notes for claude to pick up and add into the file, mark as crossed out when reviewed and added
- Update the public ui to include the Hue effect
- Improve the dashboard
- Include a send email to attendees option in the events
- More business logic tests, what happens if a class type gets deleted? etc
- ~~Test the admin on mobile~~ (done — mobile responsive fixes applied across all admin pages)
- Add a new image for the private classes for when it shows in a users my bookings
- redo the buy packs screen
- open new tab when logging in
- change location of toast message on the public app, make it like a proper bottom screen toast
