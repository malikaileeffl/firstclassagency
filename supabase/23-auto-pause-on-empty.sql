-- =============================================================================
-- First Class Agency — Auto-pause on empty balance
-- Run AFTER 22-credits-pause.sql.
-- When an agent's credit_balance_cents drops to zero (or below), the Master
-- Switch flips ON automatically. Protects the manager from any race condition
-- where a credit-consuming action could fire after the balance is exhausted.
-- The auto-flip only happens once on the transition into empty — agents must
-- manually flip the switch off after topping up, so they consciously resume
-- spending.
-- Idempotent — safe to re-run.
-- =============================================================================

create or replace function public.auto_pause_on_empty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Trigger only on the descending edge: balance was positive, now it's not.
  if NEW.credit_balance_cents <= 0
     and OLD.credit_balance_cents > 0
     and NEW.credits_paused = false then
    NEW.credits_paused := true;
  end if;
  return NEW;
end;
$$;

drop trigger if exists profiles_auto_pause_on_empty on public.profiles;
create trigger profiles_auto_pause_on_empty
  before update of credit_balance_cents on public.profiles
  for each row
  execute function public.auto_pause_on_empty();
