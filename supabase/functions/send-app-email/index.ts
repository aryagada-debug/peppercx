// Send app notification emails via a single central Gmail mailbox.
// The central account is whichever gmail_connections row has is_central=true
// (set via the Settings → Notifications page after that user connects Gmail).
//
// Supported events: staffed, staffing_changed, staffing_removed,
//   mbr_bopm_digest, rgy_bopm_digest, nps_bopm_digest,
//   deal_created, deal_unstaffed, handover_received, test
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") || "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET") || "";
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") || "https://peppercx.lovable.app";

// Never send staffing/allocation emails to these addresses (any To/Cc slot).
const STAFFING_EMAIL_SUPPRESSED = new Set<string>(["anirudh@peppercontent.io"]);
const STAFFING_EVENTS = new Set<string>(["staffed", "staffing_changed", "staffing_removed"]);
function stripSuppressed(list: string[]): string[] {
  return list.filter((e) => !STAFFING_EMAIL_SUPPRESSED.has(String(e).trim().toLowerCase()));
}

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
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: conn.refresh_token as string,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    const raw = `${data?.error ?? ""} ${data?.error_description ?? ""}`.toLowerCase();
    if (raw.includes("invalid_grant") || raw.includes("expired or revoked")) {
      // Refresh token is dead — the central mailbox must be reconnected.
      throw new Error("central_mailbox_reauth_required");
    }
    throw new Error(data?.error_description || data?.error || "token_refresh_failed");
  }
  const newExpires = new Date(Date.now() + Math.max(60, data.expires_in - 60) * 1000).toISOString();
  await admin
    .from("gmail_connections")
    .update({ access_token: data.access_token, expires_at: newExpires })
    .eq("user_id", conn.user_id);
  return { token: data.access_token as string, email: conn.google_email as string | null };
}

function b64urlEncode(s: string) {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
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

// ── HTML templates ─────────────────────────────────────────────────────────
const BRAND_PRIMARY = "#6E59A5";
const BRAND_BG = "#F7F6F2";
const BRAND_BORDER = "#E5E2DA";
const BRAND_TEXT = "#1B1B1F";
const BRAND_MUTED = "#6B6770";

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function layout({ title, intro, rows, ctaLabel, ctaHref, footerNote, extraHtml }: {
  title: string; intro: string;
  rows: Array<[string, string]>;
  ctaLabel?: string; ctaHref?: string; footerNote?: string; extraHtml?: string;
}) {
  const rowsHtml = rows
    .filter(([, v]) => v && v.trim().length > 0)
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding:6px 0;color:${BRAND_MUTED};font-size:12px;width:140px;vertical-align:top;">${escapeHtml(k)}</td>
        <td style="padding:6px 0;color:${BRAND_TEXT};font-size:13px;">${escapeHtml(v)}</td>
      </tr>`,
    ).join("");
  return `<!doctype html><html><body style="margin:0;padding:0;background:${BRAND_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BRAND_BG};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:#ffffff;border:1px solid ${BRAND_BORDER};border-radius:12px;overflow:hidden;">
        <tr><td style="padding:18px 22px;border-bottom:1px solid ${BRAND_BORDER};">
          <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND_MUTED};">Pepper CX</div>
          <div style="font-size:18px;font-weight:600;color:${BRAND_TEXT};margin-top:2px;">${escapeHtml(title)}</div>
        </td></tr>
        <tr><td style="padding:18px 22px;">
          <p style="margin:0 0 14px 0;font-size:13px;line-height:1.55;color:${BRAND_TEXT};">${intro}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid ${BRAND_BORDER};margin-top:4px;">
            ${rowsHtml}
          </table>
          ${ctaHref && ctaLabel ? `
          <div style="margin-top:18px;">
            <a href="${escapeHtml(ctaHref)}" style="display:inline-block;background:${BRAND_PRIMARY};color:#fff;text-decoration:none;font-size:13px;font-weight:500;padding:9px 14px;border-radius:8px;">${escapeHtml(ctaLabel)}</a>
          </div>` : ""}
          ${extraHtml || ""}
        </td></tr>
        <tr><td style="padding:14px 22px;border-top:1px solid ${BRAND_BORDER};background:${BRAND_BG};">
          <p style="margin:0;font-size:11px;color:${BRAND_MUTED};line-height:1.5;">${escapeHtml(footerNote || "Automated notification from Pepper CX. Reply to this email to reach the central CX team.")}</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function fmtMoney(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!isFinite(n) || !n) return "";
  try { return "₹" + new Intl.NumberFormat("en-IN").format(Math.round(n)); } catch { return String(n); }
}

function renderHandoverDetails(d: any): string {
  if (!d || typeof d !== "object") return "";
  const sp = d.salesperson || {};
  const cl = d.client || {};
  const ai = cl.ai_summary || null;
  const contacts: any[] = Array.isArray(d.contacts) ? d.contacts : [];
  const docs = d.documents || {};
  const deal = d.deal || {};

  const section = (title: string, inner: string) => `
    <div style="margin-top:18px;padding-top:12px;border-top:1px solid ${BRAND_BORDER};">
      <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND_MUTED};margin-bottom:6px;">${escapeHtml(title)}</div>
      ${inner}
    </div>`;
  const kv = (rows: Array<[string, string]>) => `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      ${rows.filter(([, v]) => v && String(v).trim().length).map(([k, v]) => `
        <tr>
          <td style="padding:4px 0;color:${BRAND_MUTED};font-size:12px;width:150px;vertical-align:top;">${escapeHtml(k)}</td>
          <td style="padding:4px 0;color:${BRAND_TEXT};font-size:13px;">${escapeHtml(String(v))}</td>
        </tr>`).join("")}
    </table>`;
  const linkRow = (label: string, url: string) => url
    ? `<tr>
        <td style="padding:4px 0;color:${BRAND_MUTED};font-size:12px;width:150px;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:4px 0;font-size:13px;"><a href="${escapeHtml(url)}" style="color:${BRAND_PRIMARY};text-decoration:none;">Open link</a></td>
      </tr>` : "";

  const salespersonHtml = kv([
    ["Name", sp.name || ""],
    ["Email", sp.email || ""],
    ["Sales region", sp.region || ""],
    ["Handover date", sp.handover_date || ""],
  ]);

  const aiHtml = ai ? `
    <div style="margin-top:8px;padding:10px 12px;background:${BRAND_BG};border:1px solid ${BRAND_BORDER};border-radius:8px;">
      <div style="font-size:11px;color:${BRAND_MUTED};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">AI company summary</div>
      ${ai.industry ? `<div style="font-size:13px;color:${BRAND_TEXT};"><b>Industry:</b> ${escapeHtml(ai.industry)}</div>` : ""}
      ${ai.what_they_do ? `<div style="font-size:13px;color:${BRAND_TEXT};margin-top:4px;"><b>What they do:</b> ${escapeHtml(ai.what_they_do)}</div>` : ""}
      ${Array.isArray(ai.products) && ai.products.length ? `<div style="font-size:13px;color:${BRAND_TEXT};margin-top:4px;"><b>Products:</b> ${escapeHtml(ai.products.join(", "))}</div>` : ""}
    </div>` : "";
  const clientHtml = kv([
    ["Company", cl.company || ""],
    ["Industry", cl.industry || ""],
    ["Location", cl.location || ""],
    ["Website", cl.website || ""],
  ]) + aiHtml;

  const contactsHtml = contacts.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:13px;">
        <tr style="color:${BRAND_MUTED};font-size:11px;text-transform:uppercase;">
          <td style="padding:4px 6px 4px 0;">Name</td>
          <td style="padding:4px 6px;">Role</td>
          <td style="padding:4px 6px;">Email</td>
          <td style="padding:4px 0 4px 6px;">Phone</td>
        </tr>
        ${contacts.map((c) => `
          <tr style="border-top:1px solid ${BRAND_BORDER};">
            <td style="padding:6px 6px 6px 0;">${escapeHtml(c.name || "")}</td>
            <td style="padding:6px;">${escapeHtml(c.role || "")}</td>
            <td style="padding:6px;">${escapeHtml(c.email || "")}</td>
            <td style="padding:6px 0 6px 6px;">${escapeHtml(c.phone || "")}</td>
          </tr>`).join("")}
      </table>`
    : `<div style="font-size:12px;color:${BRAND_MUTED};">No contacts provided</div>`;

  const docsHtml = `<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
    ${linkRow("SoW", docs.sow_url || "")}
    ${linkRow("Strategy deck", docs.strategy_deck_url || "")}
    ${linkRow("Keywords", docs.keywords_url || "")}
    ${linkRow("GEO audit", docs.geo_audit_url || "")}
    ${linkRow("Fireflies", docs.fireflies_url || "")}
    ${docs.docs_notes ? `<tr><td style="padding:4px 0;color:${BRAND_MUTED};font-size:12px;width:150px;vertical-align:top;">Notes</td><td style="padding:4px 0;color:${BRAND_TEXT};font-size:13px;">${escapeHtml(docs.docs_notes)}</td></tr>` : ""}
  </table>`;

  const dealHtml = kv([
    ["Stage", deal.stage || ""],
    ["Pepper BU", deal.bu || ""],
    ["Capability", deal.capability || ""],
    ["Deal type", deal.deal_type || ""],
    ["MRR", fmtMoney(deal.mrr)],
    ["Total amount", fmtMoney(deal.total_amount)],
    ["Duration", deal.duration_months ? `${deal.duration_months} months` : ""],
    ["Start date", deal.start_date || ""],
    ["Notes", deal.notes || ""],
  ]);

  return section("Salesperson", salespersonHtml)
    + section("Client", clientHtml)
    + section("Contacts", contactsHtml)
    + section("Documents", docsHtml)
    + section("Deal", dealHtml);
}

type DealRow = {
  id: string; account: string | null; deal_name: string | null;
  vsd: string | null; principal_bopm: string | null; senior_bopm: string | null; bopm: string | null;
  capability_line?: string | null; business_unit?: string | null; geo?: string | null;
  deal_type?: string | null; mrr?: number | null; total_deal_value?: number | null;
  pepper_business_unit?: string | null; duration?: string | null;
};

async function loadDeal(admin: SupabaseClient, dealId: string): Promise<DealRow | null> {
  const { data } = await admin
    .from("staffing_deals")
    .select("id, account, deal_name, vsd, principal_bopm, senior_bopm, bopm, capability_line, business_unit, geo, deal_type, mrr, total_deal_value, pepper_business_unit, duration")
    .eq("id", dealId)
    .maybeSingle();
  return (data as DealRow) || null;
}

async function loadPerson(admin: SupabaseClient, personId: string) {
  const { data } = await admin
    .from("staffing_people")
    .select("id, name, email")
    .eq("id", personId)
    .maybeSingle();
  return data as { id: string; name: string; email: string | null } | null;
}

async function lookupEmailsByNames(admin: SupabaseClient, names: string[]) {
  // (see below for staffed-team loader)
  const clean = Array.from(
    new Set(
      names
        .flatMap((n) => (n || "").split(/[,/]/))
        .map((n) => n.trim())
        .filter((n) => n.length > 1),
    ),
  );
  if (clean.length === 0) return [];
  const { data } = await admin
    .from("staffing_people")
    .select("name, email")
    .in("name", clean);
  return ((data || []) as Array<{ name: string; email: string | null }>)
    .map((r) => (r.email || "").trim())
    .filter((e) => /@/.test(e));
}

function dealLeadershipNames(deal: DealRow) {
  return [deal.bopm, deal.senior_bopm, deal.principal_bopm, deal.vsd]
    .filter((s): s is string => !!s);
}

function dealLink(dealId: string) {
  return `${APP_ORIGIN}/deals/${encodeURIComponent(dealId)}`;
}
function dealLabel(d: DealRow) {
  return [d.account, d.deal_name].filter(Boolean).join(" - ") || d.id;
}

function formatPct(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) ? `${v}%` : "-";
}

// ── Event builders ─────────────────────────────────────────────────────────
type SendInput = {
  event: string;
  dealId?: string;
  personId?: string;
  recipients?: string[];
  payload?: Record<string, unknown>;
};
type Built = { to: string[]; subject: string; html: string };
type BuiltOut = Built & { cc?: string[] };

// ── Rules resolver ──────────────────────────────────────────────────────────
type RuleRow = {
  event_key: string; enabled: boolean;
  to_tokens: string[]; cc_tokens: string[];
  extra_to: string[]; extra_cc: string[];
  subject_template: string; body_template: string;
};

const EVENT_TO_RULE: Record<string, string> = {
  staffed: "assignment.created",
  staffing_changed: "assignment.created",
  staffing_removed: "assignment.created",
  staffing_locked: "staffing.locked",
  handover_received: "handover.received",
  deal_created: "deal.created",
  deal_unstaffed: "deal.unstaffed_7d",
  mbr_bopm_digest: "mbr.reminder_bopm_digest",
  rgy_bopm_digest: "rgy.reminder_bopm_digest",
  nps_bopm_digest: "nps.reminder_bopm_digest",
};

async function loadRule(admin: SupabaseClient, eventKey: string): Promise<RuleRow | null> {
  const { data } = await admin.from("notification_rules").select("*").eq("event_key", eventKey).maybeSingle();
  return (data as RuleRow) || null;
}

function applyTokens(template: string, ctx: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(ctx)) {
    out = out.split(k).join(v ?? "");
  }
  // Replace any remaining unknown {tokens} with blank
  return out.replace(/\{[a-z_]+\}/gi, "");
}

function capabilityBucket(deal: DealRow): string {
  const cap = (deal.capability_line || "").toLowerCase();
  const bu = (deal.business_unit || "").toLowerCase();
  const geo = (deal.geo || "").toLowerCase();
  const text = `${cap} ${bu}`;
  if (text.includes("creative")) return "creative";
  if (text.includes("seo")) return (geo.includes("us") || geo.includes("america")) ? "seo_us" : "seo_india";
  if (text.includes("content studio") || text.includes("studio")) return "content_studio";
  return "other";
}

async function emailsForCapabilityLead(admin: SupabaseClient, deal: DealRow): Promise<string[]> {
  const bucket = capabilityBucket(deal);
  const { data } = await admin.from("capability_leads").select("leads").eq("bucket", bucket).maybeSingle();
  return ((data?.leads as string[]) || []).filter((e) => /@/.test(e));
}

async function emailForAssigneeManager(admin: SupabaseClient, personId: string): Promise<string[]> {
  const { data: p } = await admin.from("staffing_people").select("manager_person_id").eq("id", personId).maybeSingle();
  const mid = (p as { manager_person_id?: string } | null)?.manager_person_id;
  if (!mid) return [];
  const { data: m } = await admin.from("staffing_people").select("email").eq("id", mid).maybeSingle();
  const e = (m as { email?: string } | null)?.email;
  return e && /@/.test(e) ? [e] : [];
}

async function expandTokens(
  admin: SupabaseClient,
  tokens: string[],
  ctx: { deal?: DealRow; personEmail?: string; personId?: string },
): Promise<string[]> {
  const out = new Set<string>();
  for (const tok of tokens) {
    const t = tok.trim();
    if (!t) continue;
    if (t === "{assignee}" && ctx.personEmail) out.add(ctx.personEmail);
    else if (t === "{staffed_team}" && ctx.deal) {
      (await loadStaffedTeam(admin, ctx.deal.id)).forEach((m) => {
        if (m.email && /@/.test(m.email)) out.add(m.email);
      });
    }
    else if (t === "{assignee_manager}" && ctx.personId) {
      (await emailForAssigneeManager(admin, ctx.personId)).forEach((e) => out.add(e));
    } else if (t === "{capability_lead}" && ctx.deal) {
      (await emailsForCapabilityLead(admin, ctx.deal)).forEach((e) => out.add(e));
    } else if ((t === "{vsd}" || t === "{principal_bopm}" || t === "{senior_bopm}" || t === "{bopm}") && ctx.deal) {
      const field = t.slice(1, -1) as "vsd" | "principal_bopm" | "senior_bopm" | "bopm";
      const names = ctx.deal[field] ? [ctx.deal[field] as string] : [];
      (await lookupEmailsByNames(admin, names)).forEach((e) => out.add(e));
    } else if (/@/.test(t)) {
      out.add(t);
    }
  }
  return Array.from(out);
}

// ── Branded digest layout (matches Central CX design) ─────────────────────
const DG_HEADER_BG = "#0C0359";
const DG_HEADER_ACCENT = "#B7A9EE";
const DG_PRIMARY = "#5B34DA";
const DG_PAGE_BG = "#F4F0EA";
const DG_BORDER = "#ECE7F5";
const DG_TEXT = "#1E1633";
const DG_BODY = "#4A4358";
const DG_MUTED = "#9089A0";
const DG_RED = "#C0392B";
const DG_PILL_RED_BG = "#FCE4E1";
const DG_PILL_YELLOW_BG = "#FDF2C7";
const DG_PILL_YELLOW_FG = "#8A6D1E";

type DigestBanner = { bg: string; accent: string; icon: string; html: string };

function digestLayout(o: {
  banner: DigestBanner;
  greeting: string;
  intro: string;
  tableHtml: string;
  ctaLabel: string;
  ctaHref: string;
  ctaHint?: string;
  footerLine1: string;
  footerLine2: string;
}) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:${DG_PAGE_BG};font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${DG_PAGE_BG};">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:640px;max-width:640px;background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(60,40,90,0.06);">
        <tr><td style="background:${DG_HEADER_BG};padding:22px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="left" valign="middle" style="font-size:20px;font-weight:700;color:#FFFFFF;letter-spacing:-0.3px;">pepper</td>
            <td align="right" valign="middle" style="font-size:12px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${DG_HEADER_ACCENT};">Central&nbsp;CX</td>
          </tr></table>
        </td></tr>
        <tr><td style="background:${o.banner.bg};padding:16px 32px;">
          <div style="font-size:14px;line-height:1.55;color:${o.banner.accent};">${o.banner.icon} ${o.banner.html}</div>
        </td></tr>
        <tr><td style="padding:28px 32px 8px 32px;">
          <p style="margin:0 0 12px 0;font-size:15px;line-height:1.5;color:${DG_TEXT};">${o.greeting}</p>
          <p style="margin:0 0 6px 0;font-size:15px;line-height:1.6;color:${DG_BODY};">${o.intro}</p>
        </td></tr>
        <tr><td style="padding:8px 32px 4px 32px;">${o.tableHtml}</td></tr>
        <tr><td align="center" style="padding:28px 32px 8px 32px;">
          <a href="${escapeHtml(o.ctaHref)}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px;background:${DG_PRIMARY};">${escapeHtml(o.ctaLabel)}</a>
        </td></tr>
        ${o.ctaHint ? `<tr><td align="center" style="padding:0 32px 28px 32px;"><p style="margin:0;font-size:12px;line-height:1.5;color:${DG_MUTED};">${o.ctaHint}</p></td></tr>` : `<tr><td style="padding-bottom:20px;"></td></tr>`}
        <tr><td style="padding:18px 32px 22px 32px;background:${DG_PAGE_BG};border-top:1px solid ${DG_BORDER};">
          <p style="margin:0;font-size:12px;line-height:1.55;color:${DG_MUTED};">${o.footerLine1}</p>
          <p style="margin:6px 0 0 0;font-size:12px;line-height:1.55;color:${DG_MUTED};">${o.footerLine2}</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function digestTable(headers: string[], rows: string[][]): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${DG_BORDER};border-radius:10px;border-collapse:separate;border-spacing:0;font-size:13px;overflow:hidden;">
      <tr style="background:#F7F3FB;">
        ${headers.map((h) => `<td style="padding:11px 14px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:${DG_MUTED};font-weight:600;">${escapeHtml(h)}</td>`).join("")}
      </tr>
      ${rows.map((r, i) => `<tr>${r.map((c) => `<td style="padding:14px;color:${DG_TEXT};font-size:14px;vertical-align:top;${i < rows.length - 1 ? `border-top:1px solid ${DG_BORDER};` : `border-top:1px solid ${DG_BORDER};`}">${c}</td>`).join("")}</tr>`).join("")}
    </table>`;
}

function pill(text: string, bg: string, fg: string): string {
  return `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${bg};color:${fg};font-size:12px;font-weight:600;">${escapeHtml(text)}</span>`;
}

async function buildDigest(admin: SupabaseClient, ev: string, input: SendInput): Promise<Built | null> {
  const to = (input.recipients || []).filter((e) => /@/.test(e));
  if (to.length === 0) return null;
  const rule = await loadRule(admin, EVENT_TO_RULE[ev]);
  if (rule && !rule.enabled) return null;
  const p = (input.payload || {}) as Record<string, unknown>;
  const rows = Array.isArray(p.rows) ? (p.rows as Array<Record<string, string>>) : [];
  if (rows.length === 0) return null;
  const bopmName = String(p.bopm_name || "").trim();
  const bopmFirst = bopmName ? bopmName.split(/\s+/)[0] : "there";
  const vsdName = String(p.vsd_name || "").trim();
  const greeting = `Hi ${escapeHtml(bopmFirst)},`;

  if (ev === "mbr_bopm_digest") {
    const mbrMonth = String(p.mbr_month || "");
    const currentMonth = String(p.current_month || "");
    const daysRemaining = String(p.days_remaining || "");
    const ordinal = String(p.reminder_ordinal || "");
    const banner: DigestBanner = {
      bg: "#FDF2C7", accent: "#7A5A0D", icon: "⏰",
      html: `<b>${escapeHtml(daysRemaining)} working days</b> left in ${escapeHtml(currentMonth)} — ${escapeHtml(mbrMonth)} MBRs must be logged before month-end.`,
    };
    const intro = `The following <b>${rows.length}</b> account(s) under you don't have their <b>${escapeHtml(mbrMonth)}</b> MBR logged yet. Please update them in CX OS — it takes about two minutes per account.`;
    const tableRows = rows.map((r) => [
      `<b>${escapeHtml(r.account || "")}</b>`,
      escapeHtml(r.deal || ""),
      escapeHtml(r.month || mbrMonth),
      pill("Pending", DG_PILL_RED_BG, DG_RED),
    ]);
    const tableHtml = digestTable(["Account", "Deal", "MBR Month", "Status"], tableRows);
    const subject = rule?.subject_template?.trim()
      ? applyTokens(rule.subject_template, digestCtx(bopmName, vsdName, rows.length, p))
      : `${daysRemaining} working days left — ${rows.length} MBR(s) pending for ${mbrMonth}`;
    return {
      to,
      subject,
      html: digestLayout({
        banner, greeting, intro, tableHtml,
        ctaLabel: "Log MBRs in CX OS →",
        ctaHref: `${APP_ORIGIN}/mbr`,
        ctaHint: "Marked as done already? This email will stop automatically once the status updates.",
        footerLine1: `This is your ${escapeHtml(ordinal)} reminder — it repeats every 3 working days until the MBR is logged.${vsdName ? ` ${escapeHtml(vsdName)} is copied for visibility.` : ""}`,
        footerLine2: `Sent by Central CX · centralcx@peppercontent.io · rule: mbr.reminder_bopm_digest`,
      }),
    };
  }

  if (ev === "rgy_bopm_digest") {
    const weekLabel = String(p.week_label || "");
    const banner: DigestBanner = {
      bg: "#EFE9FA", accent: DG_PRIMARY, icon: "🔄",
      html: `<b>Friday RGY refresh</b> · ${escapeHtml(weekLabel)} — updates made now feed Monday's RGY insight.`,
    };
    const intro = `<b>${rows.length}</b> account(s) under you have no RGY entry in the last 7 days. Their status below is the last one logged — please confirm it still holds, or update it if things have moved.`;
    const tableRows = rows.map((r) => {
      const rgy = String(r.rgy || "Not set");
      const rgyPill = rgy === "R" || /red/i.test(rgy)
        ? pill("Red", DG_PILL_RED_BG, DG_RED)
        : rgy === "Y" || /yellow/i.test(rgy)
          ? pill("Yellow", DG_PILL_YELLOW_BG, DG_PILL_YELLOW_FG)
          : rgy === "G" || /green/i.test(rgy)
            ? pill("Green", "#DDF3E3", "#1E7B36")
            : pill(rgy || "Not set", "#EFEAF3", DG_MUTED);
      const lastRaw = String(r.last_updated || "");
      const m = lastRaw.match(/^(\S+)\s*\((\d+)d ago\)/);
      const lastCell = m
        ? `${escapeHtml(m[1])} · <span style="color:${DG_RED};font-weight:600;">${escapeHtml(m[2])}d ago</span>`
        : escapeHtml(lastRaw || "Never");
      return [`<b>${escapeHtml(r.account || "")}</b>`, rgyPill, lastCell];
    });
    const tableHtml = digestTable(["Account", "Current RGY", "Last Updated"], tableRows);
    const subject = rule?.subject_template?.trim()
      ? applyTokens(rule.subject_template, digestCtx(bopmName, vsdName, rows.length, p))
      : `RGY refresh: ${rows.length} account(s) not updated this week`;
    return {
      to,
      subject,
      html: digestLayout({
        banner, greeting, intro, tableHtml,
        ctaLabel: "Update RGY in CX OS →",
        ctaHref: `${APP_ORIGIN}/rgy`,
        ctaHint: "Even if nothing changed, re-confirming the status keeps your accounts out of this list.",
        footerLine1: `Sent every Friday, only when one or more of your accounts has no RGY entry in the last 7 days.${vsdName ? ` ${escapeHtml(vsdName)} is copied for visibility.` : ""}`,
        footerLine2: `Sent by Central CX · centralcx@peppercontent.io · rule: rgy.reminder_bopm_digest`,
      }),
    };
  }

  // nps_bopm_digest
  const pocCount = String(p.poc_count || rows.length);
  const accountCount = String(p.account_count || "");
  const banner: DigestBanner = {
    bg: "#E4EEFB", accent: "#1F3B8A", icon: "💬",
    html: `<b>Wednesday NPS check</b> — a personal nudge from you gets far more responses than another automated email to the client.`,
  };
  const intro = `<b>${escapeHtml(pocCount)}</b> POC(s) across <b>${escapeHtml(accountCount)}</b> account(s) under you were sent an NPS survey but haven't completed it. Please give them a quick nudge on your next call or over Slack/email.`;
  const tableRows = rows.map((r) => [
    `<b>${escapeHtml(r.account || "")}</b>`,
    `<b>${escapeHtml(r.poc_name || "")}</b>${r.poc_email ? ` <span style="color:${DG_MUTED};">· ${escapeHtml(r.poc_email)}</span>` : ""}`,
    escapeHtml(r.sent_date || ""),
    `<span style="color:${DG_RED};font-weight:600;">${escapeHtml(r.days_outstanding || "0")} days</span>`,
  ]);
  const tableHtml = digestTable(["Account", "POC", "Invite Sent", "Outstanding"], tableRows);
  const subject = rule?.subject_template?.trim()
    ? applyTokens(rule.subject_template, digestCtx(bopmName, vsdName, rows.length, p))
    : `NPS pending: ${pocCount} POC(s) across ${accountCount} account(s) have not responded`;
  return {
    to,
    subject,
    html: digestLayout({
      banner, greeting, intro, tableHtml,
      ctaLabel: "View NPS tracker →",
      ctaHref: `${APP_ORIGIN}/pulse-nps`,
      ctaHint: "Survey links can be resent from the tracker. POCs drop off this list as soon as they respond.",
      footerLine1: `Sent every Wednesday, only when one or more of your accounts has a pending NPS response.${vsdName ? ` ${escapeHtml(vsdName)} is copied for visibility.` : ""}`,
      footerLine2: `Sent by Central CX · centralcx@peppercontent.io · rule: nps.reminder_bopm_digest`,
    }),
  };
}

function digestCtx(bopmName: string, vsdName: string, count: number, p: Record<string, unknown>): Record<string, string> {
  return {
    "{bopm}": bopmName,
    "{bopm_name}": bopmName,
    "{bopm_first_name}": bopmName ? bopmName.split(/\s+/)[0] : "there",
    "{vsd}": vsdName,
    "{vsd_name}": vsdName,
    "{pending_count}": String(count),
    "{stale_count}": String(count),
    "{poc_count}": String(p.poc_count || count),
    "{account_count}": String(p.account_count || ""),
    "{mbr_month}": String(p.mbr_month || ""),
    "{current_month}": String(p.current_month || ""),
    "{days_remaining}": String(p.days_remaining || ""),
    "{reminder_ordinal}": String(p.reminder_ordinal || ""),
    "{week_label}": String(p.week_label || ""),
  };
}

async function buildEmail(admin: SupabaseClient, input: SendInput): Promise<Built | null> {
  const ev = input.event;

  if (ev === "test") {
    const to = (input.recipients || []).filter((e) => /@/.test(e));
    if (to.length === 0) return null;
    // Reuse this envelope for ad-hoc app notifications (e.g. Deal Handover)
    // when payload.kind is provided, so we keep the central mailbox flow.
    const kind = String((input.payload as any)?.kind || "");
    if (kind === "handover_submitted" || kind === "handover_partial" || kind === "handover_completed") {
      const company = String((input.payload as any)?.company || "");
      const submitter = String((input.payload as any)?.submitter || "");
      const dealId = String((input.payload as any)?.deal_id || "");
      const dealName = String((input.payload as any)?.deal_name || "");
      const vsd = String((input.payload as any)?.vsd || "");
      const titleMap: Record<string, string> = {
        handover_submitted: `New sales handover - ${company}`,
        handover_partial: `Handover update - ${company}`,
        handover_completed: `Handover completed - ${company}`,
      };
      const introMap: Record<string, string> = {
        handover_submitted: `A new sales handover has been submitted for <b>${escapeHtml(company)}</b>. Priyanka please add Deal ID & Name. Anirudh please confirm the VSD.`,
        handover_partial: `An update was made on the handover for <b>${escapeHtml(company)}</b>. Your action may be next.`,
        handover_completed: `The handover for <b>${escapeHtml(company)}</b> is complete - the deal has been created in Clients & Deals.`,
      };
      return {
        to,
        subject: titleMap[kind],
        html: layout({
          title: titleMap[kind],
          intro: introMap[kind],
          rows: [
            ["Company", company],
            ["Submitted by", submitter],
            ["Deal ID", dealId],
            ["Deal Name", dealName],
            ["VSD", vsd],
          ],
          ctaLabel: "Open Deal Handover",
          ctaHref: `${APP_ORIGIN}/deal-handover`,
        }),
      };
    }
    return {
      to,
      subject: "Pepper CX - Central mailbox test",
      html: layout({
        title: "Central mailbox is working",
        intro: "This is a test message sent from the central CX mailbox. If you received it, notifications are good to go.",
        rows: [["Sent at", new Date().toISOString()]],
      }),
    };
  }

  if (ev === "handover_received") {
    const rule = await loadRule(admin, "handover.received");
    if (rule && !rule.enabled) return null;
    const recips = await expandTokens(admin, [...(rule?.to_tokens || []), ...(rule?.extra_to || [])], {});
    if (recips.length === 0) return null;
    const company = String(input.payload?.company || "");
    const submitter = String(input.payload?.submitter || "");
    const reference = String((input.payload as any)?.reference || "");
    const details = (input.payload as any)?.details || {};
    const tctx = { "{company}": company, "{submitter}": submitter };
    const subject = rule?.subject_template?.trim()
      ? applyTokens(rule.subject_template, tctx)
      : `New sales handover - ${company}`;
    const intro = rule?.body_template?.trim()
      ? applyTokens(rule.body_template, tctx)
      : `A new sales handover has been submitted for <b>${escapeHtml(company)}</b>. Priyanka please add Deal ID & Name. Anirudh please confirm the VSD.`;
    return {
      to: recips,
      subject,
      html: layout({
        title: `New sales handover - ${escapeHtml(company)}`,
        intro,
        rows: [["Submitted by", submitter], ["Reference", reference]],
        ctaLabel: "Open Deal Handover",
        ctaHref: `${APP_ORIGIN}/deal-handover`,
        extraHtml: renderHandoverDetails(details),
      }),
    };
  }

  // ── BOPM digests (per-recipient aggregation) ──────────────────────────────
  if (ev === "mbr_bopm_digest" || ev === "rgy_bopm_digest" || ev === "nps_bopm_digest") {
    return buildDigest(admin, ev, input);
  }

  if (!input.dealId) return null;
  const deal = await loadDeal(admin, input.dealId);
  if (!deal) return null;
  const label = dealLabel(deal);
  const link = dealLink(deal.id);

  if (ev === "staffed" || ev === "staffing_changed" || ev === "staffing_removed") {
    if (!input.personId) return null;
    const person = await loadPerson(admin, input.personId);
    if (!person?.email || !/@/.test(person.email)) return null;
    if (STAFFING_EMAIL_SUPPRESSED.has(person.email.trim().toLowerCase())) return null;
    const pct = formatPct(input.payload?.allocationPct);
    const role = String(input.payload?.roleKey || "").replace(/_/g, " ");
    const rule = await loadRule(admin, "assignment.created");
    const tctx: Record<string, string> = {
      "{deal_label}": label,
      "{account}": deal.account || "",
      "{deal_name}": deal.deal_name || "",
      "{assignee}": person.name || "",
      "{role}": role,
      "{pct}": pct,
      "{vsd}": deal.vsd || "",
      "{bopm}": deal.bopm || "",
    };
    const customSubject = rule?.subject_template?.trim()
      ? applyTokens(rule.subject_template, tctx)
      : null;
    const customIntro = rule?.body_template?.trim()
      ? applyTokens(rule.body_template, tctx)
      : null;
    if (ev === "staffed") {
      return {
        to: [person.email],
        subject: customSubject || `You've been staffed on ${label}`,
        html: layout({
          title: `You're staffed on ${escapeHtml(label)}`,
          intro: customIntro || `Hi ${escapeHtml(person.name || "")}, you've been added to <b>${escapeHtml(label)}</b> at <b>${escapeHtml(pct)}</b> bandwidth.`,
          rows: [
            ["Account", deal.account || ""],
            ["Deal", deal.deal_name || ""],
            ["Role", role],
            ["Allocation", pct],
            ["Start", String(input.payload?.startDate || "")],
            ["End", String(input.payload?.endDate || "")],
          ],
          ctaLabel: "Open deal in Pepper CX",
          ctaHref: link,
        }),
      };
    }
    if (ev === "staffing_changed") {
      return {
        to: [person.email],
        subject: `Your staffing on ${label} was updated`,
        html: layout({
          title: `Staffing updated - ${escapeHtml(label)}`,
          intro: `Hi ${escapeHtml(person.name || "")}, your staffing on <b>${escapeHtml(label)}</b> was updated. Your bandwidth is now <b>${escapeHtml(pct)}</b>.`,
          rows: [
            ["Account", deal.account || ""],
            ["Deal", deal.deal_name || ""],
            ["Role", role],
            ["New allocation", pct],
          ],
          ctaLabel: "Open deal",
          ctaHref: link,
        }),
      };
    }
    return {
      to: [person.email],
      subject: `You've been removed from ${label}`,
      html: layout({
        title: `Removed from ${escapeHtml(label)}`,
        intro: `Hi ${escapeHtml(person.name || "")}, you've been removed from <b>${escapeHtml(label)}</b>. No further action is needed.`,
        rows: [
          ["Account", deal.account || ""],
          ["Deal", deal.deal_name || ""],
          ["Role", role],
        ],
      }),
    };
  }

  if (ev === "deal_created" || ev === "deal_unstaffed") {
    const rule = await loadRule(admin, EVENT_TO_RULE[ev]);
    if (rule && !rule.enabled) return null;
    const recips = await expandTokens(admin, [...(rule?.to_tokens || []), ...(rule?.extra_to || [])], { deal });
    if (recips.length === 0) return null;
    const titleMap: Record<string, string> = {
      deal_created: `New deal created - ${label}`,
      deal_unstaffed: `Deal awaiting staffing - ${label}`,
    };
    const introMap: Record<string, string> = {
      deal_created: `A new deal <b>${escapeHtml(label)}</b> has been created in Pepper CX.`,
      deal_unstaffed: `<b>${escapeHtml(label)}</b> has been active for 7+ days without a staffing assignment. Please staff the deal.`,
    };
    const ctaMap: Record<string, [string, string]> = {
      deal_created: ["Open deal", link],
      deal_unstaffed: ["Open in Staffing", `${APP_ORIGIN}/staffing?tab=staffing&deal=${encodeURIComponent(deal.id)}`],
    };
    const tokenCtx: Record<string, string> = {
      "{deal_label}": label,
      "{account}": deal.account || "",
      "{deal_name}": deal.deal_name || "",
      "{capability}": deal.capability_line || "",
      "{vsd}": deal.vsd || "",
      "{bopm}": deal.bopm || "",
      "{deal_type}": deal.deal_type || "",
      "{mrr}": fmtMoney(deal.mrr),
      "{total_deal_value}": fmtMoney(deal.total_deal_value),
      "{business_unit}": deal.pepper_business_unit || deal.business_unit || "",
      "{duration}": deal.duration ? `${deal.duration} months` : "",
    };
    const intro = rule?.body_template?.trim()
      ? applyTokens(rule.body_template, tokenCtx)
      : introMap[ev];
    return {
      to: recips,
      subject: rule?.subject_template?.trim()
        ? applyTokens(rule.subject_template, tokenCtx)
        : titleMap[ev],
      html: layout({
        title: titleMap[ev],
        intro,
        rows: ev === "deal_created"
          ? [
              ["Client", deal.account || ""],
              ["Deal name", deal.deal_name || ""],
              ["Deal type", deal.deal_type || ""],
              ["MRR", fmtMoney(deal.mrr)],
              ["Total deal value", fmtMoney(deal.total_deal_value)],
              ["Business unit", deal.pepper_business_unit || deal.business_unit || ""],
              ["VSD", deal.vsd || ""],
              ["Duration", deal.duration ? `${deal.duration} months` : ""],
            ]
          : [
              ["Account", deal.account || ""],
              ["Deal", deal.deal_name || ""],
              ["Capability", deal.capability_line || ""],
              ["VSD", deal.vsd || ""],
              ["BOPM", deal.bopm || ""],
            ],
        ctaLabel: ctaMap[ev][0],
        ctaHref: ctaMap[ev][1],
      }),
    };
  }

  return null;
}

// ── Server ─────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = (await req.json().catch(() => ({}))) as
      | { action: "send"; events: SendInput[] }
      | { action: "send"; event: string } & SendInput
      | { action: "set_central"; userId?: string }
      | { action: "central_status" };

    const action = (body as { action?: string }).action || "send";
    const user = await getCallerUser(req, admin);

    if (action === "central_status") {
      const { data } = await admin
        .from("gmail_connections")
        .select("user_id, google_email, updated_at")
        .eq("is_central", true)
        .maybeSingle();
      return json({ connected: !!data, googleEmail: data?.google_email || null, updatedAt: data?.updated_at || null });
    }

    if (action === "set_central") {
      const targetUserId = (body as { userId?: string }).userId || user.id;
      // Make sure that user has a gmail_connections row.
      const { data: row } = await admin
        .from("gmail_connections")
        .select("user_id")
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (!row) return json({ error: "user_has_no_gmail_connection" }, 412);
      // Unset existing central, then mark this one.
      await admin.from("gmail_connections").update({ is_central: false }).eq("is_central", true);
      const { error: upErr } = await admin
        .from("gmail_connections")
        .update({ is_central: true })
        .eq("user_id", targetUserId);
      if (upErr) throw upErr;
      return json({ ok: true });
    }

    if (action === "send_test_rule") {
      const eventKey = String((body as { eventKey?: string }).eventKey || "");
      const to = String((body as { to?: string }).to || "").trim();
      if (!eventKey || !/@/.test(to)) return json({ error: "eventKey_and_to_required" }, 400);
      const rule = await loadRule(admin, eventKey);
      if (!rule) return json({ error: "rule_not_found" }, 404);
      // For the three BOPM digest rules, render the actual production digest
      // template with a rich sample payload so the preview matches what real
      // recipients receive (branded header, banner, full table, CTA, footer).
      const DIGEST_EVENT_BY_RULE: Record<string, string> = {
        "mbr.reminder_bopm_digest": "mbr_bopm_digest",
        "rgy.reminder_bopm_digest": "rgy_bopm_digest",
        "nps.reminder_bopm_digest": "nps_bopm_digest",
      };
      const digestEvent = DIGEST_EVENT_BY_RULE[rule.event_key];
      if (digestEvent) {
        const now = new Date();
        const prev = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
        // Digests now check the CURRENT month for MBR; keep the label current too.
        const mbrMonth = now.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
        const currentMonth = now.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
        const weekLabel = `Week of ${now.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`;
        const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
        const daysRemainingNow = String(Math.max(0, lastDay - now.getUTCDate()));

        // Resolve real applicable rows for the sample BOPM (Rishabh Agarwal).
        const SAMPLE_BOPM = "Rishabh Agarwal";
        const ACTIVE_STATUSES = ["Active Deal", "New Deal in SLA/PO", "Deal Disputed", "Deal in Renewal Process"];
        const splitNames = (v: string | null | undefined) =>
          String(v || "").split(/[,/]/).map((s) => s.trim().toLowerCase()).filter((s) => s.length > 1);
        const targetLc = SAMPLE_BOPM.toLowerCase();
        const { data: allDeals } = await admin
          .from("staffing_deals")
          .select("id, account, deal_name, vsd, principal_bopm, senior_bopm, bopm, deal_status")
          .in("deal_status", ACTIVE_STATUSES);
        const myDeals = (allDeals || []).filter((d: any) => {
          const names = [...splitNames(d.bopm), ...splitNames(d.senior_bopm), ...splitNames(d.principal_bopm)];
          return names.includes(targetLc);
        });
        const myIds = myDeals.map((d: any) => d.id);

        let realRows: Array<Record<string, string>> = [];
        if (digestEvent === "mbr_bopm_digest" && myIds.length) {
          const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
          const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
          const nextMonthStart = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, "0")}-01`;
          const { data: entries } = await admin
            .from("mbr_entries")
            .select("deal_id, status, week_start")
            .in("deal_id", myIds)
            .gte("week_start", `${ym}-01`)
            .lt("week_start", nextMonthStart);
          const pendingIds = new Set<string>(
            (entries || []).filter((e: any) => e.status === "Pending").map((e: any) => e.deal_id),
          );
          realRows = myDeals
            .filter((d: any) => pendingIds.has(d.id))
            .map((d: any) => ({
              account: d.account || "",
              deal: d.deal_name || "",
              month: mbrMonth,
              link: `${APP_ORIGIN}/mbr?deal=${encodeURIComponent(d.id)}`,
            }));
        } else if (digestEvent === "rgy_bopm_digest" && myIds.length) {
          const cutoffIso = new Date(Date.now() - 7 * 86400 * 1000).toISOString().slice(0, 10);
          const { data: rgyRows } = await admin
            .from("deal_rgy_weekly")
            .select("deal_id, week_start")
            .in("deal_id", myIds)
            .order("week_start", { ascending: false });
          const latest = new Map<string, string>();
          for (const r of (rgyRows || []) as any[]) {
            if (!latest.has(r.deal_id)) latest.set(r.deal_id, r.week_start);
          }
          realRows = myDeals
            .filter((d: any) => {
              const ws = latest.get(d.id);
              return !ws || ws < cutoffIso;
            })
            .map((d: any) => ({
              account: d.account || "",
              deal: d.deal_name || "",
              rgy: "-",
              last_updated: latest.get(d.id) || "Never",
            }));
        } else if (digestEvent === "nps_bopm_digest" && myIds.length) {
          const { data: invites } = await admin
            .from("survey_invites")
            .select("deal_id, recipient_name, recipient_email, sent_at, completed_at, account_snapshot")
            .in("deal_id", myIds)
            .not("sent_at", "is", null)
            .is("completed_at", null);
          const dealById = new Map(myDeals.map((d: any) => [d.id, d]));
          realRows = (invites || []).map((i: any) => {
            const d: any = dealById.get(i.deal_id) || {};
            const sent = i.sent_at ? new Date(i.sent_at) : null;
            const daysOut = sent ? Math.floor((Date.now() - sent.getTime()) / 86400000) : 0;
            return {
              account: d.account || i.account_snapshot || "",
              poc_name: i.recipient_name || "",
              poc_email: i.recipient_email || "",
              sent_date: sent ? sent.toISOString().slice(0, 10) : "",
              days_outstanding: String(daysOut),
            };
          });
        }

        const samplePayload: Record<string, unknown> = {
          bopm_name: SAMPLE_BOPM,
          vsd_name: "",
        };
        const usingSample = realRows.length === 0;
        if (digestEvent === "mbr_bopm_digest") {
          Object.assign(samplePayload, {
            mbr_month: mbrMonth,
            current_month: currentMonth,
            days_remaining: daysRemainingNow,
            reminder_ordinal: "second",
            rows: usingSample ? [
              { account: "Zo Beauty", deal: "SEO/GEO + Content Mandate", month: mbrMonth },
              { account: "Pidilite", deal: "Content Retainer - FY25", month: mbrMonth },
              { account: "Cream City Mortgage", deal: "SEO Retainer", month: mbrMonth },
              { account: "Lifescan (OneTouch)", deal: "Content + SEO Mandate", month: mbrMonth },
            ] : realRows,
          });
        } else if (digestEvent === "rgy_bopm_digest") {
          const daysAgo = (n: number) => {
            const d = new Date(Date.now() - n * 86400000);
            return `${d.toISOString().slice(0, 10)} (${n}d ago)`;
          };
          Object.assign(samplePayload, {
            week_label: weekLabel,
            rows: usingSample ? [
              { account: "Zo Beauty", deal: "SEO/GEO + Content Mandate", rgy: "R", last_updated: daysAgo(12) },
              { account: "Pidilite", deal: "Content Retainer - FY25", rgy: "Y", last_updated: daysAgo(9) },
              { account: "Cream City Mortgage", deal: "SEO Retainer", rgy: "R", last_updated: daysAgo(21) },
              { account: "Lifescan (OneTouch)", deal: "Content + SEO Mandate", rgy: "Y", last_updated: "Never" },
            ] : realRows,
          });
        } else {
          const isoDaysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
          const sampleRows = [
            { account: "Zo Beauty", poc_name: "Aakash Mehta", poc_email: "aakash@zobeauty.com", sent_date: isoDaysAgo(11), days_outstanding: "11" },
            { account: "Zo Beauty", poc_name: "Priya Shah", poc_email: "priya@zobeauty.com", sent_date: isoDaysAgo(11), days_outstanding: "11" },
            { account: "Pidilite", poc_name: "Rahul Nair", poc_email: "rahul.nair@pidilite.com", sent_date: isoDaysAgo(6), days_outstanding: "6" },
            { account: "Cream City Mortgage", poc_name: "Kevin O'Connor", poc_email: "kevin@creamcity.com", sent_date: isoDaysAgo(9), days_outstanding: "9" },
            { account: "Lifescan (OneTouch)", poc_name: "Meera Iyer", poc_email: "meera@onetouch.com", sent_date: isoDaysAgo(4), days_outstanding: "4" },
          ];
          const rows = usingSample ? sampleRows : realRows;
          const accountCount = new Set(rows.map((r: any) => r.account)).size;
          Object.assign(samplePayload, {
            poc_count: rows.length,
            account_count: accountCount,
            rows,
          });
        }
        const built = await buildDigest(admin, digestEvent, {
          event: digestEvent,
          recipients: [to],
          payload: samplePayload,
        } as SendInput);
        if (!built) return json({ error: "digest_render_failed" }, 500);
        const testSubject = `[TEST${usingSample ? " · sample data" : ""}] ${built.subject}`;
        try {
          const { token, email: fromEmail } = await getCentralToken(admin);
          if (!fromEmail) return json({ error: "central_mailbox_missing_email" }, 412);
          const raw = buildRaw({ to: [to], subject: testSubject, html: built.html, from: fromEmail });
          const send = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ raw }),
          });
          const data = await send.json();
          if (!send.ok) return json({ error: data?.error?.message || "gmail_send_failed" }, 500);
          await admin.from("email_send_log").insert([{
            event: `test:${rule.event_key}`, deal_id: null, recipient_email: to,
            subject: testSubject, status: "sent", gmail_message_id: data.id as string, error: null,
            triggered_by: user.id, payload: { test: true, digest: digestEvent },
          }]);
          return json({ ok: true, id: data.id });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return json({ error: msg }, msg === "central_mailbox_not_connected" || msg === "central_mailbox_reauth_required" ? 412 : 500);
        }
      }
      const sampleCtx: Record<string, string> = {
        "{deal_label}": "Zo Beauty - SEO/GEO + Content Mandate",
        "{account}": "Zo Beauty",
        "{deal_name}": "SEO/GEO + Content Mandate",
        "{capability}": "Pepper SEO - SEO + Content Retainer",
        "{vsd}": "Neema Jayadas",
        "{principal_bopm}": "",
        "{senior_bopm}": "Rishabh Agarwal",
        "{bopm}": "Rishabh Agarwal",
        "{capability_lead}": "Rishabh Agarwal",
        "{assignee}": "Rishabh Agarwal",
        "{assignee_manager}": "Neema Jayadas",
        "{role}": "Senior BOPM",
        "{pct}": "50%",
        "{status}": "Red",
        "{dimensions}": "Delivery, Sentiment",
        "{month}": new Date().toISOString().slice(0, 7),
        "{company}": "Zo Beauty",
        "{submitter}": "Neema Jayadas",
      };
      const subject = `[TEST] ${rule.subject_template?.trim() ? applyTokens(rule.subject_template, sampleCtx) : `${rule.event_key} preview`}`;
      const intro = rule.body_template?.trim()
        ? applyTokens(rule.body_template, sampleCtx)
        : `This is a preview of the <b>${escapeHtml(rule.event_key)}</b> notification. No body template is set yet - actual sends will use the default copy.`;
      const html = layout({
        title: `Preview - ${escapeHtml(rule.event_key)}`,
        intro,
        rows: [
          ["Event", rule.event_key],
          ["Sample deal", sampleCtx["{deal_label}"]],
          ["Sent at", new Date().toISOString()],
        ],
      });
      try {
        const { token, email: fromEmail } = await getCentralToken(admin);
        if (!fromEmail) return json({ error: "central_mailbox_missing_email" }, 412);
        const raw = buildRaw({ to: [to], subject, html, from: fromEmail });
        const send = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ raw }),
        });
        const data = await send.json();
        if (!send.ok) return json({ error: data?.error?.message || "gmail_send_failed" }, 500);
        await admin.from("email_send_log").insert([{
          event: `test:${rule.event_key}`, deal_id: null, recipient_email: to,
          subject, status: "sent", gmail_message_id: data.id as string, error: null,
          triggered_by: user.id, payload: { test: true },
        }]);
        return json({ ok: true, id: data.id });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return json({ error: msg }, msg === "central_mailbox_not_connected" || msg === "central_mailbox_reauth_required" ? 412 : 500);
      }
    }

    // action === "send"
    const inputs: SendInput[] = Array.isArray((body as { events?: SendInput[] }).events)
      ? (body as { events: SendInput[] }).events
      : [body as SendInput];

    let token: string;
    let fromEmail: string | null;
    try {
      const c = await getCentralToken(admin);
      token = c.token;
      fromEmail = c.email;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg === "central_mailbox_not_connected" ||
        msg === "central_mailbox_reauth_required" ||
        msg === "gmail_oauth_not_configured"
      ) {
        // Soft no-op: notifications are optional; don't break user flows.
        return json({ ok: true, skipped: true, reason: msg, results: [] });
      }
      throw e;
    }
    if (!fromEmail) {
      return json({ ok: true, skipped: true, reason: "central_mailbox_missing_email", results: [] });
    }

    const results: Array<Record<string, unknown>> = [];
    for (const inp of inputs) {
      try {
        const built = await buildEmail(admin, inp);
        if (!built) {
          results.push({ event: inp.event, skipped: true, reason: "no_recipients_or_data" });
          continue;
        }
        // Apply rule overrides: enabled, extra_to, extra_cc, cc_tokens.
        const ruleKey = EVENT_TO_RULE[inp.event];
        let cc: string[] = [];
        const toSet = new Set<string>(built.to);
        if (ruleKey) {
          const rule = await loadRule(admin, ruleKey);
          if (rule && !rule.enabled) {
            results.push({ event: inp.event, skipped: true, reason: "rule_disabled" });
            continue;
          }
          if (rule) {
            const deal = inp.dealId ? await loadDeal(admin, inp.dealId) : undefined;
            const person = inp.personId ? await loadPerson(admin, inp.personId) : null;
            const ctx = { deal: deal || undefined, personEmail: person?.email || undefined, personId: inp.personId };
            const extraTo = await expandTokens(admin, rule.extra_to || [], ctx);
            const ccAll = await expandTokens(admin, [...(rule.cc_tokens || []), ...(rule.extra_cc || [])], ctx);
            extraTo.forEach((e) => toSet.add(e));
            // dedupe cc against to
            cc = ccAll.filter((e) => !toSet.has(e));
          }
        }
        const finalTo = Array.from(toSet);
        let outTo = finalTo;
        let outCc = cc;
        // Digest events also accept explicit cc emails via payload.cc_emails.
        if (inp.event === "mbr_bopm_digest" || inp.event === "rgy_bopm_digest" || inp.event === "nps_bopm_digest") {
          const extra = Array.isArray((inp.payload as any)?.cc_emails)
            ? ((inp.payload as any).cc_emails as string[]).filter((e) => /@/.test(e))
            : [];
          const ccSet = new Set<string>([...outCc, ...extra]);
          outCc = Array.from(ccSet).filter((e) => !toSet.has(e));
        }
        if (STAFFING_EVENTS.has(inp.event)) {
          outTo = stripSuppressed(outTo);
          outCc = stripSuppressed(outCc);
          if (outTo.length === 0) {
            results.push({ event: inp.event, skipped: true, reason: "all_recipients_suppressed" });
            continue;
          }
        }
        const raw = buildRaw({ to: outTo, cc: outCc.length ? outCc : undefined, subject: built.subject, html: built.html, from: fromEmail });
        const send = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ raw }),
          },
        );
        const data = await send.json();
        const ok = send.ok;
        // Log every recipient row.
        const logRows = [...outTo, ...outCc].map((r) => ({
          event: inp.event,
          deal_id: inp.dealId || null,
          recipient_email: r,
          subject: built.subject,
          status: ok ? "sent" : "failed",
          gmail_message_id: ok ? (data.id as string) : null,
          error: ok ? null : data?.error?.message || "gmail_send_failed",
          triggered_by: user.id,
          payload: inp.payload || null,
        }));
        await admin.from("email_send_log").insert(logRows);
        results.push({ event: inp.event, ok, id: data?.id, to: outTo, cc: outCc, error: ok ? null : data?.error?.message });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ event: inp.event, ok: false, error: msg });
      }
    }
    return json({ ok: true, results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg === "unauthorized"
      ? 401
      : msg === "central_mailbox_not_connected" || msg === "central_mailbox_reauth_required"
      ? 412
      : 500;
    return json({ error: msg }, status);
  }
});