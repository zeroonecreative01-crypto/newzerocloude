import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeadersBase = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Vary": "Origin",
};

const json = (body: unknown, status = 200, origin?: string | null) => new Response(
  JSON.stringify(body),
  {
    status,
    headers: {
      ...corsHeadersBase,
      ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  },
);

const cleanString = (value: unknown, max = 500) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const normalizeAddress = (value: string) => value.trim().toLowerCase();

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ??
    "https://zero-one9.vercel.app,https://newzerocloude.vercel.app")
    .split(",").map((value) => value.trim()).filter(Boolean);

  if (origin && !allowedOrigins.includes(origin)) {
    return json({ error: "origin_not_allowed" }, 403);
  }
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeadersBase,
        ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
      },
    });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "server_not_configured" }, 503, origin);
  }

  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return json({ error: "authentication_required" }, 401, origin);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userResult, error: userError } = await userClient.auth.getUser();
  const user = userResult.user;
  if (userError || !user) return json({ error: "invalid_session" }, 401, origin);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: membership, error: membershipError } = await admin
    .from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle();

  if (membershipError) return json({ error: "authorization_check_failed" }, 503, origin);
  if (!membership) return json({ error: "admin_access_required" }, 403, origin);

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ error: "invalid_json_body" }, 400, origin);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json_body" }, 400, origin);
  }

  const action = cleanString(body.action, 60);
  if (action === "research_prospects") {
    const campaignId = cleanString(body.campaign_id, 64);
    const market = cleanString(body.market, 120);
    const sector = cleanString(body.sector, 120);
    const requestedLimit = Number.isInteger(body.limit) ? Number(body.limit) : 5;
    const limit = Math.min(10, Math.max(1, requestedLimit));
    if (!campaignId || (!market && !sector)) {
      return json({ error: "campaign_id_and_market_or_sector_required" }, 400, origin);
    }

    const { data: campaign, error: campaignError } = await admin
      .from("ai_campaigns").select("*").eq("id", campaignId).maybeSingle();
    if (campaignError) return json({ error: "campaign_lookup_failed" }, 503, origin);
    if (!campaign) return json({ error: "campaign_not_found" }, 404, origin);
    if (["paused", "completed", "archived"].includes(campaign.status)) {
      return json({ error: "campaign_not_available_for_research" }, 409, origin);
    }

    const { data: run, error: runError } = await admin.from("ai_agent_runs").insert({
      run_type: "prospect_research",
      status: "running",
      campaign_id: campaignId,
      started_by: user.id,
      input_summary: { market, sector, limit },
    }).select("id").single();
    if (runError || !run) return json({ error: "could_not_start_agent_run" }, 503, origin);

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      await admin.from("ai_agent_runs").update({
        status: "failed", error_code: "missing_openai_key",
        error_message: "OPENAI_API_KEY is not configured.", finished_at: new Date().toISOString(),
      }).eq("id", run.id);
      return json({ error: "ai_provider_not_configured", run_id: run.id }, 503, origin);
    }

    const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini";
    const markets = market ? [market] : (Array.isArray(campaign.target_markets) ? campaign.target_markets : []);
    const sectors = sector ? [sector] : (Array.isArray(campaign.target_sectors) ? campaign.target_sectors : []);
    const services = Array.isArray(campaign.services_offered) ? campaign.services_offered : [];
    const systemPrompt = [
      "You are the B2B research analyst for ZERO ONE, an independent creative partner offering brand strategy, identity, social content, and performance marketing.",
      "Use web search to identify real businesses that plausibly need one or more of the approved services. Prioritize official business websites and credible public business directories.",
      "Return only businesses supported by public source pages. Every candidate must include a source_url that directly supports the business identity or relevance.",
      "Never invent a business, website, email, phone number, social profile, need, or performance metric. Include contact fields only when clearly published for business contact; never guess an email or collect sensitive personal information.",
      "Avoid duplicate entries, unrelated aggregators, scraped personal profiles, and businesses with no verifiable public source. Use null for unknown fields.",
      "Fit score is an evidence-based estimate of service fit, not a claim about purchase intent. Explain the evidence briefly.",
      "Return the requested number or fewer if evidence is insufficient. Do not send messages or contact any business.",
    ].join(" ");
    let candidates: Array<Record<string, unknown>>;
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          max_output_tokens: 3000,
          tools: [{ type: "web_search" }],
          input: [
            { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
            { role: "user", content: [{ type: "input_text", text: JSON.stringify({
              task: "Find and qualify public business prospects for ZERO ONE.",
              target_markets: markets,
              target_sectors: sectors,
              approved_services: services,
              campaign_objective: campaign.objective,
              max_candidates: limit,
              required_fields: ["business_name", "website_url", "market", "sector", "source_url", "public_contact_email", "linkedin_url", "instagram_url", "whatsapp_business_phone", "source_notes", "fit_score", "fit_rationale"],
            }) }] },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "zero_one_prospect_research",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  candidates: {
                    type: "array",
                    maxItems: 10,
                    items: {
                      type: "object",
                      properties: {
                        business_name: { type: "string" },
                        website_url: { type: ["string", "null"] },
                        market: { type: ["string", "null"] },
                        sector: { type: ["string", "null"] },
                        source_url: { type: "string" },
                        public_contact_email: { type: ["string", "null"] },
                        linkedin_url: { type: ["string", "null"] },
                        instagram_url: { type: ["string", "null"] },
                        whatsapp_business_phone: { type: ["string", "null"] },
                        source_notes: { type: "string" },
                        fit_score: { type: "integer", minimum: 0, maximum: 100 },
                        fit_rationale: { type: "string" },
                      },
                      required: ["business_name", "website_url", "market", "sector", "source_url", "public_contact_email", "linkedin_url", "instagram_url", "whatsapp_business_phone", "source_notes", "fit_score", "fit_rationale"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["candidates"],
                additionalProperties: false,
              },
            },
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(`openai_http_${response.status}`);
      const outputText = typeof payload.output_text === "string"
        ? payload.output_text
        : (payload.output ?? []).flatMap((item: { content?: Array<{ text?: string }> }) => item.content ?? [])
          .map((item: { text?: string }) => item.text ?? "").join("");
      const parsed = JSON.parse(outputText);
      candidates = Array.isArray(parsed.candidates) ? parsed.candidates.slice(0, limit) : [];
    } catch (error) {
      const errorCode = error instanceof Error ? error.message.slice(0, 100) : "research_failed";
      await admin.from("ai_agent_runs").update({
        status: "failed", error_code: "prospect_research_failed",
        error_message: errorCode, finished_at: new Date().toISOString(),
      }).eq("id", run.id);
      return json({ error: "prospect_research_failed", run_id: run.id }, 502, origin);
    }

    const toPublicUrl = (value: unknown): string | null => {
      const raw = cleanString(value, 500);
      if (!raw) return null;
      try {
        const parsed = new URL(raw);
        return ["https:", "http:"].includes(parsed.protocol) ? parsed.toString().slice(0, 500) : null;
      } catch {
        return null;
      }
    };
    let added = 0;
    let linked = 0;
    let skipped = 0;
    const saved: Array<{ id: string; business_name: string; website_url: string | null; source_url: string }> = [];

    for (const candidate of candidates) {
      const businessName = cleanString(candidate.business_name, 200);
      const sourceUrl = toPublicUrl(candidate.source_url);
      const websiteUrl = toPublicUrl(candidate.website_url);
      if (!businessName || !sourceUrl || !Number.isInteger(candidate.fit_score) ||
          Number(candidate.fit_score) < 0 || Number(candidate.fit_score) > 100) {
        skipped++;
        continue;
      }

      let existing: { id: string; business_name: string; website_url: string | null } | null = null;
      let lookupError: unknown = null;
      if (websiteUrl) {
        const result = await admin.from("ai_prospects").select("id,business_name,website_url")
          .eq("website_url", websiteUrl).maybeSingle();
        existing = result.data;
        lookupError = result.error;
      } else {
        const result = await admin.from("ai_prospects").select("id,business_name,website_url")
          .ilike("business_name", businessName).eq("market", cleanString(candidate.market, 120) || market || "")
          .limit(1).maybeSingle();
        existing = result.data;
        lookupError = result.error;
      }
      if (lookupError) { skipped++; continue; }

      let prospectId = existing?.id;
      if (!existing) {
        const { data: inserted, error: insertError } = await admin.from("ai_prospects").insert({
          business_name: businessName,
          website_url: websiteUrl,
          market: cleanString(candidate.market, 120) || market || (markets[0] ?? null),
          sector: cleanString(candidate.sector, 120) || sector || (sectors[0] ?? null),
          public_contact_email: cleanString(candidate.public_contact_email, 254).toLowerCase() || null,
          linkedin_url: toPublicUrl(candidate.linkedin_url),
          instagram_url: toPublicUrl(candidate.instagram_url),
          whatsapp_business_phone: cleanString(candidate.whatsapp_business_phone, 80) || null,
          source_url: sourceUrl,
          source_notes: cleanString(candidate.source_notes, 1200) || null,
          fit_score: Number(candidate.fit_score),
          fit_rationale: cleanString(candidate.fit_rationale, 1000) || null,
          status: "qualified",
          last_verified_at: new Date().toISOString(),
          created_by: user.id,
        }).select("id,business_name,website_url").single();
        if (insertError || !inserted) {
          if (insertError?.code === "23505" && websiteUrl) {
            const raced = await admin.from("ai_prospects").select("id,business_name,website_url")
              .eq("website_url", websiteUrl).maybeSingle();
            prospectId = raced.data?.id;
          } else {
            skipped++;
            continue;
          }
        } else {
          prospectId = inserted.id;
          added++;
        }
      }

      if (!prospectId) { skipped++; continue; }
      const { error: linkError } = await admin.from("ai_campaign_prospects").upsert({
        campaign_id: campaignId, prospect_id: prospectId, stage: "qualified",
        qualification_notes: cleanString(candidate.fit_rationale, 1000) || null,
      }, { onConflict: "campaign_id,prospect_id" });
      if (linkError) { skipped++; continue; }
      linked++;
      saved.push({
        id: prospectId,
        business_name: existing?.business_name || businessName,
        website_url: existing?.website_url || websiteUrl,
        source_url: sourceUrl,
      });
    }

    await Promise.all([
      admin.from("ai_agent_runs").update({
        status: "succeeded",
        output_summary: { found: candidates.length, added, linked, skipped, campaign_id: campaignId },
        finished_at: new Date().toISOString(),
      }).eq("id", run.id),
      admin.from("ai_audit_events").insert({
        actor_user_id: user.id,
        event_type: "prospect_research_completed",
        entity_type: "ai_campaigns",
        entity_id: campaignId,
        details: { found: candidates.length, added, linked, skipped, market, sector, no_outreach_sent: true },
      }),
    ]);

    return json({
      summary: { found: candidates.length, added, linked, skipped },
      prospects: saved,
      mode: "research_only",
      messages_sent: 0,
      run_id: run.id,
    }, 201, origin);
  }

  if (action === "health") {
    const { error: dbError } = await admin.from("ai_campaigns").select("id").limit(1);
    if (dbError) return json({ status: "degraded", database: "unavailable" }, 503, origin);
    return json({
      status: "ok",
      mode: "draft_only",
      outbound_sending_enabled: false,
      checked_at: new Date().toISOString(),
    }, 200, origin);
  }

  if (action !== "draft_outreach") {
    return json({ error: "unsupported_action", supported_actions: ["health", "draft_outreach"] }, 400, origin);
  }

  const campaignId = cleanString(body.campaign_id, 64);
  const prospectId = cleanString(body.prospect_id, 64);
  const channel = cleanString(body.channel, 30);
  const stepNumber = Number.isInteger(body.step_number) ? Number(body.step_number) : 1;

  if (!campaignId || !prospectId || !["email", "instagram", "linkedin", "whatsapp"].includes(channel)) {
    return json({ error: "campaign_id_prospect_id_and_valid_channel_required" }, 400, origin);
  }
  if (stepNumber < 1 || stepNumber > 10) return json({ error: "invalid_step_number" }, 400, origin);

  const [{ data: campaign, error: campaignError }, { data: prospect, error: prospectError }] = await Promise.all([
    admin.from("ai_campaigns").select("*").eq("id", campaignId).maybeSingle(),
    admin.from("ai_prospects").select("*").eq("id", prospectId).maybeSingle(),
  ]);
  if (campaignError || prospectError) return json({ error: "record_lookup_failed" }, 503, origin);
  if (!campaign || !prospect) return json({ error: "campaign_or_prospect_not_found" }, 404, origin);
  if (["paused", "completed", "archived"].includes(campaign.status)) {
    return json({ error: "campaign_not_available_for_drafting" }, 409, origin);
  }
  if (!Array.isArray(campaign.channels) || !campaign.channels.includes(channel)) {
    return json({ error: "channel_not_enabled_for_campaign" }, 409, origin);
  }
  if (prospect.do_not_contact || prospect.status === "suppressed") {
    return json({ error: "prospect_suppressed" }, 409, origin);
  }

  const contactByChannel: Record<string, string> = {
    email: cleanString(prospect.public_contact_email, 254),
    linkedin: cleanString(prospect.linkedin_url, 500),
    instagram: cleanString(prospect.instagram_url, 500),
    whatsapp: cleanString(prospect.whatsapp_business_phone, 80),
  };
  const recipientKey = normalizeAddress(contactByChannel[channel] ?? "");
  if (!recipientKey) return json({ error: "no_public_contact_for_channel" }, 409, origin);

  const { data: suppressions, error: suppressionError } = await admin
    .from("ai_suppressions")
    .select("id,channel")
    .eq("normalized_address", recipientKey)
    .in("channel", [channel, "all"])
    .limit(1);
  if (suppressionError) return json({ error: "suppression_check_failed" }, 503, origin);
  if (suppressions?.length) return json({ error: "recipient_suppressed" }, 409, origin);

  const { data: link, error: linkError } = await admin
    .from("ai_campaign_prospects")
    .select("campaign_id,prospect_id")
    .eq("campaign_id", campaignId).eq("prospect_id", prospectId).maybeSingle();
  if (linkError) return json({ error: "campaign_membership_check_failed" }, 503, origin);
  if (!link) return json({ error: "prospect_not_assigned_to_campaign" }, 409, origin);

  const idempotencyKey = [campaignId, prospectId, channel, stepNumber].join(":");
  const { data: existingDraft, error: existingError } = await admin
    .from("ai_outreach_drafts").select("id,status,subject,body")
    .eq("idempotency_key", idempotencyKey).maybeSingle();
  if (existingError) return json({ error: "draft_lookup_failed" }, 503, origin);
  if (existingDraft) return json({ draft: existingDraft, reused: true, mode: "draft_only" }, 200, origin);

  const { data: run, error: runError } = await admin.from("ai_agent_runs").insert({
    run_type: "draft_generation",
    status: "running",
    campaign_id: campaignId,
    prospect_id: prospectId,
    started_by: user.id,
    input_summary: { channel, step_number: stepNumber },
  }).select("id").single();
  if (runError || !run) return json({ error: "could_not_start_agent_run" }, 503, origin);

  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiKey) {
    await admin.from("ai_agent_runs").update({
      status: "failed", error_code: "missing_openai_key",
      error_message: "OPENAI_API_KEY is not configured.", finished_at: new Date().toISOString(),
    }).eq("id", run.id);
    return json({ error: "ai_provider_not_configured", run_id: run.id }, 503, origin);
  }

  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini";
  const language = Array.isArray(campaign.languages) && campaign.languages.length
    ? String(campaign.languages[0]) : "en";
  const contactName = cleanString(prospect.public_contact_name, 120);
  const context = {
    business_name: cleanString(prospect.business_name, 200),
    website_url: cleanString(prospect.website_url, 500),
    market: cleanString(prospect.market, 100),
    sector: cleanString(prospect.sector, 120),
    source_url: cleanString(prospect.source_url, 500),
    source_notes: cleanString(prospect.source_notes, 1200),
    contact_name: contactName,
    fit_rationale: cleanString(prospect.fit_rationale, 1000),
  };
  const serviceList = Array.isArray(campaign.services_offered)
    ? campaign.services_offered.map((x: unknown) => cleanString(x, 100)).filter(Boolean)
    : [];
  const objective = cleanString(campaign.objective, 300);
  const systemPrompt = [
    "You are the careful outbound copywriter for ZERO ONE, an independent creative partner offering brand strategy, identity, social content, and performance marketing.",
    "Write one truthful, concise first-contact draft. Use only supplied facts; do not invent research, results, familiarity, client names, or claims.",
    "Never imply a prior relationship. Avoid pressure, deceptive urgency, unsupported promises, or sensitive personal inferences.",
    "Make the business relevance specific using the supplied public business context. If context is thin, be transparent and keep the message general.",
    "Do not send messages, claim to have sent messages, or include fabricated links.",
    "For email, return a useful subject. For other channels, subject must be null. Include a short, respectful opt-out line when appropriate for the channel and context.",
    "Return the required JSON object only.",
  ].join(" ");
  const userPrompt = JSON.stringify({
    task: "Draft outreach only; no message will be sent by this endpoint.",
    channel,
    language,
    campaign_objective: objective,
    approved_services: serviceList,
    business_context: context,
    requested_output: {
      subject: channel === "email" ? "short relevant subject" : null,
      body: "concise channel-appropriate message",
      rationale: "one sentence explaining the specific business relevance",
    },
    limits: {
      email_body_characters: 1400,
      social_or_messaging_body_characters: 700,
      no_unverified_claims: true,
      no_send_action: true,
    },
  });

  let generated: { subject: string | null; body: string; rationale: string };
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_output_tokens: 550,
        input: [
          { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
          { role: "user", content: [{ type: "input_text", text: userPrompt }] },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "zero_one_outreach_draft",
            strict: true,
            schema: {
              type: "object",
              properties: {
                subject: { type: ["string", "null"] },
                body: { type: "string" },
                rationale: { type: "string" },
              },
              required: ["subject", "body", "rationale"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(`openai_http_${response.status}`);
    const outputText = typeof payload.output_text === "string"
      ? payload.output_text
      : (payload.output ?? []).flatMap((item: { content?: Array<{ text?: string }> }) => item.content ?? [])
        .map((item: { text?: string }) => item.text ?? "").join("");
    generated = JSON.parse(outputText);
    if (typeof generated.body !== "string" || !generated.body.trim() ||
        typeof generated.rationale !== "string" ||
        !(generated.subject === null || typeof generated.subject === "string")) {
      throw new Error("invalid_model_output");
    }
    generated.body = generated.body.slice(0, channel === "email" ? 1400 : 700);
    if (channel !== "email") generated.subject = null;
  } catch (error) {
    const errorCode = error instanceof Error ? error.message.slice(0, 100) : "generation_failed";
    await admin.from("ai_agent_runs").update({
      status: "failed", error_code: "draft_generation_failed",
      error_message: errorCode, finished_at: new Date().toISOString(),
    }).eq("id", run.id);
    return json({ error: "draft_generation_failed", run_id: run.id }, 502, origin);
  }

  const { data: draft, error: draftError } = await admin.from("ai_outreach_drafts").insert({
    campaign_id: campaignId,
    prospect_id: prospectId,
    channel,
    step_number: stepNumber,
    subject: generated.subject,
    body: generated.body,
    status: campaign.approval_required ? "pending_approval" : "draft",
    model,
    idempotency_key: idempotencyKey,
  }).select("id,campaign_id,prospect_id,channel,step_number,subject,body,status,generated_at").single();

  if (draftError || !draft) {
    await admin.from("ai_agent_runs").update({
      status: "failed", error_code: "draft_persist_failed",
      error_message: "Draft could not be saved.", finished_at: new Date().toISOString(),
    }).eq("id", run.id);
    if (draftError?.code === "23505") {
      const { data: racedDraft } = await admin.from("ai_outreach_drafts")
        .select("id,status,subject,body").eq("idempotency_key", idempotencyKey).maybeSingle();
      if (racedDraft) return json({ draft: racedDraft, reused: true, mode: "draft_only" }, 200, origin);
    }
    return json({ error: "draft_persist_failed", run_id: run.id }, 503, origin);
  }

  await Promise.all([
    admin.from("ai_agent_runs").update({
      status: "succeeded",
      output_summary: { draft_id: draft.id, channel, status: draft.status },
      finished_at: new Date().toISOString(),
    }).eq("id", run.id),
    admin.from("ai_audit_events").insert({
      actor_user_id: user.id,
      event_type: "outreach_draft_created",
      entity_type: "ai_outreach_drafts",
      entity_id: draft.id,
      details: { campaign_id: campaignId, prospect_id: prospectId, channel, step_number: stepNumber, sent: false },
    }),
  ]);

  return json({ draft, rationale: generated.rationale, mode: "draft_only", sent: false, run_id: run.id }, 201, origin);
});
