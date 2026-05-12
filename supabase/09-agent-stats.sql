-- =============================================================================
-- First Class Agency — agent personal stats
-- Run AFTER 08-rank-helpers.sql.
-- Powers the "Your stats" card on the account page: best month, best week,
-- best day, and monthly totals for the current calendar year.
-- All time bucketing is America/New_York.
-- Idempotent — safe to re-run.
-- =============================================================================

create or replace function public.get_agent_stats(p_name text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_year        int          := extract(year from (now() at time zone 'America/New_York'))::int;
  v_year_start  timestamptz  := (make_date(v_year, 1, 1))::timestamptz;
  v_year_end    timestamptz  := (make_date(v_year + 1, 1, 1))::timestamptz;
  v_bm_amount   numeric;
  v_bm_label    text;
  v_bw_amount   numeric;
  v_bw_label    text;
  v_bd_amount   numeric;
  v_bd_label    text;
  v_monthly     jsonb;
begin
  -- Best month overall
  select sum(le.amount)::numeric,
         to_char(date_trunc('month', (le.posted_at at time zone 'America/New_York')), 'Mon YYYY')
  into v_bm_amount, v_bm_label
  from public.leaderboard_entries le
  where lower(le.sender_name) = lower(p_name)
  group by date_trunc('month', (le.posted_at at time zone 'America/New_York'))
  order by sum(le.amount) desc
  limit 1;

  -- Best week overall (ISO week, Monday-start)
  select sum(le.amount)::numeric,
         to_char(date_trunc('week', (le.posted_at at time zone 'America/New_York')), 'Mon DD')
         || ' – ' ||
         to_char(date_trunc('week', (le.posted_at at time zone 'America/New_York')) + interval '6 days', 'Mon DD, YYYY')
  into v_bw_amount, v_bw_label
  from public.leaderboard_entries le
  where lower(le.sender_name) = lower(p_name)
  group by date_trunc('week', (le.posted_at at time zone 'America/New_York'))
  order by sum(le.amount) desc
  limit 1;

  -- Best single day
  select sum(le.amount)::numeric,
         to_char((le.posted_at at time zone 'America/New_York')::date, 'Mon DD, YYYY')
  into v_bd_amount, v_bd_label
  from public.leaderboard_entries le
  where lower(le.sender_name) = lower(p_name)
  group by (le.posted_at at time zone 'America/New_York')::date
  order by sum(le.amount) desc
  limit 1;

  -- Monthly totals for the current year
  select coalesce(jsonb_agg(jsonb_build_object(
           'month',  to_char(m, 'YYYY-MM'),
           'amount', total
         ) order by m), '[]'::jsonb)
  into v_monthly
  from (
    select date_trunc('month', (le.posted_at at time zone 'America/New_York')) as m,
           sum(le.amount)::numeric as total
    from public.leaderboard_entries le
    where lower(le.sender_name) = lower(p_name)
      and (le.posted_at at time zone 'America/New_York') >= v_year_start
      and (le.posted_at at time zone 'America/New_York') <  v_year_end
    group by 1
  ) sub;

  return jsonb_build_object(
    'best_month',   case when v_bm_amount is null then null
                         else jsonb_build_object('amount', v_bm_amount, 'label', v_bm_label) end,
    'best_week',    case when v_bw_amount is null then null
                         else jsonb_build_object('amount', v_bw_amount, 'label', v_bw_label) end,
    'best_day',     case when v_bd_amount is null then null
                         else jsonb_build_object('amount', v_bd_amount, 'label', v_bd_label) end,
    'monthly_year', v_monthly,
    'year',         v_year
  );
end;
$$;

grant execute on function public.get_agent_stats(text) to authenticated;
