-- =============================================================================
-- First Class Agency — SMS conversations
-- Run AFTER 15-billing.sql.
-- Stores every inbound + outbound SMS, indexed by lead for the Messages tab.
-- Idempotent — safe to re-run.
-- =============================================================================

create table if not exists public.sms_messages (
  id           uuid        primary key default gen_random_uuid(),
  lead_id      uuid        not null references public.leads(id) on delete cascade,
  agent_id     uuid        not null references public.profiles(id) on delete cascade,
  direction    text        not null check (direction in ('in','out')),
  body         text        not null,
  twilio_sid   text,                                -- Twilio Message SID once sent
  status       text        not null default 'sent', -- 'queued' | 'sent' | 'delivered' | 'failed' | 'received'
  error_code   text,                                -- Twilio error code on failure
  read_at      timestamptz,                         -- when agent marked the inbound as read
  segment_count smallint   not null default 1,      -- billing segments (160-char chunks)
  cost_cents   integer     not null default 0,      -- what the agent paid for this message
  created_at   timestamptz not null default now()
);

-- Indexes for the Messages-tab queries
create index if not exists idx_sms_lead_created   on public.sms_messages (lead_id, created_at desc);
create index if not exists idx_sms_agent_created  on public.sms_messages (agent_id, created_at desc);
create index if not exists idx_sms_unread         on public.sms_messages (agent_id, read_at) where direction = 'in' and read_at is null;

-- Latest-message-per-lead view, used to render the left-pane conversation list.
create or replace view public.sms_conversations as
  select distinct on (m.lead_id)
    m.lead_id,
    m.agent_id,
    l.full_name        as lead_name,
    l.phone            as lead_phone,
    l.stage            as lead_stage,
    l.state            as lead_state,
    m.body             as last_message,
    m.direction        as last_direction,
    m.created_at       as last_at,
    (
      select count(*) from public.sms_messages u
      where u.lead_id = m.lead_id
        and u.direction = 'in'
        and u.read_at is null
    ) as unread_count
  from public.sms_messages m
  join public.leads l on l.id = m.lead_id
  order by m.lead_id, m.created_at desc;

alter table public.sms_messages enable row level security;

drop policy if exists "sms_self_read"  on public.sms_messages;
drop policy if exists "sms_self_write" on public.sms_messages;

create policy "sms_self_read"  on public.sms_messages
  for select using (agent_id = auth.uid() or public.is_admin());

create policy "sms_self_write" on public.sms_messages
  for insert with check (agent_id = auth.uid());

create policy "sms_self_update" on public.sms_messages
  for update using (agent_id = auth.uid());

-- Mark an inbound message as read
create or replace function public.mark_sms_read(p_message_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.sms_messages
  set read_at = now()
  where id = p_message_id
    and agent_id = auth.uid()
    and direction = 'in'
    and read_at is null;
$$;

grant execute on function public.mark_sms_read(uuid) to authenticated;

-- Mark every inbound message from a lead as read (used when opening a thread)
create or replace function public.mark_thread_read(p_lead_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.sms_messages
  set read_at = now()
  where lead_id = p_lead_id
    and agent_id = auth.uid()
    and direction = 'in'
    and read_at is null;
$$;

grant execute on function public.mark_thread_read(uuid) to authenticated;
