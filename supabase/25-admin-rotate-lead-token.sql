-- =============================================================================
-- First Class Agency — Admin can rotate any agent's lead token
-- Run AFTER 24-lead-webhook-tokens.sql.
--
-- Adds an RPC so a super_admin (or team admin for their own downline) can
-- rotate a downstream agent's webhook token if it leaks or needs a refresh.
-- Idempotent — safe to re-run.
-- =============================================================================

create or replace function public.admin_rotate_lead_token(target_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new text := public.gen_lead_token();
  v_can boolean;
begin
  -- Permission: super_admin OR the caller is the manager of target_user.
  select public.is_super_admin()
      or public.is_my_direct_report(target_user)
      or target_user = auth.uid()
    into v_can;

  if not v_can then
    raise exception 'not_authorized';
  end if;

  update public.profiles
     set agent_lead_token = v_new
   where id = target_user;

  return v_new;
end;
$$;

grant execute on function public.admin_rotate_lead_token(uuid) to authenticated;
