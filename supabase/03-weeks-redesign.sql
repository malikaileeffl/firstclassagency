-- =============================================================================
-- First Class Agency — switch onboarding to 8-week grid
-- Replaces sequential current_step (0-9) with a completed_weeks int[] array.
-- Run AFTER 02-hierarchy.sql.
-- Idempotent — safe to re-run.
-- =============================================================================

-- 1) Add completed_weeks column ----------------------------------------------
alter table public.onboarding_progress
  add column if not exists completed_weeks int[] not null default '{}';

-- 2) Backfill from current_step if any data exists ---------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'onboarding_progress'
      and column_name = 'current_step'
  ) then
    update public.onboarding_progress
    set completed_weeks = coalesce(
      (select array_agg(g) from generate_series(1, least(current_step, 8)) g),
      '{}'::int[]
    )
    where coalesce(array_length(completed_weeks, 1), 0) = 0
      and coalesce(current_step, 0) > 0;
  end if;
end$$;

-- 3) Drop the old current_step column (constraint goes with it) --------------
alter table public.onboarding_progress
  drop column if exists current_step;

-- 4) Constrain weeks to 1..8 -------------------------------------------------
alter table public.onboarding_progress
  drop constraint if exists onboarding_weeks_range_check;
alter table public.onboarding_progress
  add constraint onboarding_weeks_range_check
  check (
    completed_weeks <@ array[1,2,3,4,5,6,7,8]::int[]
  );
