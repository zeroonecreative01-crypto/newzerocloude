# ZERO ONE AI Business Partner — Implementation Plan

Status: foundation / discovery phase (2026-10-13)
Scope: global prospecting, CRM enrichment, campaign planning, outbound communications, follow-up, reporting.
Operating mode: high autonomy with explicit approval gates for consequential actions.
Budget posture: reuse the existing website, Vercel team, Supabase project, and available tools before adding paid services.

## 1. Verified current state

- Website repository available to the connected GitHub account: `zeroonecreative01-crypto/newzerocloude`, default branch `main`.
- Website is a static HTML/CSS/JavaScript site served from `site/`; `site/index.html` declares the public brand email `zeroone.creative.01@gmail.com` and current social links.
- Vercel team: `ZERO ONE` (Hobby plan); project `zero-one-marketing`, domains `zero-one9.vercel.app` and `newzerocloude.vercel.app`.
- Supabase project `zero-one-agency-v2-`, ref `wfxaacrxolofifflwsak`, region `eu-west-1`, was restored and now reports `ACTIVE_HEALTHY`. The existing CRM includes `profiles`, `leads`, `projects`, `services`, `pricing_plans`, `media_assets`, `site_content`, `client_logos`, `tasks`, and `activity_log`; existing tables have RLS enabled. Existing migrations are `initial_zero_one_cms_crm` and `seed_zero_one_content`. No Edge Functions were listed. The new AI schema and function remain staged in Git only.
- A previously referenced repository name `zero-one-agency-v2-` was not accessible through the connected GitHub API; do not assume it is the current deploy source.
- No Gmail, Meta, LinkedIn, WhatsApp Business, OpenAI API, or CRM integration credentials have been verified in this discovery pass. Never treat a brand email or public social URL as proof of authenticated access.

## 2. Proposed low-cost architecture

1. **Existing website / admin console**: preserve the static public site. Add a separately protected internal dashboard only after the API and authentication path are verified.
2. **Orchestrator**: OpenAI API from server-side Vercel functions. Start with one manager/orchestrator and narrow tools for research, qualification, drafting, CRM updates, and reporting. Split into specialist agents only when trace data proves it helps.
3. **System of record**: existing Supabase CRM. Store researched businesses in `public.leads` with source `ai_research`; keep AI-specific evidence in `public.ai_lead_research`. Reuse `public.profiles` and `public.is_staff()` for authorization. Do not create duplicate users or prospect tables.
4. **Scheduled work**: prefer the lowest-cost scheduler already supported by the Vercel/Supabase plan. If the Hobby plan cannot support the required cadence, use a manual run button first rather than adding a paid scheduler immediately.
5. **Auditability**: every run, source URL, score rationale, draft, send attempt, approval, reply, opt-out, and error should be logged with timestamps and idempotency keys.
6. **Secrets**: API keys and OAuth refresh tokens belong in server-side environment variables / a secret store only. Never place secrets in `site/config.js`, browser code, Git history, or client-visible logs.

## 3. Initial workflow

1. Load a campaign brief (target markets, sectors, services, approved pricing, language, value proposition, exclusions, and daily send cap).
2. Discover prospects from permitted public/business sources or an approved B2B data provider.
3. Deduplicate against the CRM; validate source URLs and available contact data.
4. Score each prospect for fit and record the evidence behind the score.
5. Generate a specific, truthful outreach draft using the prospect's public business context; no fabricated claims or false familiarity.
6. Apply channel policy checks, jurisdiction rules, suppression lists, rate limits, and duplicate-send protection.
7. For initial launch, queue drafts for human approval. After the owner explicitly enables a channel and approves its policy/caps, allow low-risk sends inside those boundaries.
8. Process replies, detect positive intent / objections / opt-outs, update CRM, and escalate negotiations, pricing exceptions, complaints, legal requests, and sensitive cases.
9. Produce a daily report: prospects found, qualified, drafts, sent, replies, positive replies, meetings, opt-outs, errors, spend, and next actions. Do not claim conversions without recorded evidence.

## 4. Channel rollout and guardrails

- **Gmail / Google Workspace**: first outbound channel after OAuth scopes, sender identity, quotas, unsubscribe/opt-out handling, and deliverability are verified. Respect applicable anti-spam and privacy rules; no purchased or scraped personal-email blast lists.
- **LinkedIn**: start with research and draft assistance. Do not automate browser actions or bulk unsolicited messaging. Enable direct actions only through permitted, approved platform/API capabilities.
- **Instagram**: start with profile/business research and response drafts. Direct messaging requires eligible professional-account setup, Meta app permissions/review where applicable, and policy-compliant messaging context.
- **WhatsApp Business**: do not send until the business account/phone is verified and the official Business Platform integration, opt-in evidence, approved templates where required, and messaging windows are configured. No unofficial WhatsApp Web automation.
- **Paid ads**: analysis and campaign setup drafts can be automated; spending, campaign activation, budget increases, and material targeting changes require an explicit approval/limit.
- **Human approval required**: contracts, discounts outside approved pricing, refunds, commitments, legal/PR replies, high-volume campaigns, budget changes, and any action with uncertain authorization.
- **Universal stop rules**: honor opt-outs and suppression lists across channels, stop follow-ups after a reply or opt-out as appropriate, cap retries, and fail closed when credentials, identity, policy status, or recipient consent is uncertain.

## 5. Implementation milestones

### Milestone A — unblock and inspect (required before database changes)
- Restore or otherwise reactivate the existing Supabase project only with owner confirmation if it may incur cost or operational impact.
- Re-run table, migration, RLS, and Edge Function inventory.
- Confirm the exact Vercel deployment source and environment-variable *names/status* without exposing secret values.
- Verify Google Workspace ownership and decide whether OAuth consent can be configured for the sender mailbox.
- Record Meta Business/Instagram, LinkedIn, and WhatsApp Business account/API eligibility.

### Milestone B — CRM foundation
- Map existing tables and policies.
- Add only missing fields/tables after review: campaign runs, prospect source evidence, outreach queue, approvals, suppression/consent records, audit events, and channel status.
- Add RLS and server-only service-role access; all admin actions authenticated and authorized.

### Milestone C — research + drafting MVP
- Build a manual-trigger run first: find prospects, score/deduplicate, create drafts, and show them in an approval queue.
- Add structured outputs, tool allowlists, input/output validation, per-run budget limits, and tracing.
- No automatic sending in this milestone.

### Milestone D — controlled Gmail pilot
- Connect OAuth and sender identity.
- Enable low daily caps, send windows, opt-out/suppression checks, idempotency, bounce handling, and reply synchronization.
- Start with a small approved pilot list; evaluate quality and deliverability before scaling.

### Milestone E — other channels and scheduled operations
- Integrate each channel only after its official permissions and eligibility are verified.
- Add scheduled jobs, retry policies, alerting, reporting, and an emergency kill switch.
- Gradually increase autonomy based on measured outcomes, never solely on volume.

## 6. Acceptance criteria

- No prospect can be sent twice for the same campaign step.
- Every prospect has a source and a reason for qualification.
- Opt-outs are enforced globally and immediately.
- Sending is impossible when the channel is not explicitly enabled or its authorization/consent status is unknown.
- No secret is exposed to browser code or Git.
- Runs are resumable/idempotent and failures are visible.
- Reports distinguish verified results from estimates.
- Daily send caps, API spend caps, and an emergency stop are enforceable server-side.

## 7. Current blockers / next action

The isolated development project has now been created and initialized. The dev-only baseline, AI schema, and security/index hardening migrations are applied; the Edge Function is deployed with JWT verification. The dashboard points to the dev project. No production schema was changed and no messages were sent.

Remaining blockers are configuring the server-side `OPENAI_API_KEY`, provisioning the owner's Auth user/profile through a trusted route, and verifying the OTP redirect URL. Then run a synthetic-lead smoke test. Channel integrations remain unverified and outbound sending is not implemented.

## 8. Updated development environment status (2026-10-13)

- Created separate Supabase project `zero-one-ai-dev` in `eu-west-1` on the displayed $0/month creation tier; project ref `kwmzyzwhugrxglqpsmwq`. No production data was copied.
- The development database intentionally uses a minimal compatibility baseline (`profiles`, `leads`, enums, and a staff helper) rather than cloning the production CRM. It contains no customer records and has no signup trigger that auto-promotes the first user.
- Applied the development baseline, AI Business Partner schema, and hardening/index migrations to the dev project. Verified all nine public tables have RLS enabled and migration history is present.
- Security verification: `anon` cannot execute `public.is_staff()`; authenticated staff can. Supabase security advisor currently returns no findings. Performance advisor only reports unused indexes expected in a fresh, empty dev database.
- Deployed `ai-business-partner` Edge Function to the dev project with JWT verification enabled. CORS allows the production site domains plus this Vercel project's preview URL pattern. No sending endpoint exists; the function supports research, draft-only, and health actions.
- Updated `site/ai-partner.js` to use the isolated dev Supabase project and its publishable key, not production.
- Remaining activation steps: configure `OPENAI_API_KEY` as a server-side Supabase Function secret (never in chat or browser code); create/invite the owner Auth user in Supabase Dashboard and provision their `public.profiles` row through a trusted admin path; verify the OTP redirect URL and run a synthetic-lead smoke test. No real messages or campaigns have been sent.
