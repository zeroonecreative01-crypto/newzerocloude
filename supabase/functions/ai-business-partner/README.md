# ZERO ONE AI Business Partner — staged foundation

This directory is a development-branch foundation. The Supabase project has been restored and inspected, but this migration has **not** been applied and the Edge Function has **not** been deployed.

## Existing system reused

- CRM lead records live in `public.leads`; AI research metadata is attached through `public.ai_lead_research`.
- Staff access reuses `public.profiles`, `public.app_role`, and the existing `public.is_staff()` helper.
- Existing CRM migrations and RLS policies are preserved. This change does not create a second users table or a duplicate prospect table.
- The inspected CRM currently has no lead/profile rows, but it does have tables for leads, projects, services, pricing, content, media, tasks, and activity logs.

## Current scope

- Campaign briefs, campaign-to-lead links, public-source research metadata, outreach drafts, suppressions, agent runs, and audit events.
- RLS policies for new AI tables use the existing `public.is_staff()` role helper.
- Authenticated Edge Function endpoint with three actions:
  - `health`: checks the draft-only service path.
  - `research_prospects`: uses OpenAI web search to find public business prospects, validates source URLs, deduplicates, and links records to existing CRM leads.
  - `draft_outreach`: generates and stores an outreach draft using the OpenAI Responses API.
- No endpoint for sending email, social DMs, WhatsApp messages, or paid campaigns. The function never sends messages.

## Before deploying

1. The restored project currently reports `ACTIVE_HEALTHY`. Review/verify the available backup before applying any schema change.
2. Apply the migration only after review and only to an explicitly selected development target. The Supabase project is not pinned in `config.toml`; link the intended project deliberately.
3. Configure Edge Function secrets in Supabase (never in the website or Git):
   - `OPENAI_API_KEY` — required for research and draft generation.
   - `OPENAI_MODEL` — optional; defaults to `gpt-4.1-mini`.
   - `ALLOWED_ORIGINS` — optional comma-separated list of trusted site origins. Defaults to the two current ZERO ONE Vercel domains.
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are supplied by the Supabase Edge Function runtime in standard Supabase deployments. Verify their availability in the target project; never print their values.
4. Confirm the owner's Supabase Auth account exists and its profile is active with an allowed staff role. The dashboard uses `shouldCreateUser: false`; it does not offer self-signup.
5. **Security check:** the existing `handle_new_user()` trigger assigns the first profile the `admin` role if no profiles exist. The current profile table was empty during inspection. Verify Auth signup settings and provision the owner through a trusted route before exposing sign-in publicly; do not assume public signup is disabled.
6. Configure the exact email OTP redirect URL for the preview origin. Deploy the function to a development/preview environment first. Keep JWT verification enabled.
7. Test with synthetic leads and campaigns, confirm RLS and suppression checks, and confirm that no message is sent.

## Function request shapes

Health:
```json
{ "action": "health" }
```

Research (market, sector, or both; maximum 10 results per run):
```json
{
  "action": "research_prospects",
  "campaign_id": "UUID",
  "market": "United Arab Emirates",
  "sector": "hospitality",
  "limit": 5
}
```

Draft (the `prospect_id` request field contains an existing `public.leads.id`):
```json
{
  "action": "draft_outreach",
  "campaign_id": "UUID",
  "prospect_id": "UUID",
  "channel": "email",
  "step_number": 1
}
```

Requests require a valid Supabase user JWT and an active staff profile with role `admin`, `editor`, or `sales`. Research writes source-backed business records into the existing CRM and links them to a campaign. Draft generation requires research metadata, campaign membership, an enabled channel, and a non-suppressed recipient.

## Current integrations

- Vercel team: `ZERO ONE`; project: `zero-one-marketing`.
- Supabase project ref: `wfxaacrxolofifflwsak`; currently `ACTIVE_HEALTHY`.
- Existing CRM migrations: `initial_zero_one_cms_crm` and `seed_zero_one_content`.
- Existing RLS is enabled on the current application tables. Public published content policies remain unchanged.
- The session's connected Superhuman Mail account reports `zeroone.creative.01@gmail.com` as primary. This does not prove that the new backend has Gmail API scopes.
- Instagram, LinkedIn, and WhatsApp Business API permissions remain unverified.

## Rollout policy

Start in research/qualification/draft-only mode. Before enabling any real send, separately implement and review channel-specific authorization, consent evidence, rate caps, idempotent send jobs, reply/opt-out processing, audit logs, and an emergency kill switch. Never automate browser scraping or unofficial WhatsApp Web actions.
