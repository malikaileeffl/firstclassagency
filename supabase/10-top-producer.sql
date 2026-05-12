-- =============================================================================
-- First Class Agency — top-producer flag (gold ring + feathers + glow)
-- Run AFTER 09-agent-stats.sql.
-- Adds a permanent unlock flag on profiles. Two ways an agent earns it:
--   1) Manual override — admin sets top_producer_unlocked = true directly
--   2) Auto-unlock — agent submits $40,000+ for two consecutive calendar
--      months, computed automatically when get_my_monthly_summary runs
--
-- The treatment ALSO shows temporarily during any single month the agent is
-- at $40k+ (matches the "Platinum III or higher" rank tier), even before
-- the permanent unlock. This is handled in the RPC response.
-- =============================================================================

-- 1) Add the column
alter table public.profiles
  add column if not exists top_producer_unlocked boolean not null default false;

-- 2) Drop the previous version of the RPC (return type is changing — Postgres
--    refuses to CREATE OR REPLACE a function whose output columns differ).
drop function if exists public.get_my_monthly_summary(text);

-- 3) Recreate it with the new is_top_producer column and auto-unlock logic.
create or replace function public.get_my_monthly_summary(p_name text)
returns table (
  this_month       numeric,
  last_month       numeric,
  best_month       numeric,
  best_month_label text,
  lifetime         numeric,
  is_top_producer  boolean
)
language plpgsql security definer set search_path = public as $$
declare
  v_now_et          timestamptz := now() at time zone 'America/New_York';
  v_month_start     timestamptz := date_trunc('month', v_now_et);
  v_month_end       timestamptz := v_month_start + interval '1 month';
  v_prev_start      timestamptz := v_month_start - interval '1 month';
  v_this_month      numeric;
  v_last_month      numeric;
  v_best_record     record;
  v_lifetime        numeric;
  v_unlocked        boolean := false;
  v_threshold       numeric := 40000;
begin
  -- Per-agent totals
  select coalesce(sum(le.amount), 0)::numeric into v_this_month
  from public.leaderboard_entries le
  where lower(le.sender_name) = lower(p_name)
    and (le.posted_at at time zone 'America/New_York') >= v_month_start
    and (le.posted_at at time zone 'America/New_York') <  v_month_end;

  select coalesce(sum(le.amount), 0)::numeric into v_last_month
  from public.leaderboard_entries le
  where lower(le.sender_name) = lower(p_name)
    and (le.posted_at at time zone 'America/New_York') >= v_prev_start
    and (le.posted_at at time zone 'America/New_York') <  v_month_start;

  select coalesce(sum(le.amount), 0)::numeric into v_lifetime
  from public.leaderboard_entries le
  where lower(le.sender_name) = lower(p_name);

  select
    date_trunc('month', (le.posted_at at time zone 'America/New_York')) as m,
    sum(le.amount)::numeric                                              as total
  into v_best_record
  from public.leaderboard_entries le
  where lower(le.sender_name) = lower(p_name)
  group by 1
  order by total desc
  limit 1;

  -- Pull current unlock state
  select coalesce(p.top_producer_unlocked, false) into v_unlocked
  from public.profiles p
  where lower(p.full_name) = lower(p_name)
  limit 1;

  -- Auto-unlock: 2 consecutive months at $40k+
  if not v_unlocked and v_this_month >= v_threshold and v_last_month >= v_threshold then
    update public.profiles
       set top_producer_unlocked = true
     where lower(full_name) = lower(p_name);
    v_unlocked := true;
  end if;

  return query
  select
    v_this_month                                                 as this_month,
    v_last_month                                                 as last_month,
    coalesce(v_best_record.total, 0::numeric)                    as best_month,
    coalesce(to_char(v_best_record.m, 'Mon YYYY'), '')::text     as best_month_label,
    v_lifetime                                                   as lifetime,
    (v_unlocked or v_this_month >= v_threshold)                  as is_top_producer;
end;
$$;

grant execute on function public.get_my_monthly_summary(text) to authenticated;

-- =============================================================================
-- MANUAL OVERRIDE — run these to grant the treatment to specific accounts.
-- Replace 'Their Full Name' with the agent's portal name.
-- =============================================================================
-- update public.profiles set top_producer_unlocked = true where full_name = 'Drew Smith';
-- update public.profiles set top_producer_unlocked = true where full_name = 'Hayden Keltner';
--
-- To REVOKE:
-- update public.profiles set top_producer_unlocked = false where full_name = 'Drew Smith';
--
-- Bulk view of who's unlocked:
-- select full_name, top_producer_unlocked from public.profiles where top_producer_unlocked;
-- =============================================================================
