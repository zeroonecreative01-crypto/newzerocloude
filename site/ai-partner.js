(() => {
  "use strict";
  const SUPABASE_URL = "https://kwmzyzwhugrxglqpsmwq.supabase.co";
  // Publishable key only; never put a service-role key in browser code.
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_6A_-HbC-jB5JTWjbY4wbQQ_9iOKJXLl";
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const ui = {
    notice: $("#notice"), auth: $("#auth-panel"), workspace: $("#workspace"),
    login: $("#login-form"), loginEmail: $("#login-email"), loginPassword: $("#login-password"), magicLink: $("#send-magic-link"), signOut: $("#sign-out"),
    userLabel: $("#user-label"), campaignForm: $("#campaign-form"),
    prospectForm: $("#prospect-form"), researchForm: $("#research-form"), researchCampaign: $("#research-campaign"), researchResult: $("#research-result"), draftForm: $("#draft-form"),
    campaignSelect: $("#draft-campaign"), prospectSelect: $("#draft-prospect"),
    channelSelect: $("#draft-channel"), draftResult: $("#draft-result"),
    campaignList: $("#campaign-list"), prospectList: $("#prospect-list"),
    draftList: $("#draft-list"), toast: $("#toast"),
  };
  let client = null;
  let sessionUser = null;
  let campaigns = [];
  let prospects = [];
  let drafts = [];
  let refreshInProgress = false;

  function setNotice(message, type = "info") {
    ui.notice.textContent = message;
    ui.notice.dataset.type = type;
    ui.notice.hidden = false;
  }
  function toast(message, type = "success") {
    ui.toast.textContent = message;
    ui.toast.dataset.type = type;
    ui.toast.hidden = false;
    window.setTimeout(() => { ui.toast.hidden = true; }, 4200);
  }
  function commaList(value) {
    return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
  }
  function appendText(parent, tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text == null ? "" : String(text);
    parent.append(node);
    return node;
  }
  function record(host, title, subtitle, status) {
    const row = document.createElement("div");
    row.className = "record";
    const main = document.createElement("div");
    main.className = "record-main";
    appendText(main, "div", "record-title", title);
    appendText(main, "div", "record-sub", subtitle);
    row.append(main);
    if (status) appendText(row, "span", "pill", status.replaceAll("_", " "));
    host.append(row);
  }
  function empty(host, message) {
    appendText(host, "p", "empty", message);
  }
  function setCount(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value);
  }
  function fillSelect(select, items, placeholder, labelFn) {
    const prior = select.value;
    select.replaceChildren();
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = placeholder;
    select.append(emptyOption);
    for (const item of items) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = labelFn(item);
      select.append(option);
    }
    if (items.some((item) => item.id === prior)) select.value = prior;
    else if (items.length === 1) select.value = items[0].id;
  }
  function ensureProspectCampaignSelect() {
    const websiteField = ui.prospectForm.querySelector('[name="website_url"]')?.closest(".field");
    if (!websiteField || $("#prospect-campaign")) return;
    const label = document.createElement("label");
    label.className = "field";
    const caption = document.createElement("span");
    caption.textContent = "Add to campaign";
    const select = document.createElement("select");
    select.id = "prospect-campaign";
    select.name = "campaign_id";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Save without campaign";
    select.append(opt);
    label.append(caption, select);
    websiteField.before(label);
  }
  function syncSelectors() {
    fillSelect(ui.campaignSelect, campaigns, "Choose a campaign", (item) => item.name);
    fillSelect(ui.researchCampaign, campaigns, "Choose a campaign", (item) => item.name);
    fillSelect(ui.prospectSelect, prospects, "Choose a prospect", (item) => item.company || item.name);
    const assignSelect = $("#prospect-campaign");
    if (assignSelect) fillSelect(assignSelect, campaigns, "Save without campaign", (item) => item.name);
    updateChannelOptions();
  }
  function updateChannelOptions() {
    const campaign = campaigns.find((item) => item.id === ui.campaignSelect.value);
    const current = ui.channelSelect.value;
    const allowed = campaign && Array.isArray(campaign.channels) ? campaign.channels : ["email", "linkedin", "instagram", "whatsapp"];
    for (const option of ui.channelSelect.options) {
      option.disabled = !allowed.includes(option.value);
    }
    if (allowed.includes(current)) ui.channelSelect.value = current;
    else if (allowed.length) ui.channelSelect.value = allowed[0];
  }
  function showWorkspace(user) {
    sessionUser = user;
    ui.auth.hidden = true;
    ui.workspace.hidden = false;
    ui.signOut.hidden = false;
    ui.userLabel.textContent = user.email || user.id;
    ensureProspectCampaignSelect();
  }
  function hideWorkspace() {
    sessionUser = null;
    ui.auth.hidden = false;
    ui.workspace.hidden = true;
    ui.signOut.hidden = true;
  }
  async function handleSession(session) {
    if (!session?.user) {
      hideWorkspace();
      setNotice("Sign in with your approved ZERO ONE admin account to access the workspace.");
      return;
    }
    const { data: profile, error } = await client.from("profiles")
      .select("id,role,is_active").eq("id", session.user.id).maybeSingle();
    if (error) {
      hideWorkspace();
      setNotice("The workspace schema is not ready or access could not be verified. Check the existing CRM profile and RLS setup.", "error");
      return;
    }
    if (!profile || !profile.is_active || !["admin", "editor", "sales"].includes(profile.role)) {
      await client.auth.signOut();
      hideWorkspace();
      setNotice("This account is authenticated but does not have an active ZERO ONE staff profile. Ask the workspace owner to provision access.", "error");
      return;
    }
    showWorkspace(session.user);
    setNotice("Authenticated. Draft-only mode is active; this workspace cannot send messages.", "success");
    await loadData();
    const { error: functionError } = await client.functions.invoke("ai-business-partner", { body: { action: "health" } });
    if (functionError) {
      setNotice("CRM access is available, but the AI Edge Function is not deployed or configured yet. Draft generation will remain unavailable until setup is complete.", "error");
    }
  }
  async function loadData() {
    if (!sessionUser || refreshInProgress) return;
    refreshInProgress = true;
    try {
      const [campaignRes, prospectRes, draftRes, runRes] = await Promise.all([
        client.from("ai_campaigns").select("id,name,objective,target_markets,target_sectors,services_offered,languages,channels,status,approval_required,created_at").order("created_at", { ascending: false }).limit(100),
        client.from("leads").select("id,name,company,email,whatsapp,market,status,created_at,ai_lead_research(website_url,sector,fit_score,source_url,fit_rationale,do_not_contact)").order("created_at", { ascending: false }).limit(200),
        client.from("ai_outreach_drafts").select("id,campaign_id,lead_id,channel,subject,body,status,generated_at").order("generated_at", { ascending: false }).limit(50),
        client.from("ai_agent_runs").select("id,run_type,status,started_at").order("started_at", { ascending: false }).limit(100),
      ]);
      for (const result of [campaignRes, prospectRes, draftRes, runRes]) {
        if (result.error) throw result.error;
      }
      campaigns = campaignRes.data || [];
      prospects = prospectRes.data || [];
      drafts = draftRes.data || [];
      setCount("count-campaigns", campaigns.length);
      setCount("count-prospects", prospects.length);
      setCount("count-drafts", drafts.length);
      setCount("count-runs", runRes.data?.length || 0);
      syncSelectors();
      ui.campaignList.replaceChildren();
      ui.prospectList.replaceChildren();
      ui.draftList.replaceChildren();
      if (!campaigns.length) empty(ui.campaignList, "No campaigns yet. Create a campaign brief above.");
      campaigns.slice(0, 8).forEach((item) => record(ui.campaignList, item.name, (item.target_markets || []).join(", ") || "No markets set", item.status));
      if (!prospects.length) empty(ui.prospectList, "No prospects yet. Add a business with a source URL.");
      prospects.slice(0, 8).forEach((item) => {
        const meta = Array.isArray(item.ai_lead_research) ? item.ai_lead_research[0] : item.ai_lead_research;
        record(ui.prospectList, item.company || item.name, [item.market, meta?.sector, meta?.fit_score == null ? "" : "Fit " + meta.fit_score].filter(Boolean).join(" · "), item.status);
      });
      if (!drafts.length) empty(ui.draftList, "No drafts yet. Generate the first one after saving a campaign and prospect.");
      drafts.slice(0, 12).forEach((item) => {
        const lead = prospects.find((candidate) => candidate.id === item.lead_id);
        record(ui.draftList, item.subject || (lead?.company || lead?.name || "Outreach draft"), item.channel + " · " + new Date(item.generated_at).toLocaleString(), item.status);
      });
    } catch (error) {
      console.error("ZERO ONE workspace load failed", error);
      setNotice("Could not load CRM data. Confirm the migration is applied and the account is an approved admin.", "error");
    } finally {
      refreshInProgress = false;
    }
  }
  async function assignProspect(campaignId, prospectId) {
    if (!campaignId) return;
    const { error } = await client.from("ai_campaign_leads").upsert({
      campaign_id: campaignId, lead_id: prospectId, stage: "queued",
    }, { onConflict: "campaign_id,lead_id" });
    if (error) throw error;
  }

  ui.login.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!client) return toast("Supabase client did not load. Refresh and retry.", "error");
    const email = ui.loginEmail.value.trim();
    const password = ui.loginPassword.value;
    if (!password) return toast("Enter your account password.", "error");
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return toast(error.message || "Could not sign in. Check the email and password.", "error");
    ui.loginPassword.value = "";
  });

  ui.magicLink.addEventListener("click", async () => {
    if (!client) return toast("Supabase client did not load. Refresh and retry.", "error");
    const email = ui.loginEmail.value.trim();
    if (!email) return toast("Enter your email first.", "error");
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) return toast(error.message || "Could not send the sign-in link.", "error");
    setNotice("A secure sign-in link was requested. Check your inbox and open it on this device.", "success");
    toast("Sign-in link requested.");
  });

  ui.signOut.addEventListener("click", async () => {
    await client.auth.signOut();
    hideWorkspace();
    setNotice("Signed out.");
  });

  ui.campaignForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!sessionUser) return;
    const form = new FormData(ui.campaignForm);
    const channels = [...ui.campaignForm.querySelectorAll('input[name="channels"]:checked')].map((input) => input.value);
    if (!channels.length) return toast("Select at least one draft channel.", "error");
    const recordData = {
      name: String(form.get("name") || "").trim(),
      objective: String(form.get("objective") || "qualified_leads"),
      target_markets: commaList(form.get("target_markets")),
      target_sectors: commaList(form.get("target_sectors")),
      services_offered: commaList(form.get("services_offered")),
      languages: [String(form.get("language") || "en")],
      channels,
      approval_required: form.get("approval_required") === "on",
      daily_send_cap: 0,
      created_by: sessionUser.id,
    };
    const { error } = await client.from("ai_campaigns").insert(recordData);
    if (error) return toast(error.message || "Could not save campaign.", "error");
    ui.campaignForm.reset();
    ui.campaignForm.querySelector('[name="channels"][value="email"]').checked = true;
    ui.campaignForm.querySelector('[name="approval_required"]').checked = true;
    await loadData();
    toast("Campaign saved.");
  });

  ui.prospectForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!sessionUser) return;
    const form = new FormData(ui.prospectForm);
    const fitValue = String(form.get("fit_score") || "").trim();
    const website = String(form.get("website_url") || "").trim();
    const email = String(form.get("public_contact_email") || "").trim();
    const recordData = {
      business_name: String(form.get("business_name") || "").trim(),
      market: String(form.get("market") || "").trim() || null,
      sector: String(form.get("sector") || "").trim() || null,
      website_url: website || null,
      public_contact_email: email || null,
      source_url: String(form.get("source_url") || "").trim(),
      source_notes: String(form.get("source_notes") || "").trim() || null,
      fit_score: fitValue ? Number(fitValue) : null,
      created_by: sessionUser.id,
    };
    const { data, error } = await client.from("leads").insert({
      name: recordData.business_name,
      company: recordData.business_name,
      email: recordData.public_contact_email,
      market: recordData.market,
      message: recordData.source_notes,
      service_interest: recordData.sector,
      source: "ai_research",
      status: "qualified",
      notes: "Added to ZERO ONE CRM through the AI Business Partner workspace.",
    }).select("id").single();
    if (error) return toast(error.message || "Could not save CRM lead.", "error");
    const { error: researchError } = await client.from("ai_lead_research").insert({
      lead_id: data.id,
      website_url: recordData.website_url,
      sector: recordData.sector,
      source_url: recordData.source_url,
      source_notes: recordData.source_notes,
      fit_score: recordData.fit_score,
      created_by: sessionUser.id,
      last_verified_at: new Date().toISOString(),
    });
    if (researchError) {
      await client.from("leads").delete().eq("id", data.id);
      return toast("Could not save research metadata; the incomplete lead was rolled back.", "error");
    }
    const campaignId = String(form.get("campaign_id") || "");
    try {
      if (campaignId) await assignProspect(campaignId, data.id);
    } catch (assignError) {
      console.error("Lead saved but campaign assignment failed", assignError);
      await loadData();
      return toast("Lead saved, but campaign assignment failed. Add it to a campaign before drafting.", "error");
    }
    ui.prospectForm.reset();
    await loadData();
    toast("Prospect saved" + (campaignId ? " and added to campaign." : "."));
  });

  ui.researchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!sessionUser) return;
    const form = new FormData(ui.researchForm);
    const market = String(form.get("market") || "").trim();
    const sector = String(form.get("sector") || "").trim();
    if (!market && !sector) return toast("Enter a target market, sector, or both.", "error");
    const payload = {
      action: "research_prospects",
      campaign_id: String(form.get("campaign_id") || ""),
      market,
      sector,
      limit: Number(form.get("limit") || 5),
    };
    const button = ui.researchForm.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Researching…";
    ui.researchResult.hidden = true;
    try {
      const { data, error } = await client.functions.invoke("ai-business-partner", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      ui.researchResult.replaceChildren();
      const summary = data.summary || {};
      appendText(ui.researchResult, "h4", "", `Research complete · ${summary.added || 0} new · ${summary.linked || 0} linked · ${summary.skipped || 0} skipped`);
      for (const prospect of (data.prospects || [])) {
        const item = document.createElement("div");
        item.className = "research-result-item";
        appendText(item, "strong", "", prospect.business_name + " · Fit " + prospect.fit_score + "/100");
        const source = document.createElement("a");
        source.href = prospect.source_url;
        source.target = "_blank";
        source.rel = "noopener noreferrer";
        source.textContent = "Open source evidence ↗";
        item.append(source);
        if (prospect.website_url) {
          const website = document.createElement("a");
          website.href = prospect.website_url;
          website.target = "_blank";
          website.rel = "noopener noreferrer";
          website.textContent = " · Business website ↗";
          item.append(website);
        }
        if (prospect.fit_rationale) appendText(item, "p", "", prospect.fit_rationale);
        ui.researchResult.append(item);
      }
      if (!(data.prospects || []).length) appendText(ui.researchResult, "p", "empty", "No new source-verified prospects were saved. Try a narrower market or sector.");
      ui.researchResult.hidden = false;
      await loadData();
      toast("Prospect research completed. No outreach was sent.");
    } catch (error) {
      console.error("Prospect research failed", error);
      toast("Research failed. Confirm the Edge Function is deployed, GEMINI_API_KEY is configured, and the migration is applied.", "error");
    } finally {
      button.disabled = false;
      button.innerHTML = 'Research prospects <span>↗</span>';
    }
  });

  ui.campaignSelect.addEventListener("change", updateChannelOptions);
  ui.draftForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!sessionUser) return;
    const form = new FormData(ui.draftForm);
    const payload = {
      action: "draft_outreach",
      campaign_id: String(form.get("campaign_id") || ""),
      prospect_id: String(form.get("prospect_id") || ""),
      channel: String(form.get("channel") || "email"),
      step_number: Number(form.get("step_number") || 1),
    };
    ui.draftResult.hidden = true;
    const button = ui.draftForm.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Generating…";
    try {
      const { data, error } = await client.functions.invoke("ai-business-partner", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      ui.draftResult.replaceChildren();
      const draft = data.draft;
      appendText(ui.draftResult, "h4", "", draft.subject || "Outreach draft");
      appendText(ui.draftResult, "p", "", draft.body);
      if (data.rationale) appendText(ui.draftResult, "p", "rationale", "WHY THIS FITS · " + data.rationale);
      appendText(ui.draftResult, "p", "fine", "DRAFT SAVED · NOT SENT · " + (draft.status || "draft").toUpperCase());
      ui.draftResult.hidden = false;
      await loadData();
      toast("Draft generated. No message was sent.");
    } catch (error) {
      console.error("Draft generation failed", error);
      toast("Draft generation failed. Confirm the function is deployed, GEMINI_API_KEY is configured, and the prospect is assigned to the campaign.", "error");
    } finally {
      button.disabled = false;
      button.innerHTML = 'Generate draft <span>↗</span>';
    }
  });

  document.querySelectorAll("[data-refresh]").forEach((button) => {
    button.addEventListener("click", () => loadData());
  });

  ensureProspectCampaignSelect();
  if (window.supabase?.createClient) {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    client.auth.getSession().then(({ data }) => handleSession(data.session));
    client.auth.onAuthStateChange((_event, session) => {
      // Do not await Supabase calls inside this callback; avoid auth lock deadlocks.
      Promise.resolve().then(() => handleSession(session));
    });
  } else {
    setNotice("Supabase client failed to load. Check the network/CDN and refresh.", "error");
  }
})();
