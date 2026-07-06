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
  let displayName: string | null = null;
  try {
    const { data: prof } = await admin
      .from("profiles")
      .select("display_name")
      .eq("user_id", conn.user_id)
      .maybeSingle();
    const n = (prof?.display_name || "").trim();
    if (n) displayName = n;
  } catch (_) { /* non-fatal */ }
  const expiresAt = new Date(conn.expires_at).getTime();
  if (expiresAt - Date.now() > 30_000) {
    return { token: conn.access_token as string, email: conn.google_email as string | null, displayName };
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
  return { token: data.access_token as string, email: conn.google_email as string | null, displayName };
}

function buildRaw({ to, cc, subject, html, from, fromName }: {
  to: string[]; cc?: string[]; subject: string; html: string; from: string; fromName?: string;
}) {
  const nm = (fromName || "Pepper CX").replace(/[\\"]/g, "").trim() || "Pepper CX";
  const needsQuote = /[^A-Za-z0-9 .\-_]/.test(nm);
  const fromHeader = needsQuote ? `"${nm}" <${from}>` : `${nm} <${from}>`;
  const lines = [
    `From: ${fromHeader}`,
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

const BRAND_PRIMARY = "#5B34DA";
const BRAND_HEADER_BG = "#0C0359";
const BRAND_HEADER_ACCENT = "#B7A9EE";
const BRAND_BG = "#F4F0EA";
const BRAND_BORDER = "#ECE7F5";
const BRAND_TEXT = "#1E1633";
const BRAND_BODY = "#4A4358";
const BRAND_MUTED = "#9089A0";
const PEPPER_LOGO_DATA_URL = "data:image/png;base64,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";

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
    .map((p) => `<p style="margin:0 0 16px 0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:${BRAND_BODY};">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
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
  const preheader = "Two minutes of your time \u2014 our leadership team wants to hear about your experience.";
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(headline)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .px { padding-left: 24px !important; padding-right: 24px !important; }
      .btn a { display: block !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:${BRAND_BG};">
  <div style="display:none; max-height:0; overflow:hidden; font-size:1px; line-height:1px; color:${BRAND_BG}; opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND_BG};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#FFFFFF; border-radius:16px; overflow:hidden; box-shadow:0 2px 8px rgba(60,40,90,0.06);">
        <tr>
          <td style="background-color:${BRAND_HEADER_BG}; padding:24px 40px;" class="px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td align="left" valign="middle">
                <img src="${PEPPER_LOGO_DATA_URL}" alt="Pepper" width="132" height="45" style="display:block; width:132px; height:auto; border:0; outline:none; text-decoration:none;">
              </td>
              <td align="right" valign="middle" style="font-family:'Segoe UI', Helvetica, Arial, sans-serif; font-size:12px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase; color:${BRAND_HEADER_ACCENT};">
                Pepper&nbsp;Pulse
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:44px 40px 8px 40px;" class="px">
            <h1 style="margin:0 0 18px 0; font-family:'Segoe UI', Helvetica, Arial, sans-serif; font-size:26px; line-height:1.25; font-weight:700; color:${BRAND_TEXT}; letter-spacing:-0.4px;">${escapeHtml(headline)}</h1>
            ${paragraphsHtml(bodyText)}
          </td>
        </tr>
        <tr>
          <td align="left" style="padding:28px 40px 24px 40px;" class="px">
            <table role="presentation" class="btn" cellpadding="0" cellspacing="0" border="0"><tr>
              <td align="center" style="border-radius:10px; background-color:${BRAND_PRIMARY};">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(link)}" style="height:52px;v-text-anchor:middle;width:240px;" arcsize="19%" strokecolor="${BRAND_PRIMARY}" fillcolor="${BRAND_PRIMARY}">
                  <w:anchorlock/>
                  <center style="color:#FFFFFF;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;">${escapeHtml(ctaLabel)}</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-- -->
                <a href="${escapeHtml(link)}" target="_blank" style="display:inline-block; padding:15px 38px; font-family:'Segoe UI', Helvetica, Arial, sans-serif; font-size:16px; font-weight:700; color:#FFFFFF; text-decoration:none; border-radius:10px; background-color:${BRAND_PRIMARY};">${escapeHtml(ctaLabel)}</a>
                <!--<![endif]-->
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 40px 40px;" class="px">
            <p style="margin:0; font-family:'Segoe UI', Helvetica, Arial, sans-serif; font-size:16px; line-height:1.6; color:${BRAND_BODY};">
              Thank you for taking a few moments to share your feedback. We truly appreciate your time and trust.
            </p>
          </td>
        </tr>
        <tr><td style="padding:0 40px;" class="px"><div style="border-top:1px solid ${BRAND_BORDER}; font-size:0; line-height:0;">&nbsp;</div></td></tr>
        <tr>
          <td style="padding:24px 40px 36px 40px;" class="px">
            <p style="margin:0; font-family:'Segoe UI', Helvetica, Arial, sans-serif; font-size:13px; line-height:1.6; color:${BRAND_MUTED};">${escapeHtml(footer)}</p>
            <div style="border-top:1px solid #EFEAF3; font-size:0; line-height:0; margin:16px 0 0 0;">&nbsp;</div>
            <p style="margin:16px 0 0 0; font-family:'Segoe UI', Helvetica, Arial, sans-serif; font-size:13px; line-height:1.6; color:${BRAND_MUTED};">
              If the button doesn't work, copy this link into your browser:<br>
              <a href="${escapeHtml(link)}" style="color:${BRAND_PRIMARY}; text-decoration:none; word-break:break-all;">${escapeHtml(link)}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
  excludeCcNames?: string[];
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
      const excluded = new Set(
        (body.excludeCcNames || []).map(n => (n || "").trim().toLowerCase()).filter(Boolean)
      );
      const leadershipNames = [deal.vsd, deal.principal_bopm, deal.senior_bopm]
        .filter(Boolean)
        .flatMap((n) => (n as string).split(/[,/]/).map(x => x.trim()).filter(Boolean))
        .filter(n => !excluded.has(n.toLowerCase()));
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