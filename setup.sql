-- ============================================================
-- Hoxie — Supabase setup (v12: daily login rewards — v11: stateless signed questions)
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run: every statement is idempotent.
-- ============================================================

-- 0) The old per-answer log is no longer used — drop it if it exists.
drop table if exists public.answer_earnings;

-- pgcrypto powers the HMAC used to sign questions (Supabase ships it).
-- Install it in the `extensions` schema (Supabase's default location on
-- newer projects) so hmac() resolves for the functions below.
create extension if not exists pgcrypto with schema extensions;

-- 1) Profiles: one row per user — points plus profile info.
--    current_points = spendable balance
--    total_points   = lifetime total earned (never decreases)
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text           not null,
  current_points numeric(12, 3) not null default 0,
  total_points   numeric(12, 3) not null default 0,
  name           text,
  account_status text           not null default 'inactive',
  birthday           date,
  withdrawal_method  text           not null default 'gcash',
  gcash_number       text,
  created_at         timestamptz    not null default now(),
  updated_at         timestamptz    not null default now()
);

-- v4 → v5 migration: earlier installs have a `points` column. Rename it
-- to `current_points` (its data becomes the starting current balance).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'points'
  ) then
    alter table public.profiles rename column points to current_points;
  end if;
end $$;

-- Make sure both columns exist on any pre-existing table
alter table public.profiles add column if not exists current_points numeric(12, 3) not null default 0;
alter table public.profiles add column if not exists total_points numeric(12, 3) not null default 0;

-- v10 — Points need 3 decimals. The ₱0.025 rate was being rounded to the
-- nearest cent (numeric(12,2)) on every credit, visibly paying ₱0.03 per
-- correct answer. Store 3 decimals so 0.025 increments land exactly.
alter table public.profiles alter column current_points type numeric(12, 3);
alter table public.profiles alter column total_points   type numeric(12, 3);

-- One-time backfill: whatever lifetime points existed becomes both totals
update public.profiles
set total_points = current_points
where total_points = 0 and current_points > 0;

-- If the table already existed from an earlier setup, add the new columns.
-- (NOT NULL + default fills existing rows with 'active'.)
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists account_status text not null default 'inactive';
-- Re-point the default on installs that predate the inactive-default change,
-- so re-running this script fixes it (add column if not exists is a no-op there).
alter table public.profiles alter column account_status set default 'inactive';
alter table public.profiles add column if not exists birthday date;
alter table public.profiles add column if not exists withdrawal_method text not null default 'gcash';
alter table public.profiles add column if not exists gcash_number text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- v9 — Bounty columns.
--    referral_code  = this user's shareable code (auto-generated, read-only)
--    rate_bonus     = permanent ₱/question bonus (from referrals + approved comments)
--    referred_by    = the user who referred this user (set once by redeem_referral)
--    referral_count = number of referrals (displayed; managed manually)
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists rate_bonus numeric(10, 4) not null default 0;
alter table public.profiles add column if not exists referred_by uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists referral_count integer not null default 0;

-- Backfill a unique referral code for any existing user that lacks one.
do $$
declare
  r record;
  v_code text;
begin
  for r in select id from public.profiles where referral_code is null loop
    loop
      v_code := upper(substr(md5(random()::text), 1, 8));
      exit when not exists (
        select 1 from public.profiles where lower(coalesce(referral_code, '')) = lower(v_code)
      );
    end loop;
    update public.profiles set referral_code = v_code where id = r.id;
  end loop;
end $$;

create unique index if not exists profiles_referral_code_uidx
  on public.profiles (lower(referral_code));

-- Auto-create a profile whenever a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  -- Every new user gets a unique, auto-generated referral code.
  loop
    v_code := upper(substr(md5(random()::text), 1, 8));
    exit when not exists (
      select 1 from public.profiles where lower(coalesce(referral_code, '')) = lower(v_code)
    );
  end loop;

  insert into public.profiles (id, email, referral_code)
  values (new.id, new.email, v_code);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Stamp updated_at whenever a profile row changes
create or replace function public.touch_profile()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_profile_update on public.profiles;
create trigger on_profile_update
  before update on public.profiles
  for each row execute function public.touch_profile();

-- A saved GCash number is permanent: reject any later change to it
create or replace function public.lock_gcash_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.gcash_number is distinct from old.gcash_number then
    if old.gcash_number is not null then
      raise exception 'GCash number is locked and cannot be changed.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_gcash_lock on public.profiles;
create trigger on_profile_gcash_lock
  before update on public.profiles
  for each row execute function public.lock_gcash_number();

-- 2) Row Level Security
alter table public.profiles enable row level security;

-- Profiles: users can view, update, and (fallback) create their own row
drop policy if exists "users can view own profile" on public.profiles;
create policy "users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "users can create own profile" on public.profiles;
create policy "users can create own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

-- 3) Withdrawals: one row per withdrawal request
create table if not exists public.withdrawals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     numeric(12, 2) not null check (amount > 0),
  method     text           not null default 'gcash',
  account    text,                       -- GCash number at time of withdrawal
  status     text           not null default 'pending',
  created_at timestamptz    not null default now()
);

create index if not exists withdrawals_user_created_idx
  on public.withdrawals (user_id, created_at desc);

alter table public.withdrawals enable row level security;

drop policy if exists "users can view own withdrawals" on public.withdrawals;
create policy "users can view own withdrawals"
  on public.withdrawals
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users can create own withdrawals" on public.withdrawals;
create policy "users can create own withdrawals"
  on public.withdrawals
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Atomic request-withdrawal: records the withdrawal and deducts the
-- balance in a single transaction. Minimum withdrawal is ₱100.00.
create or replace function public.request_withdrawal(p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance        numeric;
  v_withdrawal_id  uuid;
begin
  select current_points into v_balance
  from public.profiles
  where id = auth.uid()
  for update;

  if v_balance is null then
    raise exception 'Profile not found.';
  end if;

  if p_amount < 100 then
    raise exception 'Minimum withdrawal is 100.';
  end if;

  if v_balance < p_amount then
    raise exception 'Insufficient balance.';
  end if;

  insert into public.withdrawals (user_id, amount, method, account, status)
  select auth.uid(), p_amount, withdrawal_method, gcash_number, 'pending'
  from public.profiles
  where id = auth.uid()
  returning id into v_withdrawal_id;

  update public.profiles
  set current_points = current_points - p_amount
  where id = auth.uid();

  return jsonb_build_object(
    'withdrawal_id', v_withdrawal_id,
    'balance', v_balance - p_amount
  );
end;
$$;

grant execute on function public.request_withdrawal(numeric) to authenticated;

-- v11 — The questions table is gone: nothing about how points are
-- earned is persisted. Questions are issued statelessly and signed with
-- HMAC-SHA256 (see get_question / submit_answer below).
drop table if exists public.questions;

-- Daily answer tally per user (server-side; replaces the old
-- client-side localStorage tally which users could wipe at will).
create table if not exists public.daily_answers (
  user_id   uuid        not null references auth.users(id) on delete cascade,
  day       date        not null,
  answered  integer     not null default 0,
  correct   integer     not null default 0,
  primary key (user_id, day)
);

alter table public.daily_answers enable row level security;
revoke all on public.daily_answers from anon, authenticated;
-- No client policies: reads go through the get_today_tally RPC only.

-- Daily cap enforced server-side (Asia/Manila timezone). Keep in sync
-- with DAILY_LIMIT in script.js.
create or replace function public.get_daily_limit()
returns integer
language sql
immutable
as $$ select 20000 $$;

-- Manila "today" (UTC+8, no DST).
create or replace function public.manila_today()
returns date
language sql
stable
as $$ select (now() at time zone 'Asia/Manila')::date $$;

-- v11 — Issue one fresh question, stateless. The expression is signed
-- (HMAC-SHA256 over user + operands + issued-at) and returned with the
-- question text; submit_answer verifies the signature and recomputes the
-- answer. Nothing is stored — no questions table, no answers at rest.
-- The signing key lives only in this file + the DB function body; the
-- client can never call question_secret() (revoked below).
create or replace function public.question_secret()
returns text
language sql
immutable
as $$ select 'hoxie-question-signing-key-9f2c1e' $$;

revoke execute on function public.question_secret() from anon, authenticated, public;

create or replace function public.get_question()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions -- extensions: hmac() from pgcrypto
as $$
declare
  v_type    integer;
  v_a       integer;
  v_b       integer;
  v_c       integer;
  v_text    text;
  v_op      text;
  v_ts      bigint;
  v_payload text;
  v_token   text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;

  v_type := floor(random() * 4); -- 0 add, 1 sub, 2 mul, 3 div

  if v_type = 0 then
    v_a := 10 + floor(random() * 90)::int;
    v_b := 10 + floor(random() * 90)::int;
    v_op := '+';
    v_text := v_a || ' + ' || v_b;
  elsif v_type = 1 then
    v_a := 20 + floor(random() * 80)::int;
    v_b := 1 + floor(random() * v_a)::int;
    v_op := '-';
    v_text := v_a || ' - ' || v_b;
  elsif v_type = 2 then
    v_a := 2 + floor(random() * 11)::int;
    v_b := 2 + floor(random() * 11)::int;
    v_op := 'x';
    v_text := v_a || ' x ' || v_b;
  else
    v_b := 2 + floor(random() * 11)::int;
    v_c := 2 + floor(random() * 11)::int;
    v_a := v_b * v_c;
    v_op := '/';
    v_text := v_a || ' / ' || v_b;
  end if;

  v_ts := floor(extract(epoch from now()))::bigint;
  v_payload := auth.uid()::text || ':' || v_a || ':' || v_op || ':' || v_b || ':' || v_ts;
  v_token := encode(hmac(v_payload, public.question_secret(), 'sha256'), 'hex');

  return jsonb_build_object('token', v_token, 'payload', v_payload, 'question', v_text);
end;
$$;

grant execute on function public.get_question() to authenticated;

-- Submit an answer for a signed question. Points are credited only if
-- the submitted value matches the answer recomputed from the signed
-- operands. Tokens expire after 5 minutes and the client discards them
-- after one use; the daily limit is enforced server-side.
drop function if exists public.submit_answer(uuid, numeric);
create or replace function public.submit_answer(p_token text, p_payload text, p_answer numeric)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions -- extensions: hmac() from pgcrypto
as $$
declare
  v_user_id   text;
  v_a         integer;
  v_op        text;
  v_b         integer;
  v_ts        bigint;
  v_answer    numeric;
  v_correct   boolean;
  v_current   numeric;
  v_total     numeric;
  v_rate      numeric;
  v_answered  integer;
  v_correct_n integer;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;

  -- 1) The payload must carry a valid signature from the server secret.
  if encode(hmac(coalesce(p_payload, ''), public.question_secret(), 'sha256'), 'hex')
     is distinct from p_token then
    raise exception 'Invalid question token. Get a new question.';
  end if;

  -- 2) Parse the signed payload: user_id:a:op:b:issued-epoch-seconds.
  v_user_id := split_part(p_payload, ':', 1);
  v_a       := split_part(p_payload, ':', 2)::int;
  v_op      := split_part(p_payload, ':', 3);
  v_b       := split_part(p_payload, ':', 4)::int;
  v_ts      := split_part(p_payload, ':', 5)::bigint;

  -- 3) The token was issued to this user.
  if v_user_id is distinct from auth.uid()::text then
    raise exception 'Invalid question token. Get a new question.';
  end if;

  -- 4) Tokens expire after 5 minutes.
  if floor(extract(epoch from now())) - v_ts > 300 then
    raise exception 'Question expired. Get a new question.';
  end if;

  -- 5) Recompute the answer from the signed operands.
  if v_op = '+' then
    v_answer := v_a + v_b;
  elsif v_op = '-' then
    v_answer := v_a - v_b;
  elsif v_op = 'x' then
    v_answer := v_a * v_b;
  elsif v_op = '/' then
    v_answer := v_a / v_b;
  else
    raise exception 'Invalid question token. Get a new question.';
  end if;

  -- Atomic daily tally upsert (row lock keeps concurrent tabs honest).
  insert into public.daily_answers (user_id, day, answered)
  values (auth.uid(), public.manila_today(), 1)
  on conflict (user_id, day)
  do update set answered = public.daily_answers.answered + 1
  returning answered into v_answered;

  if v_answered > public.get_daily_limit() then
    raise exception 'Daily limit reached.';
  end if;

  v_correct := (p_answer = v_answer);

  -- Rate = base ₱0.025 (keep in sync with RATE_PER_QUESTION in script.js)
  -- plus the user's permanent bounty bonus (referrals + approved comments).
  select 0.025 + coalesce(rate_bonus, 0) into v_rate
  from public.profiles
  where id = auth.uid();

  if v_rate is null then
    raise exception 'Profile not found.';
  end if;

  if v_correct then
    update public.profiles
    set current_points = current_points + v_rate,
        total_points   = total_points   + v_rate
    where id = auth.uid()
    returning current_points, total_points into v_current, v_total;
  else
    select current_points, total_points into v_current, v_total
    from public.profiles
    where id = auth.uid();
  end if;

  if v_correct then
    update public.daily_answers
    set correct = correct + 1
    where user_id = auth.uid() and day = public.manila_today();
  end if;

  select answered, correct into v_answered, v_correct_n
  from public.daily_answers
  where user_id = auth.uid() and day = public.manila_today();

  return jsonb_build_object(
    'correct', v_correct,
    'answer', v_answer,
    'current_points', v_current,
    'total_points', v_total,
    'answered', v_answered,
    'correct_count', v_correct_n
  );
end;
$$;

grant execute on function public.submit_answer(text, text, numeric) to authenticated;

-- Today's tally for the client (progress bar + "Today" earnings). The
-- client cannot read daily_answers directly — this is the only read path.
create or replace function public.get_today_tally()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'answered', answered,
    'correct',  correct,
    'day',      day
  )
  from public.daily_answers
  where user_id = auth.uid() and day = public.manila_today();
$$;

grant execute on function public.get_today_tally() to authenticated;

-- Redeem a friend's referral code (one time per user). Credits the
-- referrer +₱20.00 instantly and +₱0.01 to their rate per question,
-- and the redeemer +₱20.00 (one time, no rate bonus).
create or replace function public.redeem_referral(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
  v_referred_by uuid;
  v_current     numeric;
  v_total       numeric;
  v_bonus       numeric;
begin
  if p_code is null or trim(p_code) = '' then
    raise exception 'Referral code is required.';
  end if;

  select id into v_referrer_id
  from public.profiles
  where lower(coalesce(referral_code, '')) = lower(trim(p_code));

  if v_referrer_id is null then
    raise exception 'Referral code not found.';
  end if;

  if v_referrer_id = auth.uid() then
    raise exception 'You cannot use your own referral code.';
  end if;

  -- Row-lock the redeemer so two concurrent redemptions can't both pass.
  select referred_by into v_referred_by
  from public.profiles
  where id = auth.uid()
  for update;

  if v_referred_by is null then
    if not exists (select 1 from public.profiles where id = auth.uid()) then
      raise exception 'Profile not found.';
    end if;
  end if;

  if v_referred_by is not null then
    raise exception 'You have already used a referral code.';
  end if;

  update public.profiles
  set referred_by = v_referrer_id
  where id = auth.uid();

  -- The redeemer also earns a one-time ₱20.00 (no rate bonus).
  update public.profiles
  set current_points = current_points + 20,
      total_points   = total_points + 20
  where id = auth.uid();

  -- The referrer earns ₱20.00 plus a permanent +₱0.01 per-question rate bump.
  update public.profiles
  set rate_bonus     = rate_bonus + 0.01,
      current_points = current_points + 20,
      total_points   = total_points + 20
  where id = v_referrer_id;

  select current_points, total_points, rate_bonus
  into v_current, v_total, v_bonus
  from public.profiles
  where id = auth.uid();

  return jsonb_build_object(
    'current_points', v_current,
    'total_points',   v_total,
    'rate_bonus',     v_bonus
  );
end;
$$;

grant execute on function public.redeem_referral(text) to authenticated;

-- Bounty — comment links. A user submits the URL of a comment they made
-- on our posts (status 'pending'); the admin flips it to 'success' in
-- the dashboard, and the trigger below permanently adds +₱0.005 to the
-- user's rate. Status is never writable from the client.
create table if not exists public.comment_links (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  url        text not null,
  status     text           not null default 'pending',
  created_at timestamptz    not null default now()
);

create index if not exists comment_links_user_created_idx
  on public.comment_links (user_id, created_at desc);

alter table public.comment_links enable row level security;

drop policy if exists "users can view own comment links" on public.comment_links;
create policy "users can view own comment links"
  on public.comment_links
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users can create own comment links" on public.comment_links;
create policy "users can create own comment links"
  on public.comment_links
  for insert
  to authenticated
  with check (auth.uid() = user_id and status = 'pending');

-- Auto-grant the +₱0.005 rate bonus when a comment link is approved.
-- Only fires on a transition into 'success', so re-saving a success row
-- (or the initial insert) never double-credits.
create or replace function public.grant_comment_bonus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'success' and old.status is distinct from 'success' then
    update public.profiles
    set rate_bonus = rate_bonus + 0.005
    where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_comment_link_status on public.comment_links;
create trigger on_comment_link_status
  before update on public.comment_links
  for each row execute function public.grant_comment_bonus();

-- Legacy hole: the old RPC credited points with no verification. Drop it
-- so replaying it from an old client build can no longer mint points.
drop function if exists public.record_correct_answer();

-- Users may update their own row, but only these columns. The points
-- columns are no longer writable from the client at all.
revoke update on public.profiles from anon, authenticated;
grant update (name, birthday, withdrawal_method, gcash_number)
  on public.profiles to authenticated;

-- Real leaderboard: top 20 active earners plus the caller's own rank.
-- profiles is RLS-locked, so this runs security definer and only ever
-- exposes display names (real name when set, else a masked email), the
-- lifetime total, today's answer count, and join date — never raw
-- emails or balances.
create or replace function public.get_leaderboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me_id   uuid := auth.uid();
  v_rank    bigint;
  v_total   bigint;
  v_rows    jsonb;
  v_me_row  jsonb;
begin
  if v_me_id is null then
    raise exception 'Not signed in.';
  end if;

  -- Caller's rank + the size of the board, both over the same set:
  -- active profiles, ordered by lifetime points (ties: earlier join first).
  select count(*) into v_total
  from public.profiles
  where account_status = 'active';

  select rn into v_rank
  from (
    select id,
           row_number() over (
             order by total_points desc, created_at asc, id asc
           ) as rn
    from public.profiles
    where account_status = 'active'
  ) ranked
  where id = v_me_id;

  if v_rank is null then
    -- Caller is not on the board (e.g. inactive) — report as unranked.
    v_rank := 0;
  end if;

  select coalesce(jsonb_agg(sub), '[]'::jsonb) into v_rows
  from (
    select
      p.id,
      case when coalesce(trim(p.name), '') <> '' then p.name
           else lower(left(split_part(p.email, '@', 1), 2)) || '***' end as name,
      p.total_points,
      coalesce(da.answered, 0) as answered_today,
      p.created_at,
      row_number() over (
        order by p.total_points desc, p.created_at asc, p.id asc
      ) as rn
    from public.profiles p
    left join public.daily_answers da
      on da.user_id = p.id and da.day = public.manila_today()
    where p.account_status = 'active'
    order by p.total_points desc, p.created_at asc, p.id asc
    limit 20
  ) sub;

  select jsonb_build_object(
    'rank', v_rank,
    'players', v_total,
    'points', coalesce(total_points, 0),
    'answered_today', coalesce(da.answered, 0)
  ) into v_me_row
  from public.profiles p
  left join public.daily_answers da
    on da.user_id = p.id and da.day = public.manila_today()
  where p.id = v_me_id;

  if v_me_row is null then
    v_me_row := jsonb_build_object('rank', v_rank, 'players', v_total, 'points', 0, 'answered_today', 0);
  end if;

  return jsonb_build_object('rows', v_rows, 'me', v_me_row);
end;
$$;

grant execute on function public.get_leaderboard() to authenticated;

-- Display name of the profile that referred the caller (null when the
-- caller hasn't redeemed a code). Same masking rule as the leaderboard:
-- real name when set, else a masked email.
create or replace function public.get_referrer_name()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case when coalesce(trim(r.name), '') <> '' then r.name
              else lower(left(split_part(r.email, '@', 1), 2)) || '***' end
  from public.profiles me
  join public.profiles r on r.id = me.referred_by
  where me.id = auth.uid();
$$;

grant execute on function public.get_referrer_name() to authenticated;

-- v12 — Daily login rewards. One ₱3.00 claim per user per Manila day.
-- Claiming on 6 consecutive days makes the 7th claim of that cycle add
-- a permanent +₱0.003 to the per-question rate (rate_bonus). Missing a
-- day resets the consecutive streak; the weekly cycle restarts after a
-- completed 7th day.
create table if not exists public.login_rewards (
  user_id    uuid          not null references auth.users(id) on delete cascade,
  day        date          not null,
  amount     numeric(12,3) not null,
  cycle_day  integer       not null,  -- 1..7: which claim of this cycle
  created_at timestamptz   not null default now(),
  primary key (user_id, day)
);

alter table public.login_rewards enable row level security;
revoke all on public.login_rewards from anon, authenticated;
-- No client policies: reads/writes go through the RPCs below only.

-- Read-only state for the client: whether today is claimed and where the
-- user stands in the current 7-day cycle.
create or replace function public.get_login_rewards()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_today     date := public.manila_today();
  v_claimed   boolean;
  v_prior     integer := 0;  -- consecutive claims ending yesterday
  v_d         date;
  v_cycle_day integer;
  v_progress  integer;       -- claimed days in the current cycle
  v_next      integer;       -- day the next claim would count as
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;

  v_claimed := exists (
    select 1 from public.login_rewards where user_id = v_uid and day = v_today
  );

  v_d := v_today - 1;
  while exists (select 1 from public.login_rewards where user_id = v_uid and day = v_d) loop
    v_prior := v_prior + 1;
    v_d := v_d - 1;
  end loop;

  if v_claimed then
    select cycle_day into v_cycle_day
    from public.login_rewards
    where user_id = v_uid and day = v_today;
    v_progress := v_cycle_day;
    v_next := 0; -- not meaningful once claimed today
  else
    v_progress := v_prior % 7;
    v_next := (v_prior % 7) + 1;
  end if;

  return jsonb_build_object(
    'claimed_today', v_claimed,
    'streak',        v_prior + case when v_claimed then 1 else 0 end,
    'cycle_progress', v_progress,
    'next_day',      v_next,
    'seventh_next',  (not v_claimed and v_next = 7)
  );
end;
$$;

grant execute on function public.get_login_rewards() to authenticated;

-- Claim today's ₱3.00. The 7th claim of a cycle (the day after 6
-- consecutive claims) also adds a permanent +₱0.003 per-question rate.
create or replace function public.claim_login_reward()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_today     date := public.manila_today();
  v_prior     integer := 0;
  v_d         date;
  v_cycle_day integer;
  v_seventh   boolean;
  v_current   numeric;
  v_total     numeric;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;

  if exists (select 1 from public.login_rewards where user_id = v_uid and day = v_today) then
    raise exception 'Already claimed today. Come back tomorrow.';
  end if;

  v_d := v_today - 1;
  while exists (select 1 from public.login_rewards where user_id = v_uid and day = v_d) loop
    v_prior := v_prior + 1;
    v_d := v_d - 1;
  end loop;

  v_cycle_day := (v_prior % 7) + 1;
  v_seventh := (v_cycle_day = 7);

  insert into public.login_rewards (user_id, day, amount, cycle_day)
  values (v_uid, v_today, 3, v_cycle_day);

  update public.profiles
  set current_points = current_points + 3,
      total_points   = total_points   + 3
  where id = v_uid
  returning current_points, total_points into v_current, v_total;

  -- Day 7 of a completed week: permanent +₱0.003 per-question rate.
  if v_seventh then
    update public.profiles
    set rate_bonus = rate_bonus + 0.003
    where id = v_uid;
  end if;

  return jsonb_build_object(
    'ok', true,
    'cycle_day', v_cycle_day,
    'seventh', v_seventh,
    'claimed_today', true,
    'current_points', v_current,
    'total_points', v_total
  );
end;
$$;

grant execute on function public.claim_login_reward() to authenticated;

-- ------------------------------------------------------------
-- Optional: list all users, totals, and balances (SQL Editor)
-- ------------------------------------------------------------
-- select email, name, account_status, total_points, current_points, gcash_number
-- from public.profiles
-- order by total_points desc;

-- ------------------------------------------------------------
-- Optional: withdrawal history (SQL Editor)
-- ------------------------------------------------------------
-- select p.email, w.amount, w.method, w.account, w.status, w.created_at
-- from public.withdrawals w
-- join public.profiles p on p.id = w.user_id
-- order by w.created_at desc;