// Re-sends existing Pepper Pulse survey invites via the Resend connector gateway.
// Reuses each invite's existing token so previously issued links remain valid.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("PULSE_RESEND_FROM") || "Pepper Pulse <onboarding@resend.dev>";
const PUBLIC_SURVEY_BASE = "https://peppercx.lovable.app";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

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
function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buildGoogleFormLink(cfg: { form_url: string; form_id: string } | null): string {
  if (!cfg) return "";
  const raw = (cfg.form_url || "").trim();
  const id = (cfg.form_id || "").trim();
  if (raw) {
    let base = raw.replace(/\/edit(\?.*)?$/, "/viewform").replace(/\/formResponse(\?.*)?$/, "/viewform");
    if (!/\/viewform$/.test(base) && !base.includes("/viewform?")) base = base.replace(/\/?$/, "/viewform");
    return base;
  }
  return id ? `https://docs.google.com/forms/d/e/${id}/viewform` : "";
}

async function getCaller(req: Request, admin: SupabaseClient) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) throw new Error("unauthorized");
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("unauthorized");
  return data.user;
}

function buildHtml(opts: {
  recipientName: string; account: string; dealName: string; link: string;
}) {
  const { recipientName, account, dealName, link } = opts;
  const greeting = recipientName
    ? `Hi ${escapeHtml(recipientName.split(/\s+/)[0])},`
    : "Hi there,";
  const label = [account, dealName].filter(Boolean).map(escapeHtml).join(" — ");
  const preheader = "Two minutes of your time — we would love your feedback.";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Pepper Pulse</title></head>
<body style="margin:0;padding:0;background:#F4F0EA;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;color:#F4F0EA;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#0C0359;padding:24px 40px;color:#B7A9EE;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;font-size:12px;">Pepper Pulse</td></tr>
  <tr><td style="padding:36px 40px 8px 40px;">
    <h1 style="margin:0 0 18px 0;font-size:24px;color:#1E1633;font-weight:700;">${greeting}</h1>
    <p style="margin:0 0 14px 0;font-size:16px;line-height:1.6;color:#4A4358;">This is a friendly reminder to share your feedback on <strong>${label || "your engagement with Pepper"}</strong>.</p>
    <p style="margin:0 0 14px 0;font-size:16px;line-height:1.6;color:#4A4358;">It only takes 2 minutes and helps our leadership team understand how we are doing.</p>
  </td></tr>
  <tr><td style="padding:20px 40px 28px 40px;">
    <a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 32px;background:#5B34DA;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:16px;">Share your feedback →</a>
  </td></tr>
  <tr><td style="padding:0 40px 32px 40px;font-size:13px;color:#9089A0;line-height:1.6;">
    If the button doesn't work, copy this link into your browser:<br>
    <a href="${escapeHtml(link)}" style="color:#5B34DA;text-decoration:none;word-break:break-all;">${escapeHtml(link)}</a>
  </td></tr>
</table></td></tr></table>
</body></html>`;
}

type Body = { inviteIds?: string[] };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY) return json({ error: "lovable_api_key_missing" }, 500);
    if (!RESEND_API_KEY) return json({ error: "resend_not_connected", message: "Resend connector is not linked to this project. Ask an admin to connect Resend in workspace settings." }, 412);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const user = await getCaller(req, admin);
    const body = (await req.json().catch(() => ({}))) as Body;
    const ids = Array.from(new Set((body.inviteIds || []).filter(Boolean)));
    if (ids.length === 0) return json({ error: "no_invite_ids" }, 400);
    if (ids.length > 100) return json({ error: "too_many_invites" }, 400);

    const { data: vis } = await admin.rpc("visible_deal_ids_for_user", { _user_id: user.id });
    const visibleDeals = new Set(((vis || []) as Array<{ deal_id: string }>).map(r => r.deal_id));

    const { data: invites, error: invErr } = await admin
      .from("survey_invites")
      .select("id, token, deal_id, recipient_name, recipient_email, account_snapshot, deal_name_snapshot, cc_emails, source")
      .in("id", ids);
    if (invErr) throw invErr;

    let googleForm: { form_url: string; form_id: string } | null = null;
    if ((invites || []).some((x: any) => x.source === "google_form")) {
      const { data: cfg } = await admin
        .from("pulse_google_form_config")
        .select("form_url, form_id")
        .eq("id", "default")
        .maybeSingle();
      googleForm = { form_url: cfg?.form_url || "", form_id: cfg?.form_id || "" };
    }

    const results: Array<{ inviteId: string; ok: boolean; error?: string }> = [];
    for (const id of ids) {
      const inv = (invites || []).find((x: any) => x.id === id);
      if (!inv) { results.push({ inviteId: id, ok: false, error: "invite_not_found" }); continue; }
      if (!visibleDeals.has(inv.deal_id)) { results.push({ inviteId: id, ok: false, error: "forbidden" }); continue; }
      const email = (inv.recipient_email || "").trim();
      if (!email || !/@/.test(email)) { results.push({ inviteId: id, ok: false, error: "invalid_recipient_email" }); continue; }

      const link = inv.source === "google_form"
        ? buildGoogleFormLink(googleForm)
        : `${PUBLIC_SURVEY_BASE}/survey/${inv.token}`;
      if (!link) { results.push({ inviteId: id, ok: false, error: "google_form_not_configured" }); continue; }
      const html = buildHtml({
        recipientName: inv.recipient_name || "",
        account: inv.account_snapshot || "",
        dealName: inv.deal_name_snapshot || "",
        link,
      });
      const subject = `Reminder: share your feedback on ${[inv.account_snapshot, inv.deal_name_snapshot].filter(Boolean).join(" — ") || "your Pepper engagement"}`;

      let ok = false;
      let errMsg: string | null = null;
      let providerId: string | null = null;
      try {
        const res = await fetch(`${GATEWAY_URL}/emails`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": RESEND_API_KEY,
          },
          body: JSON.stringify({ from: RESEND_FROM, to: [email], subject, html }),
        });
        const bodyText = await res.text();
        let parsed: any = null;
        try { parsed = JSON.parse(bodyText); } catch { /* ignore */ }
        if (!res.ok) {
          errMsg = `[${res.status}] ${parsed?.message || parsed?.error?.message || bodyText || "resend_failed"}`.slice(0, 500);
        } else {
          ok = true;
          providerId = parsed?.id || null;
        }
      } catch (e) {
        errMsg = e instanceof Error ? e.message : String(e);
      }

      await admin.from("survey_invites").update({
        email_status: ok ? "sent" : "failed",
        sent_at: new Date().toISOString(),
        gmail_message_id: ok ? providerId : null,
        error: ok ? null : errMsg,
        updated_at: new Date().toISOString(),
      }).eq("id", inv.id);

      await admin.from("email_send_log").insert([{
        event: "pulse_survey_resend",
        deal_id: inv.deal_id,
        recipient_email: email,
        subject,
        status: ok ? "sent" : "failed",
        gmail_message_id: ok ? providerId : null,
        error: ok ? null : errMsg,
        triggered_by: user.id,
        payload: { provider: "resend", token: inv.token, link },
      }]).catch(() => { /* logging is best-effort */ });

      results.push({ inviteId: id, ok, error: ok ? undefined : errMsg || "resend_failed" });
    }

    const okCount = results.filter(r => r.ok).length;
    return json({ ok: okCount > 0, sent: okCount, failed: results.length - okCount, results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg === "unauthorized" ? 401 : 500;
    return json({ error: msg }, status);
  }
});