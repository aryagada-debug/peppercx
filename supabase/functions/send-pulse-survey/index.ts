// Sends Pepper Pulse NPS/CSAT survey invitations via the central Gmail mailbox.
// Authenticated callers pick recipients; each call creates one survey_invites
// row per recipient and emails them a unique tokenised link.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") || "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET") || "";
const PUBLIC_SURVEY_BASE = "https://peppercx.lovable.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
function b64urlEncode(s: string) {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function randomToken(): string {
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => b.toString(16).padStart(2, "0")).join("");
}

function surveyLinkFor(_req: Request, token: string): string {
  // Single source of truth: the published app. Do not read request Origin or
  // environment overrides, because stale preview hosts cause Access denied.
  return `${PUBLIC_SURVEY_BASE}/survey/${token}`;
}

function publicErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error || "unknown_error");
  if (msg === "central_mailbox_not_connected") return "central_mailbox_not_connected";
  if (msg === "gmail_oauth_not_configured") return "gmail_oauth_not_configured";
  if (msg === "central_mailbox_missing_email") return "central_mailbox_missing_email";
  return msg.slice(0, 300);
}

function getCreds() {
  const idRaw = GOOGLE_CLIENT_ID.trim();
  const clientId = idRaw.match(/\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com/i)?.[0] || idRaw;
  const clientSecret = GOOGLE_CLIENT_SECRET.trim();
  if (!clientId || !clientSecret) throw new Error("gmail_oauth_not_configured");
  return { clientId, clientSecret };
}

async function getCallerUser(req: Request, admin: SupabaseClient) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) throw new Error("unauthorized");
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("unauthorized");
  return data.user;
}

async function getCentralToken(admin: SupabaseClient) {
  const { data: conn, error } = await admin
    .from("gmail_connections")
    .select("user_id, access_token, refresh_token, expires_at, google_email")
    .eq("is_central", true)
    .maybeSingle();
  if (error) throw error;
  if (!conn) throw new Error("central_mailbox_not_connected");
  const expiresAt = new Date(conn.expires_at).getTime();
  if (expiresAt - Date.now() > 30_000) {
    return { token: conn.access_token as string, email: conn.google_email as string | null };
  }
  const { clientId, clientSecret } = getCreds();
  const params = new URLSearchParams({
    client_id: clientId, client_secret: clientSecret,
    grant_type: "refresh_token", refresh_token: conn.refresh_token as string,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_description || data?.error || "token_refresh_failed");
  const newExpires = new Date(Date.now() + Math.max(60, data.expires_in - 60) * 1000).toISOString();
  await admin.from("gmail_connections")
    .update({ access_token: data.access_token, expires_at: newExpires })
    .eq("user_id", conn.user_id);
  return { token: data.access_token as string, email: conn.google_email as string | null };
}

function buildRaw({ to, cc, subject, html, from }: {
  to: string[]; cc?: string[]; subject: string; html: string; from: string;
}) {
  const lines = [
    `From: Pepper CX <${from}>`,
    `To: ${to.join(", ")}`,
    ...(cc && cc.length ? [`Cc: ${cc.join(", ")}`] : []),
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ];
  return b64urlEncode(lines.join("\r\n"));
}

const BRAND_PRIMARY = "#5b3df5";
const BRAND_HEADER_BG = "#1a0b4d";
const BRAND_HEADER_ACCENT = "#a89cff";
const BRAND_BG = "#f4f2f7";
const BRAND_BORDER = "#e7e4ef";
const BRAND_TEXT = "#15131f";
const BRAND_MUTED = "#6b6878";

export const DEFAULT_TEMPLATE = {
  subject: "Thank you for trusting Pepper",
  greeting: "Thank you for trusting Pepper.",
  body: "We believe every customer deserves an exceptional experience. Your feedback is one of the most valuable ways we learn how we're doing and where we can do even better.\n\nOur leadership team reads every response, ensuring your voice helps shape the future of our products, services, and customer experience.",
  cta_label: "Share your feedback →",
  footer_note: "Thank you for helping us improve.",
};

export function renderTemplate(str: string, vars: Record<string, string>): string {
  return String(str || "").replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

function paragraphsHtml(body: string): string {
  return String(body || "")
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:${BRAND_TEXT};">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function emailHtml({ vars, tpl, label }: {
  vars: Record<string, string>;
  tpl: typeof DEFAULT_TEMPLATE;
  label: string;
}) {
  const headline = renderTemplate(tpl.greeting, vars);
  const bodyText = renderTemplate(tpl.body, { ...vars, link: "" });
  const ctaLabel = renderTemplate(tpl.cta_label, vars);
  const footer = renderTemplate(tpl.footer_note, vars);
  const link = vars.link || "";
  void label;
  return `<!doctype html><html><body style="margin:0;padding:0;background:${BRAND_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BRAND_BG};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(20,15,50,0.04);">
        <tr><td style="background:${BRAND_HEADER_BG};padding:22px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td align="left" style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.01em;">
                <span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:#ffffff;color:${BRAND_HEADER_BG};text-align:center;line-height:22px;font-size:14px;font-weight:800;margin-right:8px;vertical-align:middle;">P</span>
                <span style="vertical-align:middle;">pepper</span>
              </td>
              <td align="right" style="color:${BRAND_HEADER_ACCENT};font-size:12px;font-weight:700;letter-spacing:0.14em;">PEPPER PULSE</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:32px 36px 8px;">
          <h1 style="margin:0 0 18px;font-size:24px;font-weight:700;color:${BRAND_TEXT};line-height:1.3;">${escapeHtml(headline)}</h1>
          ${paragraphsHtml(bodyText)}
          <div style="margin:26px 0 22px;">
            <a href="${escapeHtml(link)}" style="display:inline-block;background:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 26px;border-radius:10px;">${escapeHtml(ctaLabel)}</a>
          </div>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${BRAND_TEXT};">
            Thank you for taking a few moments to share your feedback. We truly appreciate your time and trust.
          </p>
        </td></tr>
        <tr><td style="padding:0 36px;">
          <hr style="border:none;border-top:1px solid ${BRAND_BORDER};margin:0;"/>
        </td></tr>
        <tr><td style="padding:18px 36px 28px;">
          <p style="margin:0 0 14px;font-size:13px;color:${BRAND_MUTED};line-height:1.5;">${escapeHtml(footer)}</p>
          <p style="margin:0;font-size:12.5px;color:${BRAND_MUTED};line-height:1.5;">
            If the button doesn't work, copy this link into your browser:<br>
            <span style="color:${BRAND_PRIMARY};word-break:break-all;">${escapeHtml(link)}</span>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

async function lookupEmailsByNames(admin: SupabaseClient, names: string[]) {
  const clean = Array.from(new Set(
    names.flatMap(n => (n || "").split(/[,/]/)).map(n => n.trim()).filter(n => n.length > 1)
  ));
  if (clean.length === 0) return [];
  const { data } = await admin
    .from("staffing_people")
    .select("name, email")
    .in("name", clean);
  return ((data || []) as Array<{ name: string; email: string | null }>)
    .map(r => (r.email || "").trim())
    .filter(e => /@/.test(e));
}

type Recipient = {
  email: string;
  name?: string;
  stakeholderId?: string | null;
};
type SendBody = {
  dealId: string;
  recipients: Recipient[];
  ccEmails?: string[];
  autoCcLeadership?: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const user = await getCallerUser(req, admin);
    const body = (await req.json().catch(() => ({}))) as SendBody;
    if (!body.dealId) return json({ error: "missing_deal" }, 400);
    const recipients = (body.recipients || []).filter(r => r.email && /@/.test(r.email));
    if (recipients.length === 0) return json({ error: "no_recipients" }, 400);

    // Visibility check.
    const { data: vis } = await admin.rpc("visible_deal_ids_for_user", { _user_id: user.id });
    const ids = new Set(((vis || []) as Array<{ deal_id: string }>).map(r => r.deal_id));
    if (!ids.has(body.dealId)) return json({ error: "forbidden" }, 403);

    const { data: deal, error: dErr } = await admin
      .from("staffing_deals")
      .select("id, account, deal_name, vsd, principal_bopm, senior_bopm, bopm")
      .eq("id", body.dealId)
      .maybeSingle();
    if (dErr) throw dErr;
    if (!deal) return json({ error: "deal_not_found" }, 404);

    let ccEmails: string[] = (body.ccEmails || []).filter(e => /@/.test(e));
    if (body.autoCcLeadership !== false) {
      const leadershipNames = [deal.vsd, deal.principal_bopm, deal.senior_bopm].filter(Boolean) as string[];
      const auto = await lookupEmailsByNames(admin, leadershipNames);
      ccEmails = Array.from(new Set([...ccEmails, ...auto]));
    }
    ccEmails = Array.from(new Set(ccEmails.map(e => e.toLowerCase())));

    // Load editable template (singleton); fall back to defaults.
    const { data: tplRow } = await admin
      .from("pulse_email_templates")
      .select("subject, greeting, body, cta_label, footer_note")
      .eq("id", "default")
      .maybeSingle();
    const tpl = {
      subject: tplRow?.subject || DEFAULT_TEMPLATE.subject,
      greeting: tplRow?.greeting || DEFAULT_TEMPLATE.greeting,
      body: tplRow?.body || DEFAULT_TEMPLATE.body,
      cta_label: tplRow?.cta_label || DEFAULT_TEMPLATE.cta_label,
      footer_note: tplRow?.footer_note || DEFAULT_TEMPLATE.footer_note,
    };

    const results: Array<Record<string, unknown>> = [];
    const prepared: Array<{
      email: string;
      inviteId: string;
      token: string;
      link: string;
      html: string;
      subject: string;
    }> = [];

    for (const rcp of recipients) {
      const inviteToken = randomToken();
      const link = surveyLinkFor(req, inviteToken);
      const inviteRow = {
        token: inviteToken,
        deal_id: deal.id,
        stakeholder_id: rcp.stakeholderId || null,
        recipient_name: rcp.name || "",
        recipient_email: rcp.email,
        cc_emails: ccEmails,
        account_snapshot: deal.account || "",
        deal_name_snapshot: deal.deal_name || "",
        vsd_name: deal.vsd || "",
        principal_bopm: deal.principal_bopm || "",
        senior_bopm: deal.senior_bopm || "",
        bopm: deal.bopm || "",
        sent_by: user.id,
        email_status: "pending" as const,
      };
      const { data: inserted, error: insErr } = await admin
        .from("survey_invites").insert(inviteRow).select("id").single();
      if (insErr) { results.push({ email: rcp.email, ok: false, error: insErr.message }); continue; }

      const firstName = (rcp.name || "").trim().split(/\s+/)[0] || "there";
      const vars: Record<string, string> = {
        recipient_name: rcp.name || "",
        first_name: firstName,
        account: deal.account || "",
        deal_name: deal.deal_name || "",
        vsd: deal.vsd || "",
        sender_name: "Pepper CX",
        link,
      };
      const label = [deal.account, deal.deal_name].filter(Boolean).join(" - ") || deal.id;
      const html = emailHtml({ vars, tpl, label });
      const subject = renderTemplate(tpl.subject, vars) || `How are we doing on ${label}?`;
      prepared.push({ email: rcp.email, inviteId: inserted.id, token: inviteToken, link, html, subject });
    }

    if (prepared.length === 0) {
      return json({ ok: false, error: "invite_creation_failed", results }, 500);
    }

    let token: string;
    let fromEmail: string | null;
    try {
      const c = await getCentralToken(admin);
      token = c.token;
      fromEmail = c.email;
      if (!fromEmail) throw new Error("central_mailbox_missing_email");
    } catch (e) {
      const msg = publicErrorMessage(e);
      await admin.from("survey_invites").update({
        email_status: "failed",
        error: msg,
        updated_at: new Date().toISOString(),
      }).in("id", prepared.map(p => p.inviteId));
      prepared.forEach(p => results.push({ email: p.email, ok: false, inviteId: p.inviteId, link: p.link, error: msg }));
      return json({ ok: false, error: msg, ccEmails, results });
    }

    for (const item of prepared) {
      const raw = buildRaw({ to: [item.email], cc: ccEmails, subject: item.subject, html: item.html, from: fromEmail });

      const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      });
      const sendData = await sendRes.json();
      const ok = sendRes.ok;

      await admin.from("survey_invites").update({
        email_status: ok ? "sent" : "failed",
        sent_at: new Date().toISOString(),
        gmail_message_id: ok ? (sendData.id as string) : null,
        error: ok ? null : (sendData?.error?.message || "gmail_send_failed"),
        updated_at: new Date().toISOString(),
      }).eq("id", item.inviteId);

      await admin.from("email_send_log").insert([{
        event: "pulse_survey",
        deal_id: deal.id,
        recipient_email: item.email,
        subject: item.subject,
        status: ok ? "sent" : "failed",
        gmail_message_id: ok ? (sendData.id as string) : null,
        error: ok ? null : (sendData?.error?.message || "gmail_send_failed"),
        triggered_by: user.id,
        payload: { cc: ccEmails, token: item.token, link: item.link },
      }]);

      results.push({ email: item.email, ok, inviteId: item.inviteId, link: item.link, error: ok ? null : sendData?.error?.message });
    }

    return json({ ok: true, ccEmails, results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg === "unauthorized" ? 401 : 500;
    return json({ error: msg }, status);
  }
});