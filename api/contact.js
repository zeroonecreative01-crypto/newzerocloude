const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX = { name: 100, email: 254, company: 120, service: 80, message: 5000 };
const ALLOWED_SERVICES = new Set(["Strategy", "Branding", "Social media", "Performance ads", "Content production", "Website", "Other"]);
function clean(value, limit) { return String(value || "").trim().slice(0, limit); }
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ ok: false, error: "Method not allowed." }); }
  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (clean(body.website, 200)) return res.status(200).json({ ok: true });
  const name = clean(body.name, MAX.name), email = clean(body.email, MAX.email);
  const company = clean(body.company, MAX.company), service = clean(body.service, MAX.service);
  const message = clean(body.message, MAX.message);
  if (name.length < 2 || !EMAIL_RE.test(email) || message.length < 10 || !ALLOWED_SERVICES.has(service)) {
    return res.status(400).json({ ok: false, error: "Please check the required fields and try again." });
  }
  if (!process.env.RESEND_API_KEY || !process.env.CONTACT_FROM_EMAIL) {
    console.error("Contact form is not configured: RESEND_API_KEY and CONTACT_FROM_EMAIL are required.");
    return res.status(503).json({ ok: false, error: "Contact form is not configured yet." });
  }
  const text = ["New ZERO ONE website inquiry", "", "Name: " + name, "Email: " + email,
    "Company: " + (company || "Not provided"), "Service: " + service, "", "Project details:", message].join("\n");
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.CONTACT_FROM_EMAIL, to: ["zeroone.creative.01@gmail.com"],
        reply_to: email, subject: "ZERO ONE project inquiry — " + service, text })
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("Resend rejected contact email:", response.status, detail.slice(0, 500));
      return res.status(502).json({ ok: false, error: "The email service could not accept the message." });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Contact email delivery failed:", error);
    return res.status(502).json({ ok: false, error: "Unable to send the message right now." });
  }
};
