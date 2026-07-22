// Send app notification emails via a single central Gmail mailbox.
// The central account is whichever gmail_connections row has is_central=true
// (set via the Settings → Notifications page after that user connects Gmail).
//
// Supported events: staffed, staffing_changed, staffing_removed, rgy_alert, mbr_reminder, test
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
  if (!res.ok) throw new Error(data?.error_description || data?.error || "token_refresh_failed");
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
  handover_received: "handover.received",
  deal_created: "deal.created",
  deal_unstaffed: "deal.unstaffed_7d",
  mbr_reminder: "mbr.missing_prev_month",
  rgy_stale: "rgy.stale_7d",
  rgy_alert: "rgy.alert",
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

  if (ev === "rgy_alert") {
    const recips = input.recipients?.length
      ? input.recipients
      : await lookupEmailsByNames(admin, dealLeadershipNames(deal));
    if (recips.length === 0) return null;
    const status = String(input.payload?.status || "Red").toUpperCase();
    const dims = Array.isArray(input.payload?.dimensions)
      ? (input.payload!.dimensions as string[]).join(", ")
      : String(input.payload?.dimension || "");
    const rule = await loadRule(admin, "rgy.alert");
    const tctx: Record<string, string> = {
      "{deal_label}": label, "{account}": deal.account || "", "{deal_name}": deal.deal_name || "",
      "{status}": status, "{dimensions}": dims, "{vsd}": deal.vsd || "", "{bopm}": deal.bopm || "",
    };
    const sbj = rule?.subject_template?.trim() ? applyTokens(rule.subject_template, tctx) : null;
    const intro = rule?.body_template?.trim() ? applyTokens(rule.body_template, tctx) : null;
    return {
      to: recips,
      subject: sbj || `RGY ${status === "R" ? "Red" : status === "Y" ? "Yellow" : status} - ${label}`,
      html: layout({
        title: `RGY moved to ${status === "R" ? "Red" : status === "Y" ? "Yellow" : status}`,
        intro: intro || `<b>${escapeHtml(label)}</b> has a new ${escapeHtml(status === "R" ? "Red" : status === "Y" ? "Yellow" : status)} RGY signal. Please review and log the action plan in Pepper CX.`,
        rows: [
          ["Account", deal.account || ""],
          ["Deal", deal.deal_name || ""],
          ["Dimensions", dims],
          ["VSD", deal.vsd || ""],
          ["BOPM", deal.bopm || ""],
        ],
        ctaLabel: "Open RGY Health",
        ctaHref: `${APP_ORIGIN}/rgy`,
      }),
    };
  }

  if (ev === "mbr_reminder") {
    const recips = input.recipients?.length
      ? input.recipients
      : await lookupEmailsByNames(admin, dealLeadershipNames(deal));
    if (recips.length === 0) return null;
    const month = String(input.payload?.month || "");
    const rule = await loadRule(admin, "mbr.missing_prev_month");
    const tctx: Record<string, string> = {
      "{deal_label}": label, "{account}": deal.account || "", "{deal_name}": deal.deal_name || "",
      "{month}": month, "{vsd}": deal.vsd || "", "{bopm}": deal.bopm || "",
    };
    const sbj = rule?.subject_template?.trim() ? applyTokens(rule.subject_template, tctx) : null;
    const intro = rule?.body_template?.trim() ? applyTokens(rule.body_template, tctx) : null;
    return {
      to: recips,
      subject: sbj || `MBR pending - ${label}${month ? ` (${month})` : ""}`,
      html: layout({
        title: `MBR pending for ${escapeHtml(label)}`,
        intro: intro || `The Monthly Business Review for <b>${escapeHtml(label)}</b> is still pending${month ? ` for <b>${escapeHtml(month)}</b>` : ""}. Please schedule and log it in Pepper CX.`,
        rows: [
          ["Account", deal.account || ""],
          ["Deal", deal.deal_name || ""],
          ["Month", month],
          ["VSD", deal.vsd || ""],
          ["BOPM", deal.bopm || ""],
        ],
        ctaLabel: "Open MBR Tracker",
        ctaHref: `${APP_ORIGIN}/mbr`,
      }),
    };
  }

  if (ev === "deal_created" || ev === "deal_unstaffed" || ev === "rgy_stale") {
    const rule = await loadRule(admin, EVENT_TO_RULE[ev]);
    if (rule && !rule.enabled) return null;
    const recips = await expandTokens(admin, [...(rule?.to_tokens || []), ...(rule?.extra_to || [])], { deal });
    if (recips.length === 0) return null;
    const titleMap: Record<string, string> = {
      deal_created: `New deal created - ${label}`,
      deal_unstaffed: `Deal awaiting staffing - ${label}`,
      rgy_stale: `RGY update pending - ${label}`,
    };
    const introMap: Record<string, string> = {
      deal_created: `A new deal <b>${escapeHtml(label)}</b> has been created in Pepper CX.`,
      deal_unstaffed: `<b>${escapeHtml(label)}</b> has been active for 7+ days without a staffing assignment. Please staff the deal.`,
      rgy_stale: `RGY for <b>${escapeHtml(label)}</b> hasn't been updated in 7+ days. Please log the latest status.`,
    };
    const ctaMap: Record<string, [string, string]> = {
      deal_created: ["Open deal", link],
      deal_unstaffed: ["Open in Staffing", `${APP_ORIGIN}/staffing?tab=staffing&deal=${encodeURIComponent(deal.id)}`],
      rgy_stale: ["Open RGY Health", `${APP_ORIGIN}/rgy`],
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
      const sampleCtx: Record<string, string> = {
        "{deal_label}": "Acme Corp - Pepper Creative",
        "{account}": "Acme Corp",
        "{deal_name}": "Pepper Creative",
        "{capability}": "Creative",
        "{vsd}": "Sample VSD",
        "{bopm}": "Sample BOPM",
        "{assignee}": "Sample Person",
        "{role}": "Account Manager",
        "{pct}": "50%",
        "{status}": "Red",
        "{dimensions}": "Delivery, Sentiment",
        "{month}": new Date().toISOString().slice(0, 7),
        "{company}": "Acme Corp",
        "{submitter}": "Sales Lead",
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
        return json({ error: msg }, msg === "central_mailbox_not_connected" ? 412 : 500);
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
      if (msg === "central_mailbox_not_connected" || msg === "gmail_oauth_not_configured") {
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
    const status = msg === "unauthorized" ? 401 : msg === "central_mailbox_not_connected" ? 412 : 500;
    return json({ error: msg }, status);
  }
});