# Hoxiee

**What it is:** A web app where logged-in users answer simple math questions and earn points.

**Core loop:** A question is generated randomly server-side (addition, subtraction, multiplication, division — the answer never reaches the client). A correct answer earns the user's current rate, credited to their running points total. The base rate is ₱0.025, and permanent bonuses from the Bounty section stack on top.

**Hard rules:**
- Rate is ₱0.025 per *correct* answer, plus any bounty bonus (referral: +₱0.01 per referred friend; approved comment: +₱0.005). Wrong answers earn nothing.
- New signups start **inactive**: they cannot answer questions, use the profile settings, or access the other views — they are redirected to a subscribe screen (Messenger / Facebook Group links) until an admin flips `account_status` to `active` in the dashboard.
- Max 20,000 questions per user per day; the cap counts every submitted question (right or wrong) and resets at midnight Manila time. Enforced server-side in `daily_answers` — clearing localStorage can't bypass it.
- No per-answer history is stored — only the running totals on the profile.
- Referral bonus: each user has a unique auto-generated code; redeeming one pays the referrer ₱20 instantly and +₱0.01/rate, and the redeemer ₱20, once per account.
- Daily login reward: every user can claim ₱3.00 once per Manila day. Six consecutive days of claiming makes the 7th day of the cycle also add a permanent +₱0.003 per-question rate; missing a day resets the streak (weekly cycle repeats after day 7). A red dot appears on the Bounty icon while today's claim is still available.

**Accounts:** Supabase Auth — email/password and Google sign-in. A profile row (id, email, points, referral_code) is auto-created on signup; RLS restricts users to their own row, and points/rate-bonus columns are not client-writable (all changes go through server-side RPCs).

**Audience:** Casual users on desktop and mobile doing quick mental math for small earnings.

**Non-goals:** Per-answer history, admin UI (withdrawal/comment statuses are edited directly in the Supabase dashboard), payments/payouts (withdrawals are requested in-app and settled manually).