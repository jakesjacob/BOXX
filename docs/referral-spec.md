# BOXX Referral System — Implementation Spec
Version 1.0 · March 2026

---

## 1. Overview

Opt-in referral feature for BOXX. Admin configures a reward (a class pack) and a referral threshold. Members get a unique referral link. When a referred person signs up and completes their first paid purchase, it counts toward the referrer's reward. Once the referrer hits the required number of successful referrals, they receive the reward pack as free credits.

---

## 2. Business Logic

### 2.1 When a Referral Counts
- Referral code is captured at signup (stored on the new user's `referred_by` field)
- A referral becomes **successful** when the referred user completes their first paid purchase (Stripe webhook or direct purchase)
- Account creation alone does NOT trigger anything — the referral stays `pending`
- Only the first purchase counts per referred user
- Code must be captured at signup — cannot be applied retroactively

### 2.2 Reward Structure
- Admin selects a **reward pack** from existing active class packs (e.g. "1 Single Class")
- Admin sets **referrals_required** — how many successful referrals needed to earn one reward (default: 1)
  - Example: referrals_required = 3 means the referrer needs 3 friends to sign up AND purchase before they earn the reward
- When the threshold is met, the reward pack's credits are automatically granted to the referrer
- The counter resets after each reward — so with threshold 3, referrals 1-3 earn reward #1, referrals 4-6 earn reward #2, etc.
- No cap on total rewards in v1

### 2.3 Referral States

| State | Meaning |
|---|---|
| `pending` | Referred user signed up but hasn't purchased yet |
| `successful` | Referred user completed first purchase |
| `flagged` | Abuse threshold triggered — needs admin review |
| `rejected` | Admin rejected a flagged referral |

### 2.4 Abuse Prevention
- A referred email can only count once — even if user deletes account and re-registers
- Self-referral: block if referrer email === referee email
- Flag for review (don't auto-reward) if referrer has >10 successful referrals in 30 days
- Optional minimum purchase amount (e.g. must buy at least a 5-class pack)
- Flagged referrals need manual admin approval before counting toward the reward threshold

---

## 3. Database Schema

### 3.1 New Table: referral_config
Single row — feature settings. Referral page hidden from members unless `is_active = true` AND `reward_pack_id` is set.

```sql
CREATE TABLE referral_config (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active           BOOLEAN DEFAULT false,
  reward_pack_id      UUID REFERENCES class_packs(id),
  referrals_required  INT DEFAULT 1,
  min_purchase_thb    INT,                    -- null = no minimum
  headline            TEXT DEFAULT 'Refer a Friend, Earn Free Classes',
  description         TEXT DEFAULT 'Share your link. When your friend signs up and buys their first pack, you earn a reward.',
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 New Table: referrals
One row per referral relationship. Created at signup when a new user has a referral code.

```sql
CREATE TABLE referrals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id         UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  referee_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  referee_email       TEXT NOT NULL,
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending','successful','flagged','rejected')),
  reward_pack_id      UUID REFERENCES class_packs(id),   -- snapshot from config at time of referral
  purchase_credit_id  UUID REFERENCES user_credits(id),   -- the purchase that triggered success
  rewarded_at         TIMESTAMPTZ,
  admin_notes         TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_referee ON referrals(referee_id);
CREATE INDEX idx_referrals_status ON referrals(status);
CREATE UNIQUE INDEX idx_referrals_referee_email ON referrals(referee_email);
```

### 3.3 Users Table Changes

```sql
ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN referred_by TEXT;

-- referral_code: unique 8-char code generated on account creation
-- referred_by: the referral_code used when this user signed up (if any)
```

Backfill migration for existing users:
```sql
UPDATE users SET referral_code = substr(md5(random()::text), 1, 8)
WHERE referral_code IS NULL;
```

### 3.4 No separate adjustments table
Manual admin actions (approve, reject, manual credit grants) are logged to the existing `admin_audit_log` table with `action = 'referral_approve'`, `'referral_reject'`, etc.

---

## 4. API Endpoints

### 4.1 Member APIs

**`GET /api/referrals`** — Get member's referral data
- Auth required (any member)
- Returns: referral config (headline, description, reward pack name, referrals_required), user's referral_code, referral_link, referral history (masked referee info), progress toward next reward, earned rewards

**`GET /api/referrals/config`** — Public check if referral feature is active
- No auth required
- Returns: `{ active: true/false }` — used by signup page to know whether to show referral UI

### 4.2 Admin APIs

**`GET /api/admin/referrals`** — List all referrals with stats
- Auth: admin/owner
- Query params: `?status=pending|successful|flagged|rejected`, `?search=name_or_email`
- Returns: stats summary + filtered referrals list

**`GET /api/admin/referrals/config`** — Get referral config
- Auth: admin/owner

**`PUT /api/admin/referrals/config`** — Update referral config
- Auth: admin/owner
- Body: is_active, reward_pack_id, referrals_required, min_purchase_thb, headline, description

**`PATCH /api/admin/referrals/[id]`** — Approve or reject a flagged referral
- Auth: admin/owner
- Body: `{ action: 'approve' | 'reject', notes: '...' }`

### 4.3 Modified Existing APIs

**`POST /api/auth/register`** — Add `referredBy` to accepted fields
- If present, validate the code exists and belongs to a different user
- Check referee_email hasn't been used in a previous referral
- Store `referred_by` on the user record
- Create a `referrals` row with status `pending`

**Stripe webhook (`checkout.session.completed`) + Direct purchase** — Add referral trigger
- After credits are allocated, check if the purchasing user has `referred_by` set
- If yes, look up their pending referral and process it (see trigger logic below)

---

## 5. Trigger Logic

### 5.1 On Signup (with referral code)
```
1. Generate referral_code for new user (8-char alphanumeric, retry on collision)
2. If referredBy param is present:
   a. Validate code exists, belongs to a different active user
   b. Check referee email not in existing referrals table
   c. Store referred_by on user record
   d. Create referrals row: status='pending', snapshot reward_pack_id from config
```

### 5.2 On First Purchase (by referred user)
```
1. After credit allocation, check if user has referred_by set
2. Look up referral row for this user where status = 'pending'
3. If found:
   a. Check min_purchase_thb (if set) — skip if purchase is below
   b. Check abuse: has referrer had >10 successful referrals in last 30 days?
      - YES → set status = 'flagged', stop
      - NO → set status = 'successful', set purchase_credit_id
   c. Count referrer's total successful (unflagged) referrals
   d. If count % referrals_required === 0 → issue reward:
      - Create user_credits row for referrer with reward pack details
      - Set referral.rewarded_at = now()
      - Log to admin_audit_log
```

### 5.3 On Admin Approve (flagged referral)
```
1. Set status = 'successful'
2. Re-check reward threshold — issue reward if threshold now met
3. Log to admin_audit_log with notes
```

### 5.4 On Admin Reject
```
1. Set status = 'rejected'
2. No reward
3. Log to admin_audit_log with notes
```

---

## 6. UI Pages

### 6.1 Member Referral Page
Route: `/referrals` (in `(member)` route group)

**Gate:** Redirect to `/dashboard` if referral feature is not active.

Content:
- Headline + description from config
- Referral link with copy button
- Info tooltip explaining how it works (mention referrals_required if > 1)
- **Progress indicator** — "2 of 3 referrals toward your next reward" (progress bar)
- Referral history — referee first name only (never full email), date, status badge
- Rewards earned — list of credits received from referrals

### 6.2 Admin Referral Settings
Route: `/admin/referrals/settings`

- Active toggle (disabled if no reward pack selected)
- Reward pack dropdown (from active class_packs)
- Referrals required input (number, min 1)
- Minimum purchase amount (THB, optional)
- Headline + description text inputs
- Preview card showing how it looks to members

### 6.3 Admin Referral Dashboard
Route: `/admin/referrals`

- Stat cards: Total / Successful / Pending / Flagged
- Filterable table: referrer name, referee name, date, status, reward, actions
- Approve/Reject buttons on flagged rows (with notes dialog)

### 6.4 Signup Page Modification
- If `?ref=CODE` is in the URL, show a small banner: "You were referred by [referrer first name]"
- Store the code in form state, pass to register API

---

## 7. Admin Sidebar
Add "Referrals" link to admin sidebar between Analytics and Emails:
- Icon: `Gift` (from Lucide)
- Route: `/admin/referrals`
- `adminOnly: true`

---

## 8. Out of Scope (v1)
- Double-sided rewards (referee gets something too)
- Points system
- Social sharing buttons
- Leaderboard / gamification
- Email campaigns to prompt referrals
- Automatic redemption at checkout
- Referral expiry / time limits

---

## 9. Implementation Order

### Phase 1: Database + Config
- [ ] Add referral_code, referred_by columns to users table
- [ ] Create referral_config table
- [ ] Create referrals table
- [ ] Backfill referral_code for existing users
- [ ] Admin referral settings page + API (config CRUD)

### Phase 2: Core Flow
- [ ] Modify registration to capture referral code + create pending referral
- [ ] Modify signup page to read ?ref= param and show referrer banner
- [ ] Add referral trigger to Stripe webhook + direct purchase
- [ ] Reward granting logic (threshold check, credit allocation)
- [ ] Abuse detection (flag >10 in 30 days)

### Phase 3: Member UI
- [ ] Member referral page (/referrals) with link, progress, history
- [ ] Add "Referrals" link to member dashboard sidebar/nav

### Phase 4: Admin Management
- [ ] Admin referral dashboard (stats, table, filters)
- [ ] Approve/reject flagged referrals
- [ ] Add referrals link to admin sidebar
