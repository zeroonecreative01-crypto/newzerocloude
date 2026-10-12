# ZERO ONE AI Business Partner — staged foundation

This directory is a development-branch foundation. It has **not** been applied to the Supabase project and the Edge Function has **not** been deployed.

## Current scope

- Private CRM tables for campaigns, prospects, campaign membership, outreach drafts, suppressions, agent runs, and audit events.
- RLS policies that require a seeded application admin for authenticated access.
- Authenticated Edge Function endpoint with three actions:
  - `health`: checks the draft-only service path.
  - `research_prospects`: uses OpenAI web search to find public business prospects, validates source URLs, deduplicates, and links records to a campaign.
  - `draft_outreach`: generates and stores an outreach draft using the OpenAI Responses API.
- No endpoint for sending email, social DMs, WhatsApp messages, or paid campaigns. The function never sends messages.

## Before deploying

1. Confirm the restored project is fully `ACTIVE_HEALTHY` and take/verify a database backup.
2. Review the migration and inspect current tables, RLS policies, migrations, auth settings, and storage buckets. The initial discovery pass found no application tables in `public`, no policies, no recorded migrations, and no Edge Functions; built-in `auth`, `extensions`, and `vault` objects are expected platform schemas.
3. Apply the migration only after review. The Supabase project is not pinned in `config.toml`; explicitly link the intended development project before any migration or function deployment.
4. Configure Edge Function secrets in Supabase (never in the website or Git):
   - `OPENAI_API_KEY` — required for research and draft generation.
   - `OPENAI_MODEL` — optional; defaults to `gpt-4.1-mini`.
   - `ALLOWED_ORIGINS` — optional comma-separated list of trusted site origins. Defaults to the two current ZERO ONE Vercel domains.
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are supplied by the Supabase Edge Function runtime in standard Supabase deployments. Verify their availability in the target project; never print their values.
5. Create the owner/admin account through Supabase Auth, then seed only its verified UUID into `public.app_admins` through an authorized SQL session. Do not allow browser-side admin enrollment.
6. Configure the exact email OTP redirect URL for the preview origin. Deploy the function to a preview/development environment first. Keep JWT verification enabled.
7. Test with synthetic prospects and campaigns, confirm RLS and suppression checks, and confirm that no message is sent.

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

Draft:
```json
{
  "action": "draft_outreach",
  "campaign_id": "UUID",
  "prospect_id": "UUID",
  "channel": "email",
  "step_number": 1
}
```

Requests require a valid Supabase user JWT whose UUID exists in `public.app_admins`. Research writes only source-backed business records and campaign links; draft generation requires the prospect to be linked to the campaign, the channel to be enabled for that campaign, and the prospect/recipient not to be suppressed.

## Current integrations

- Vercel project: `zero-one-marketing` under team `ZERO ONE`.
- Supabase project ref: `wfxaacrxolofifflwsak`. The restore completed and the latest control-plane status reported `ACTIVE_HEALTHY`; schema introspection still shows no app tables because this migration remains staged in Git.
- Email: the session's connected Superhuman Mail account reports `zeroone.creative.01@gmail.com` as the primary account. This is not proof that the app has OAuth scopes for the new backend.
- Gmail native plugin discovery reported the Gmail connector unavailable in this workspace; do not assume a direct Gmail API integration exists.
- Instagram, LinkedIn, and WhatsApp Business API permissions remain unverified.

## Rollout policy

Start in research/qualification/draft-only mode. Before enabling any real send, separately implement and review channel-specific authorization, consent evidence, rate caps, idempotent send jobs, reply/opt-out processing, audit logs, and an emergency kill switch. Never automate browser scraping or unofficial WhatsApp Web actions.
