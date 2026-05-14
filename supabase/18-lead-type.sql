-- =============================================================================
-- First Class Agency — Lead type
-- Run AFTER 17-lead-distribution.sql.
-- Adds a `lead_type` column on leads (Trucker IUL / Gen Life IUL / Gen Life /
-- Veteran IUL — admins can add new values whenever). Quote field is no longer
-- displayed but the column stays in case we want it later.
-- Idempotent — safe to re-run.
-- =============================================================================

alter table public.leads
  add column if not exists lead_type text;

-- Update the distribute RPC so it accepts + writes lead_type from the import.
create or replace function public.admin_distribute_leads(
  p_rows          jsonb,
  p_mode          text,
  p_target_agent  uuid,
  p_agent_ids     uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     jsonb;
  v_count   integer := 0;
  v_idx     integer := 0;
  v_owner   uuid;
  v_total_agents integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can distribute leads';
  end if;
  if p_mode = 'single' and p_target_agent is null then
    raise exception 'Single-agent mode requires p_target_agent';
  end if;
  if p_mode = 'round_robin' and (p_agent_ids is null or array_length(p_agent_ids, 1) = 0) then
    raise exception 'Round-robin mode requires at least one agent in p_agent_ids';
  end if;

  v_total_agents := coalesce(array_length(p_agent_ids, 1), 0);

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    if p_mode = 'single' then
      v_owner := p_target_agent;
    else
      v_owner := p_agent_ids[(v_idx % v_total_agents) + 1];
      v_idx := v_idx + 1;
    end if;

    insert into public.leads (
      agent_id, full_name, phone, email, state, address, date_of_birth, notes,
      lead_type, source, assigned_at
    )
    values (
      v_owner,
      v_row->>'full_name',
      v_row->>'phone',
      nullif(v_row->>'email', ''),
      nullif(v_row->>'state', ''),
      nullif(v_row->>'address', ''),
      nullif(v_row->>'date_of_birth', '')::date,
      nullif(v_row->>'notes', ''),
      nullif(v_row->>'lead_type', ''),
      coalesce(v_row->>'source', 'admin_import'),
      now()
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
