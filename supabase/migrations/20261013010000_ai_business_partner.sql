-- ZERO ONE AI Business Partner foundation.
-- Staged in Git only. Uses the existing ZERO ONE CRM (public.leads / public.profiles).
-- Do not apply until the target environment has been explicitly selected and reviewed.

alter type public.lead_source add value if not exists 'ai_research';

create table if not exists public.ai_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  objective text not null default 'qualified_leads',
  target_markets text[] not null default '{}',
  target_sectors text[] not null default '{}',
  services_offered text[] not null default '{}',
  languages text[] not null default '{en}',
  channels text[] not null default '{email}',
  status text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  daily_send_cap integer not null default 0 check (daily_send_cap between 0 and 500),
  approval_required boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Research metadata is attached to the existing CRM lead instead of duplicating it.
create table if not exists public.ai_lead_research (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  website_url text,
  sector text,
  linkedin_url text,
  instagram_url text,
  source_url text not null,
  source_notes text,
  fit_score integer check (fit_score between 0 and 100),
  fit_rationale text,
  do_not_contact boolean not null default false,
  last_verified_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_lead_research_website_unique
  on public.ai_lead_research (lower(website_url))
  where website_url is not null;
create index if not exists ai_lead_research_fit_score_idx
  on public.ai_lead_research (fit_score desc nulls last);
create index if not exists ai_lead_research_sector_idx
  on public.ai_lead_research (sector);

create table if not exists public.ai_campaign_leads (
  campaign_id uuid not null references public.ai_campaigns(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  stage text not null default 'queued' check (stage in ('queued','qualified','drafted','approved','contacted','replied','converted','skipped')),
  qualification_notes text,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, lead_id)
);

create table if not exists public.ai_outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ai_campaigns(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  channel text not null check (channel in ('email','instagram','linkedin','whatsapp')),
  step_number integer not null default 1 check (step_number between 1 and 10),
  subject text,
  body text not null,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','rejected','sent','cancelled')),
  model text,
  generated_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  external_message_id text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  unique (campaign_id, lead_id, channel, step_number)
);

create index if not exists ai_outreach_drafts_queue_idx
  on public.ai_outreach_drafts (status, generated_at);

create table if not exists public.ai_suppressions (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email','instagram','linkedin','whatsapp','all')),
  normalized_address text not null,
  reason text not null default 'opt_out',
  source text,
  created_at timestamptz not null default now(),
  unique (channel, normalized_address)
);

create table if not exists public.ai_agent_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check (run_type in ('health_check','prospect_research','qualification','draft_generation','reply_triage','report')),
  status text not null default 'running' check (status in ('running','succeeded','failed','cancelled')),
  campaign_id uuid references public.ai_campaigns(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  started_by uuid references public.profiles(id) on delete set null,
  input_summary jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists ai_agent_runs_recent_idx
  on public.ai_agent_runs (started_at desc);

create table if not exists public.ai_audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_audit_events_recent_idx
  on public.ai_audit_events (created_at desc);

-- Reuse the existing role helpers. The Edge Function independently verifies
-- that the authenticated user's profile is active and has a staff role.
alter table public.ai_campaigns enable row level security;
alter table public.ai_lead_research enable row level security;
alter table public.ai_campaign_leads enable row level security;
alter table public.ai_outreach_drafts enable row level security;
alter table public.ai_suppressions enable row level security;
alter table public.ai_agent_runs enable row level security;
alter table public.ai_audit_events enable row level security;

drop policy if exists "staff manage AI campaigns" on public.ai_campaigns;
create policy "staff manage AI campaigns"
  on public.ai_campaigns for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff manage AI lead research" on public.ai_lead_research;
create policy "staff manage AI lead research"
  on public.ai_lead_research for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff manage AI campaign leads" on public.ai_campaign_leads;
create policy "staff manage AI campaign leads"
  on public.ai_campaign_leads for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff manage AI outreach drafts" on public.ai_outreach_drafts;
create policy "staff manage AI outreach drafts"
  on public.ai_outreach_drafts for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff manage AI suppressions" on public.ai_suppressions;
create policy "staff manage AI suppressions"
  on public.ai_suppressions for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff read AI agent runs" on public.ai_agent_runs;
create policy "staff read AI agent runs"
  on public.ai_agent_runs for select to authenticated
  using (public.is_staff());

drop policy if exists "staff read AI audit events" on public.ai_audit_events;
create policy "staff read AI audit events"
  on public.ai_audit_events for select to authenticated
  using (public.is_staff());

grant select, insert, update, delete on public.ai_campaigns to authenticated;
grant select, insert, update, delete on public.ai_lead_research to authenticated;
grant select, insert, update, delete on public.ai_campaign_leads to authenticated;
grant select, insert, update, delete on public.ai_outreach_drafts to authenticated;
grant select, insert, update, delete on public.ai_suppressions to authenticated;
grant select on public.ai_agent_runs to authenticated;
grant select on public.ai_audit_events to authenticated;

comment on table public.ai_campaigns is 'Campaign briefs and owner-approved operating limits for ZERO ONE AI Business Partner.';
comment on table public.ai_lead_research is 'Public-source research metadata attached to existing ZERO ONE CRM leads.';
comment on table public.ai_campaign_leads is 'Membership of existing CRM leads in AI-assisted campaigns.';
comment on table public.ai_outreach_drafts is 'Draft-only outbound content. Sending is intentionally not implemented in the initial agent function.';
comment on table public.ai_suppressions is 'Cross-channel opt-out and suppression list; check before every future send.';
comment on table public.ai_agent_runs is 'Run ledger for agent observability and resumability.';
comment on table public.ai_audit_events is 'Audit trail for consequential agent actions.';
