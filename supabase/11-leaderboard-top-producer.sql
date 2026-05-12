-- =============================================================================
-- First Class Agency — extend get_current_month_premiums with top-producer flag
-- Run AFTER 10-top-producer.sql.
-- Lets the leaderboard render the gold ring + feathers on every agent's row
-- (not just the signed-in user's avatar).
-- Return type changes, so we drop+recreate.
-- =============================================================================

drop function if exists public.get_current_month_premiums();

create or replace function public.get_current_month_premiums()
returns table (
  sender_name     text,
  monthly_premium numeric,
  is_top_producer boolean
)
language sql security definer set search_path = public as $$
  with bounds as (
    select
      date_trunc('month', (now() at time zone 'America/New_York'))                      as m_start,
      date_trunc('month', (now() at time zone 'America/New_York')) + interval '1 month' as m_end
  ),
  totals as (
    select le.sender_name, sum(le.amount)::numeric as monthly_premium
    from public.leaderboard_entries le, bounds b
    where (le.posted_at at time zone 'America/New_York') >= b.m_start
      and (le.posted_at at time zone 'America/New_York') <  b.m_end
    group by le.sender_name
  )
  select
    t.sender_name,
    t.monthly_premium,
    (
      coalesce((
        select p.top_producer_unlocked
        from public.profiles p
        where lower(p.full_name) = lower(t.sender_name)
        limit 1
      ), false)
      or t.monthly_premium >= 40000
    ) as is_top_producer
  from totals t;
$$;

grant execute on function public.get_current_month_premiums() to authenticated;
