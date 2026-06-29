// Posts a Slack alert when a HIGH-risk Pulse survey response comes in.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const webhook = Deno.env.get("SLACK_WEBHOOK");
    if (!webhook) return json({ ok: false, skipped: "no_webhook" });
    const body = await req.json().catch(() => ({}));
    const p = body?.payload || {};
    const inv = body?.invite || {};
    if (p?.flags?.churn_risk !== "HIGH") return json({ ok: true, skipped: "not_high" });

    const r = p.respondent || {};
    const text = [
      `🚨 *HIGH churn risk* — ${r.name || "Anonymous"} · ${r.company || inv.account || "—"}`,
      `Deal: ${inv.deal || "—"} · Capabilities: ${(r.capabilities || []).join(", ") || "—"}`,
      `NPS *${p?.nps?.score ?? "–"}* (${p?.nps?.category || "–"}) · Renewal: *${p?.retention?.renewal_intent || "–"}* · Mood: *${p?.sentiment?.mood || "–"}*`,
      `Reasons: ${(p?.flags?.reasons || []).join(" · ") || "—"}`,
      r.email ? `Contact: ${r.email}` : null,
      r.wants_followup ? `Follow-up: ${r.wants_followup}` : null,
      p?.retention?.save_lever ? `> ${p.retention.save_lever}` : null,
    ].filter(Boolean).join("\n");

    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});