-- =============================================================================
-- First Class Agency — in-portal CRM v1
-- Run AFTER 11-leaderboard-top-producer.sql.
-- Adds per-agent lead management + call-attempt logging for the Dialer page.
-- Idempotent — safe to re-run.
-- =============================================================================

-- 1) LEADS table -------------------------------------------------------------
-- Each lead is owned by one agent (the one who added it / was assigned it).
-- Agents only see their own leads; admins see leads in their hierarchy.
create table if not exists public.leads (
  id              uuid        primary key default gen_random_uuid(),
  agent_id        uuid        not null references auth.users(id) on delete cascade,
  full_name       text        not null,
  phone           text        not null,
  email           text,
  address         text,
  state           text,                              -- 2-letter US state, optional
  date_of_birth   date,
  notes           text,
  stage           text        not null default 'new' check (
                    stage in ('new', 'contacted', 'callback', 'quoted', 'sold', 'dead')
                  ),
  source          text,                              -- 'manual', 'csv', etc.
  last_called_at  timestamptz,
  callback_at     timestamptz,                       -- when this lead should resurface
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_leads_agent      on public.leads (agent_id);
create index if not exists idx_leads_stage      on public.leads (stage);
create index if not exists idx_leads_callback   on public.leads (callback_at)
  where callback_at is not null;
create index if not exists idx_leads_agent_stage on public.leads (agent_id, stage);

-- Auto-update updated_at on changes
create or replace function public.touch_leads_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at
  before update on public.leads
  for each row execute function public.touch_leads_updated_at();


-- 2) CALL ATTEMPTS table -----------------------------------------------------
-- Every dial is logged. One lead can have many attempts.
create table if not exists public.call_attempts (
  id            uuid        primary key default gen_random_uuid(),
  lead_id       uuid        not null references public.leads(id) on delete cascade,
  agent_id      uuid        not null references auth.users(id) on delete cascade,
  disposition   text        not null check (
                  disposition in ('no_answer', 'voicemail', 'callback', 'not_interested', 'quoted', 'sold', 'bad_number')
                ),
  notes         text,
  called_at     timestamptz not null default now()
);

create index if not exists idx_calls_lead       on public.call_attempts (lead_id);
create index if not exists idx_calls_agent_date on public.call_attempts (agent_id, called_at desc);


-- 3) ROW LEVEL SECURITY -------------------------------------------------------
alter table public.leads          enable row level security;
alter table public.call_attempts  enable row level security;

-- Each agent can read/write their own leads
drop policy if exists "own_leads_select" on public.leads;
create policy "own_leads_select"
  on public.leads for select
  to authenticated
  using (agent_id = auth.uid() or public.is_admin());

drop policy if exists "own_leads_insert" on public.leads;
create policy "own_leads_insert"
  on public.leads for insert
  to authenticated
  with check (agent_id = auth.uid());

drop policy if exists "own_leads_update" on public.leads;
create policy "own_leads_update"
  on public.leads for update
  to authenticated
  using (agent_id = auth.uid() or public.is_admin());

drop policy if exists "own_leads_delete" on public.leads;
create policy "own_leads_delete"
  on public.leads for delete
  to authenticated
  using (agent_id = auth.uid() or public.is_admin());

-- Each agent can read/write their own call attempts
drop policy if exists "own_calls_select" on public.call_attempts;
create policy "own_calls_select"
  on public.call_attempts for select
  to authenticated
  using (agent_id = auth.uid() or public.is_admin());

drop policy if exists "own_calls_insert" on public.call_attempts;
create policy "own_calls_insert"
  on public.call_attempts for insert
  to authenticated
  with check (agent_id = auth.uid());


-- 4) Daily-stats helper RPC --------------------------------------------------
-- Returns the agent's call counts for "today" (America/New_York).
create or replace function public.get_dialer_today_stats()
returns table (
  dials       integer,
  contacts    integer,   -- any disposition that wasn't 'no_answer' or 'voicemail'
  sold        integer
)
language sql security definer set search_path = public as $$
  with bounds as (
    select
      date_trunc('day', (now() at time zone 'America/New_York')) at time zone 'America/New_York' as start_t,
      (date_trunc('day', (now() at time zone 'America/New_York')) + interval '1 day') at time zone 'America/New_York' as end_t
  )
  select
    count(*)::int                                                                       as dials,
    count(*) filter (where disposition not in ('no_answer', 'voicemail'))::int          as contacts,
    count(*) filter (where disposition = 'sold')::int                                   as sold
  from public.call_attempts ca, bounds b
  where ca.agent_id = auth.uid()
    and ca.called_at >= b.start_t
    and ca.called_at <  b.end_t;
$$;

grant execute on function public.get_dialer_today_stats() to authenticated;
