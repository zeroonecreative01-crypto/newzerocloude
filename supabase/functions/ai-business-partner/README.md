# ZERO ONE AI Business Partner — staged foundation

This directory is a development-branch foundation. It has **not** been applied to the Supabase project and the Edge Function has **not** been deployed.

## Current scope

- Private CRM tables for campaigns, prospects, campaign membership, outreach drafts, suppressions, agent runs, and audit events.
- RLS policies that require a seeded application admin for authenticated access.
- Authenticated Edge Function endpoint with two actions:
  - `health`: checks the draft-only service path.
  - `draft_outreach`: generates and stores an outreach draft using the OpenAI Responses API.
- No endpoint for sending email, social DMs, WhatsApp messages, or paid campaigns. The function always returns `sent: false`.

## Before deploying

1. Confirm the restored project is fully `ACTIVE` and take/verify a database backup.
2. Review the migration and inspect current tables, RLS policies, migrations, auth settings, and storage buckets. The initial discovery pass found no application tables in `public`, no policies, no recorded migrations, and no Edge Functions; built-in `auth`, `extensions`, and `vault` objects are expected platform schemas.
3. Apply the migration only after review. Do not run it against a different project by accident.
4. Configure Edge Function secrets in Supabase (never in the website or Git):
   - `OPENAI_API_KEY` — required for draft generation.
   - `OPENAI_MODEL` — optional; defaults to `gpt-4.1-mini`.
   - `ALLOWED_ORIGINS` — optional comma-separated list of trusted site origins. Defaults to the two current ZERO ONE Vercel domains.
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are supplied by the Supabase Edge Function runtime in standard Supabase deployments. Verify their availability in the target project; never print their values.
5. Create the owner/admin account through Supabase Auth, then seed only its verified UUID into `public.app_admins` through an authorized SQL session. Do not allow browser-side admin enrollment.
6. Deploy the function to a preview/development environment first. Keep JWT verification enabled.
7. Test with a synthetic prospect and campaign, confirm RLS and suppression checks, and confirm that no message is sent.

## Function request shapes

Health:
```json
{ "action": "health" }
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
- Supabase project ref: `wfxaacrxolofifflwsak` (restoration requested/completed at the control plane; SQL connectivity returned, but the project status endpoint still reported `COMING_UP` on the latest check).
- Email: the session's connected Superhuman Mail account reports `zeroone.creative.01@gmail.com` as the primary account. This is not proof that the app has OAuth scopes for the new backend.
- Gmail native plugin discovery reported the Gmail connector unavailable in this workspace; do not assume a direct Gmail API integration exists.
- Instagram, LinkedIn, and WhatsApp Business API permissions remain unverified.

## Rollout policy

Start in research/qualification/draft-only mode. Before enabling any real send, separately implement and review channel-specific authorization, consent evidence, rate caps, idempotent send jobs, reply/opt-out processing, audit logs, and an emergency kill switch. Never automate browser scraping or unofficial WhatsApp Web actions.
