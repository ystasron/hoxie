# Hoxie

A simple math quiz where users log in / sign up, answer up to **20,000 questions per day**, and earn **₱0.025 per correct answer**. Accounts, profiles, and points are saved to Supabase.

## Files

| File        | Purpose                                              |
| ----------- | ---------------------------------------------------- |
| `index.html`| Login/signup page + quiz page (brand: Hoxie, logo in `img/hoxie.jpg`) |
| `style.css` | Styling                                             |
| `script.js` | Auth, quiz logic, daily limit, Supabase saves        |
| `config.js` | **Your Supabase URL + anon key go here**             |
| `setup.sql` | `profiles`, `withdrawals`, `daily_answers`, `comment_links`, `login_rewards` tables, triggers, RPCs, RLS policies (run once in Supabase) |
| `supabase/functions/help-ai/` | Edge Function that proxies Help-chat messages to **Google Gemini** (the API key stays in function secrets; the assistant's role is a `system_instruction`) — deploy with `npx supabase functions deploy help-ai --project-ref <ref>` and set the `GEMINI_API_KEY` secret |

## Setup

1. **Create the table** — in your Supabase dashboard open the **SQL Editor**, paste the contents of `setup.sql`, and run it. This creates:

   - `profiles` — one row per user with `total_points` (lifetime earnings), `current_points` (spendable balance), withdrawal details (`withdrawal_method`, `gcash_number`), and bounty fields (`referral_code`, `rate_bonus`, `referred_by`, `referral_count`) (no per-answer log is stored)
   - `daily_answers` — today's tally is enforced server-side (questions are issued statelessly and signed with HMAC — no `questions` table exists, so no answers are stored anywhere)
   - `comment_links` — bounty comment submissions (user submits a link as `pending`; the admin flips it to `success` in the dashboard)
   - `login_rewards` — daily login claims (₱3.00/day; a 7-day streak adds a permanent +₱0.003 per-question rate, and a missed day resets the streak)
   - a trigger that auto-creates a profile on signup (with a unique referral code) and RLS policies so users can only touch their own data

   The script also drops the old `answer_earnings` table if it exists.

2. **Add your credentials** — in your Supabase dashboard go to **Project Settings → API**. Copy the **Project URL** and the **anon public** key into `config.js`:

   ```js
   const SUPABASE_CONFIG = {
     url: "https://xxxx.supabase.co",
     anonKey: "eyJ...",
     table: "answer_earnings",
   };
   ```

3. **Enable Google sign-in** (optional but recommended):

   - In your Google Cloud Console, create an **OAuth 2.0 Client ID** (type: Web application) under APIs & Services → Credentials, with your site URL as an **Authorized JavaScript origin** and `https://<project-ref>.supabase.co/auth/v1/callback` as an **Authorized redirect URI**.
   - In Supabase → **Authentication → Providers → Google**, toggle it on and paste the Client ID and Client Secret.
   - In Supabase → **Authentication → URL Configuration → Redirect URLs**, add your site URL (e.g. `http://localhost:5500` while testing locally — OAuth won't redirect back to a bare `file://` page).

4. **Open `index.html`** in a browser (or serve the folder with any static server, e.g. `npx serve`). That's it.

## How it works

- Users sign up / log in with email + password via Supabase Auth.
- Each correct answer adds the user's current rate to both `current_points` (spendable balance) and `total_points` (lifetime earnings) on their profile in Supabase. The base rate is **₱0.025**, plus any permanent bounty bonus (see below) — no per-answer log is kept.
- **Everything is server-side**: questions are issued by the `get_question` RPC as a signed token (the answer never reaches the client and nothing is stored), `submit_answer` verifies the signature + answer, credits points, and enforces the daily limit. Direct UPDATE on the points columns is revoked — the client can never write them. Withdrawals deduct via the `request_withdrawal` RPC. Users may still edit their own profile-info columns (name, birthday, withdrawal method/number).
- The **20,000/day limit** counts every submitted question (right or wrong) and resets at midnight Manila time; it's enforced in the `daily_answers` table server-side, so clearing localStorage can't bypass it.
- The Withdraw view lets users pick a method (GCash for now) and save their GCash number. The number is permanent — a DB trigger rejects any later change to it.
- Once the balance reaches **₱100** (the minimum withdrawal), a Withdraw button appears; it deducts the full balance from `current_points` (never `total_points`) and records the request in `withdrawals`. The record + deduction happen atomically in the `request_withdrawal` RPC. Withdrawal history is shown in the same view.
- The **Bounty** view has two ways to boost your rate:
  - **Referral** — every user has a unique referral code (auto-generated on signup). When a friend signs up and redeems it, the referrer instantly earns **₱20.00** and gets **+₱0.01** added to their per-question rate forever, and the friend who redeems also earns **₱20.00** (via the `redeem_referral` RPC — one redemption per account). The referral count is a plain column you can edit manually in the dashboard.
  - **Comment to posts** — users paste the link of a comment they made on your posts; it's saved as `pending` in `comment_links`. When you flip its status to `success` in the dashboard, a DB trigger permanently adds **+₱0.005** to their rate (pending stays coral, success turns green in the history list).
- The quiz generates questions of four types (addition, subtraction, multiplication, division), server-side.
- The **bell icon** in the quiz top bar opens the **System Notice** modal — an alternating timeline of system announcements (each entry has an emoji, bold title, description with links, and a relative timestamp). The feed is a static, easy-to-edit list (`SYSTEM_NOTICES` in `script.js`); unread entries get a coral node and the bell shows a red dot until the modal is closed. The single **Close Notice** button (or the ✕, Escape, or the dimmed backdrop) marks everything read. To publish a notice, add an entry with a higher `id` than the newest one.

## Notes

- **No email confirmation**: turn off Auth → Sign In / Up → Email → "Confirm email" in the Supabase dashboard. With it off, email+password signup goes straight into the app (no verification link). Google sign-in never requires confirmation.
- **Upgrading from the old anonymous version**: if you already ran the old `setup.sql` and have test rows with random anonymous ids, clear them first — run `delete from public.answer_earnings;` in the SQL Editor. Otherwise those rows (non-UUID ids) will make read queries fail.
- `setup.sql` includes a commented-out query to list each user's total points and current balance — useful for payout verification.
- The daily limit is enforced server-side in `daily_answers`, so it's a hard cap.