-- =============================================================================
-- First Class Agency — Lead distribution helpers
-- Run AFTER 16-sms-messages.sql.
-- Adds:
--   - assigned_at column on leads (for aged-lead detection)
--   - days_since_assignment view helper
--   - bulk reassign RPC for admins
-- Idempotent — safe to re-run.
-- =============================================================================

alter table public.leads
  add column if not exists assigned_at timestamptz not null default now();

-- Backfill assigned_at to created_at for existing rows
update public.leads
set assigned_at = created_at
where assigned_at = '1970-01-01'::timestamptz or assigned_at is null;

-- Convenience view: every lead with its age in days since assignment.
-- The Team tab uses this to find leads that should be eligible for reassignment.
create or replace view public.team_leads as
  select
    l.*,
    floor(extract(epoch from (now() - l.assigned_at)) / 86400)::integer as days_since_assigned,
    case
      when l.stage = 'sold' then false
      when l.stage = 'dead' then false
      when floor(extract(epoch from (now() - l.assigned_at)) / 86400) >= 30 then true
      else false
    end as is_aged,
    p.full_name as agent_name,
    p.avatar_url as agent_avatar
  from public.leads l
  left join public.profiles p on p.id = l.agent_id;

-- RPC: admins only — reassign a set of leads to a new agent.
-- Resets assigned_at so the aged-lead clock starts over on the new owner.
create or replace function public.admin_reassign_leads(
  p_lead_ids   uuid[],
  p_new_agent  uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can reassign leads';
  end if;
  update public.leads
  set agent_id    = p_new_agent,
      assigned_at = now()
  where id = any(p_lead_ids);
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

grant execute on function public.admin_reassign_leads(uuid[], uuid) to authenticated;

-- RPC: admins only — bulk insert leads and distribute them across agents.
-- Distribution mode:
--   'single'      → all rows go to p_target_agent (target required)
--   'round_robin' → cycle through p_agent_ids in order
create or replace function public.admin_distribute_leads(
  p_rows          jsonb,         -- array of lead objects (full_name, phone, email, state, ...)
  p_mode          text,          -- 'single' | 'round_robin'
  p_target_agent  uuid,          -- required for 'single', ignored otherwise
  p_agent_ids     uuid[]         -- required for 'round_robin', ignored otherwise
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
      source, assigned_at
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
      coalesce(v_row->>'source', 'admin_import'),
      now()
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.admin_distribute_leads(jsonb, text, uuid, uuid[]) to authenticated;
