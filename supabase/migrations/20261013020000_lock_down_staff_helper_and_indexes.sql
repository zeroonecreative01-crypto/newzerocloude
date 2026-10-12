-- Harden the public staff helper and cover foreign-key lookup paths in the dev schema.
revoke execute on function public.is_staff() from anon;
grant execute on function public.is_staff() to authenticated;

create index if not exists ai_agent_runs_campaign_id_idx on public.ai_agent_runs (campaign_id);
create index if not exists ai_agent_runs_lead_id_idx on public.ai_agent_runs (lead_id);
create index if not exists ai_agent_runs_started_by_idx on public.ai_agent_runs (started_by);
create index if not exists ai_audit_events_actor_user_id_idx on public.ai_audit_events (actor_user_id);
create index if not exists ai_campaign_leads_lead_id_idx on public.ai_campaign_leads (lead_id);
create index if not exists ai_campaigns_created_by_idx on public.ai_campaigns (created_by);
create index if not exists ai_lead_research_created_by_idx on public.ai_lead_research (created_by);
create index if not exists ai_outreach_drafts_approved_by_idx on public.ai_outreach_drafts (approved_by);
create index if not exists ai_outreach_drafts_lead_id_idx on public.ai_outreach_drafts (lead_id);
create index if not exists leads_assigned_to_idx on public.leads (assigned_to);
