-- =============================================================================
-- First Class Agency — monthly rank system helpers
-- Run AFTER 07-leaderboard.sql.
-- Ranks reset on the 1st of every month (America/New_York). Each agent's
-- current rank is computed from their THIS-MONTH submitted premium total
-- (the dollar amounts posted in the GroupMe chat — NOT carrier-issued IP).
-- We also expose last month and personal-best month so the dashboard can
-- show a "beat last month" comparison.
-- Idempotent — safe to re-run.
-- =============================================================================

-- ----- Per-agent monthly summary --------------------------------------------
-- Returns: this_month total, last_month total, personal-best month + label,
-- and lifetime (kept for the small "lifetime $" stat on the rank card).
-- All sums computed in America/New_York calendar months.
create or replace function public.get_my_monthly_summary(p_name text)
returns table (
  this_month       numeric,
  last_month       numeric,
  best_month       numeric,
  best_month_label text,
  lifetime         numeric
)
language plpgsql security definer set search_path = public as $$
declare
  v_now_et       timestamptz := now() at time zone 'America/New_York';
  v_month_start  timestamptz := date_trunc('month', v_now_et);
  v_month_end    timestamptz := v_month_start + interval '1 month';
  v_prev_start   timestamptz := v_month_start - interval '1 month';
  v_best_record  record;
begin
  -- Pull the personal-best month (across all entries by this sender) once.
  select
    date_trunc('month', (le.posted_at at time zone 'America/New_York')) as m,
    sum(le.amount)::numeric                                              as total
  into v_best_record
  from public.leaderboard_entries le
  where lower(le.sender_name) = lower(p_name)
  group by 1
  order by total desc
  limit 1;

  return query
  select
    -- This month
    coalesce((
      select sum(le.amount)::numeric
      from public.leaderboard_entries le
      where lower(le.sender_name) = lower(p_name)
        and (le.posted_at at time zone 'America/New_York') >= v_month_start
        and (le.posted_at at time zone 'America/New_York') <  v_month_end
    ), 0::numeric) as this_month,
    -- Last month
    coalesce((
      select sum(le.amount)::numeric
      from public.leaderboard_entries le
      where lower(le.sender_name) = lower(p_name)
        and (le.posted_at at time zone 'America/New_York') >= v_prev_start
        and (le.posted_at at time zone 'America/New_York') <  v_month_start
    ), 0::numeric) as last_month,
    -- Best month
    coalesce(v_best_record.total, 0::numeric) as best_month,
    coalesce(to_char(v_best_record.m, 'Mon YYYY'), '')::text as best_month_label,
    -- Lifetime (for the small career counter)
    coalesce((
      select sum(le.amount)::numeric
      from public.leaderboard_entries le
      where lower(le.sender_name) = lower(p_name)
    ), 0::numeric) as lifetime;
end;
$$;

grant execute on function public.get_my_monthly_summary(text) to authenticated;

-- ----- Per-agent current-month totals (for leaderboard pills) ---------------
-- Returns one row per agent who has posted this month.
create or replace function public.get_current_month_premiums()
returns table (
  sender_name     text,
  monthly_premium numeric
)
language sql security definer set search_path = public as $$
  with bounds as (
    select
      date_trunc('month', (now() at time zone 'America/New_York'))                        as m_start,
      date_trunc('month', (now() at time zone 'America/New_York')) + interval '1 month'   as m_end
  )
  select
    le.sender_name,
    sum(le.amount)::numeric as monthly_premium
  from public.leaderboard_entries le, bounds b
  where (le.posted_at at time zone 'America/New_York') >= b.m_start
    and (le.posted_at at time zone 'America/New_York') <  b.m_end
  group by le.sender_name;
$$;

grant execute on function public.get_current_month_premiums() to authenticated;
