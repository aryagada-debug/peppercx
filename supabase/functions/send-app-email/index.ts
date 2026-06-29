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
function layout({ title, intro, rows, ctaLabel, ctaHref, footerNote }: {
  title: string; intro: string;
  rows: Array<[string, string]>;
  ctaLabel?: string; ctaHref?: string; footerNote?: string;
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
        </td></tr>
        <tr><td style="padding:14px 22px;border-top:1px solid ${BRAND_BORDER};background:${BRAND_BG};">
          <p style="margin:0;font-size:11px;color:${BRAND_MUTED};line-height:1.5;">${escapeHtml(footerNote || "Automated notification from Pepper CX. Reply to this email to reach the central CX team.")}</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

type DealRow = {
  id: string; account: string | null; deal_name: string | null;
  vsd: string | null; principal_bopm: string | null; senior_bopm: string | null; bopm: string | null;
};

async function loadDeal(admin: SupabaseClient, dealId: string): Promise<DealRow | null> {
  const { data } = await admin
    .from("staffing_deals")
    .select("id, account, deal_name, vsd, principal_bopm, senior_bopm, bopm")
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
  return [d.account, d.deal_name].filter(Boolean).join(" — ") || d.id;
}

function formatPct(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) ? `${v}%` : "—";
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
        handover_submitted: `New sales handover — ${company}`,
        handover_partial: `Handover update — ${company}`,
        handover_completed: `Handover completed — ${company}`,
      };
      const introMap: Record<string, string> = {
        handover_submitted: `A new sales handover has been submitted for <b>${escapeHtml(company)}</b>. Priyanka please add Deal ID & Name. Anirudh please confirm the VSD.`,
        handover_partial: `An update was made on the handover for <b>${escapeHtml(company)}</b>. Your action may be next.`,
        handover_completed: `The handover for <b>${escapeHtml(company)}</b> is complete — the deal has been created in Clients & Deals.`,
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
      subject: "Pepper CX — Central mailbox test",
      html: layout({
        title: "Central mailbox is working",
        intro: "This is a test message sent from the central CX mailbox. If you received it, notifications are good to go.",
        rows: [["Sent at", new Date().toISOString()]],
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
    const pct = formatPct(input.payload?.allocationPct);
    const role = String(input.payload?.roleKey || "").replace(/_/g, " ");
    if (ev === "staffed") {
      return {
        to: [person.email],
        subject: `You've been staffed on ${label}`,
        html: layout({
          title: `You're staffed on ${escapeHtml(label)}`,
          intro: `Hi ${escapeHtml(person.name || "")}, you've been added to <b>${escapeHtml(label)}</b> at <b>${escapeHtml(pct)}</b> bandwidth.`,
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
          title: `Staffing updated — ${escapeHtml(label)}`,
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
    return {
      to: recips,
      subject: `RGY ${status === "R" ? "Red" : status === "Y" ? "Yellow" : status} — ${label}`,
      html: layout({
        title: `RGY moved to ${status === "R" ? "Red" : status === "Y" ? "Yellow" : status}`,
        intro: `<b>${escapeHtml(label)}</b> has a new ${escapeHtml(status === "R" ? "Red" : status === "Y" ? "Yellow" : status)} RGY signal. Please review and log the action plan in Pepper CX.`,
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
    return {
      to: recips,
      subject: `MBR pending — ${label}${month ? ` (${month})` : ""}`,
      html: layout({
        title: `MBR pending for ${escapeHtml(label)}`,
        intro: `The Monthly Business Review for <b>${escapeHtml(label)}</b> is still pending${month ? ` for <b>${escapeHtml(month)}</b>` : ""}. Please schedule and log it in Pepper CX.`,
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
        const raw = buildRaw({ to: built.to, subject: built.subject, html: built.html, from: fromEmail });
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
        const logRows = built.to.map((r) => ({
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
        results.push({ event: inp.event, ok, id: data?.id, to: built.to, error: ok ? null : data?.error?.message });
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