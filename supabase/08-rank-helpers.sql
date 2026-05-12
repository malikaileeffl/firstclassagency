-- =============================================================================
-- First Class Agency — rank system helper
-- Run AFTER 07-leaderboard.sql.
-- Adds an RPC that returns lifetime premium totals per agent (by GroupMe
-- sender_name). The frontend ranks.js module uses this to compute each
-- agent's current rank and progress to next.
-- Idempotent — safe to re-run.
-- =============================================================================

create or replace function public.get_lifetime_premiums()
returns table (
  sender_name      text,
  lifetime_premium numeric
)
language sql security definer set search_path = public as $$
  select sender_name, sum(amount)::numeric as lifetime_premium
  from public.leaderboard_entries
  group by sender_name;
$$;

grant execute on function public.get_lifetime_premiums() to authenticated;

-- Personal version — just for the signed-in user, looked up by full_name.
-- Used by the dashboard rank widget. Returns 0 if no entries match.
create or replace function public.get_my_lifetime_premium(p_name text)
returns numeric
language sql security definer set search_path = public as $$
  select coalesce(sum(amount), 0)::numeric
  from public.leaderboard_entries
  where lower(sender_name) = lower(p_name);
$$;

grant execute on function public.get_my_lifetime_premium(text) to authenticated;
