-- =============================================================================
-- First Class Agency — GroupMe-fed leaderboard
-- Run AFTER 06-training-attendance.sql.
-- Stores premium submissions parsed from the GroupMe group chat.
-- Each row = one "$NNNN CARRIER" message posted by an agent.
-- Idempotent — safe to re-run.
-- =============================================================================

-- 1) The entries table -------------------------------------------------------
create table if not exists public.leaderboard_entries (
  id                   uuid        primary key default gen_random_uuid(),
  groupme_message_id   text        not null unique,   -- dedupe key from GroupMe
  groupme_user_id      text,                          -- GroupMe user (for future portrait/name mapping)
  sender_name          text        not null,          -- as it appeared in the chat
  amount               numeric(10,2) not null check (amount > 0),
  carrier              text,                          -- raw carrier abbreviation (not validated)
  raw_text             text        not null,          -- full message text, for debugging
  posted_at            timestamptz not null,          -- GroupMe message timestamp
  created_at           timestamptz not null default now()
);

create index if not exists idx_leaderboard_posted_at on public.leaderboard_entries (posted_at desc);
create index if not exists idx_leaderboard_sender_name on public.leaderboard_entries (sender_name);

-- 2) Row level security -------------------------------------------------------
alter table public.leaderboard_entries enable row level security;

-- All signed-in agents can read the leaderboard
drop policy if exists "all_signed_in_can_read_leaderboard" on public.leaderboard_entries;
create policy "all_signed_in_can_read_leaderboard"
  on public.leaderboard_entries for select
  to authenticated
  using (true);

-- Only admins can update or delete (for typo fixes)
drop policy if exists "admins_can_update_leaderboard" on public.leaderboard_entries;
create policy "admins_can_update_leaderboard"
  on public.leaderboard_entries for update
  to authenticated
  using (public.is_admin());

drop policy if exists "admins_can_delete_leaderboard" on public.leaderboard_entries;
create policy "admins_can_delete_leaderboard"
  on public.leaderboard_entries for delete
  to authenticated
  using (public.is_admin());

-- Inserts only happen via the edge function (service-role key bypasses RLS).
-- No insert policy exposed to authenticated users.

-- 3) Aggregation RPC ---------------------------------------------------------
-- Returns a leaderboard for a time period, grouped by sender, ranked by $.
-- p_period: 'day' | 'week' | 'month'
-- Times bucketed in America/New_York to match how agents think about "today".
create or replace function public.get_leaderboard(p_period text)
returns table (
  rank             integer,
  sender_name      text,
  groupme_user_id  text,
  total_premium    numeric,
  entry_count      integer
) language plpgsql security definer set search_path = public as $$
declare
  v_start timestamptz;
begin
  if p_period = 'day' then
    v_start := (date_trunc('day',  (now() at time zone 'America/New_York'))) at time zone 'America/New_York';
  elsif p_period = 'week' then
    -- Start of the current week (Mon 00:00 ET) — Postgres week starts Monday
    v_start := (date_trunc('week', (now() at time zone 'America/New_York'))) at time zone 'America/New_York';
  elsif p_period = 'month' then
    v_start := (date_trunc('month',(now() at time zone 'America/New_York'))) at time zone 'America/New_York';
  else
    raise exception 'invalid period: %', p_period;
  end if;

  return query
    with totals as (
      select
        le.sender_name,
        max(le.groupme_user_id) as groupme_user_id,
        sum(le.amount)::numeric as total_premium,
        count(*)::integer       as entry_count
      from public.leaderboard_entries le
      where le.posted_at >= v_start
      group by le.sender_name
    )
    select
      (row_number() over (order by t.total_premium desc, t.sender_name asc))::integer as rank,
      t.sender_name,
      t.groupme_user_id,
      t.total_premium,
      t.entry_count
    from totals t
    order by t.total_premium desc, t.sender_name asc;
end;
$$;

grant execute on function public.get_leaderboard(text) to authenticated;
