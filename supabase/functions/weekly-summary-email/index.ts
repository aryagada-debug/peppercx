// Weekly role-scoped summary email.
// Triggered by pg_cron every Monday 10:00 IST (04:30 UTC).
// Body: { dryRun?: boolean, onlyEmail?: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://peppercx.lovable.app";
const FROM_EMAIL = Deno.env.get("WEEKLY_SUMMARY_FROM") || "centralcx@peppercontent.io";
const FROM_NAME = "Pepper CX";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Role = "admin" | "vsd" | "bopm" | "other";

function pad(n: number) { return String(n).padStart(2, "0"); }
function fmtDate(d: Date) { return `${pad(d.getDate())} ${d.toLocaleString("en-US", { month: "short" })}`; }

// Compute previous Monday → Sunday window (IST). We approximate by using the
// runtime UTC and shifting; cron runs at fixed Monday 04:30 UTC so this is safe.
function prevWeekWindow(): { start: string; end: string; label: string } {
  const now = new Date();
  // IST = UTC + 5:30
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const day = istNow.getUTCDay(); // 0=Sun..6=Sat (treat as IST since shifted)
  // Monday this IST week 00:00
  const diffToMon = (day + 6) % 7;
  const thisMonIst = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()));
  thisMonIst.setUTCDate(thisMonIst.getUTCDate() - diffToMon);
  // Previous Monday & Sunday
  const prevMon = new Date(thisMonIst); prevMon.setUTCDate(prevMon.getUTCDate() - 7);
  const prevSun = new Date(prevMon); prevSun.setUTCDate(prevSun.getUTCDate() + 7);
  const startIso = prevMon.toISOString();
  const endIso = prevSun.toISOString();
  return { start: startIso, end: endIso, label: `${fmtDate(prevMon)} → ${fmtDate(new Date(prevSun.getTime() - 1))}` };
}

function eq(a?: string | null, b?: string | null) {
  return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
}

async function sendEmail(to: string, subject: string, html: string) {
  // Use Lovable Email infra: send-transactional-email function (created by scaffold_transactional_email).
  const r = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}` },
    body: JSON.stringify({ to, from: `${FROM_NAME} <${FROM_EMAIL}>`, subject, html }),
  });
  return { ok: r.ok, status: r.status, text: r.ok ? "" : await r.text() };
}

function htmlEscape(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function renderEmail(opts: {
  firstName: string;
  windowLabel: string;
  done: { tasks: number; mbrsScheduled: number; mbrsRecorded: number; rgyUpdates: number };
  todo: { tasksOverdue: number; mbrsToSchedule: number; mbrsToRecord: number; rgyStale: number };
  scopeLabel: string;
  bopmBreakdown?: { name: string; deals: number; tasksDone: number; tasksOverdue: number; mbrsRecorded: number; mbrsToRecord: number; rgyStale: number }[];
}) {
  const { firstName, windowLabel, done, todo, scopeLabel, bopmBreakdown } = opts;
  const row = (label: string, n: number, color: string) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#333">${htmlEscape(label)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:${color};text-align:right;font-weight:500">${n}</td>
    </tr>`;
  const bopmRows = (bopmBreakdown || []).map((b) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#222">${htmlEscape(b.name)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#666;text-align:right">${b.deals}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#16a34a;text-align:right">${b.tasksDone}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#dc2626;text-align:right">${b.tasksOverdue}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#16a34a;text-align:right">${b.mbrsRecorded}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#dc2626;text-align:right">${b.mbrsToRecord}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#dc2626;text-align:right">${b.rgyStale}</td>
    </tr>`).join("");
  const bopmSection = bopmBreakdown && bopmBreakdown.length ? `
    <h3 style="font-size:14px;margin:24px 0 8px;color:#333">Per BOPM breakdown</h3>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eee;border-radius:8px;overflow:hidden">
      <thead><tr style="background:#fafafa">
        <th style="text-align:left;padding:8px 10px;font-size:11px;color:#666;font-weight:500">BOPM</th>
        <th style="text-align:right;padding:8px 10px;font-size:11px;color:#666;font-weight:500">Deals</th>
        <th style="text-align:right;padding:8px 10px;font-size:11px;color:#666;font-weight:500">Tasks done</th>
        <th style="text-align:right;padding:8px 10px;font-size:11px;color:#666;font-weight:500">Overdue</th>
        <th style="text-align:right;padding:8px 10px;font-size:11px;color:#666;font-weight:500">MBRs recorded</th>
        <th style="text-align:right;padding:8px 10px;font-size:11px;color:#666;font-weight:500">MBRs to record</th>
        <th style="text-align:right;padding:8px 10px;font-size:11px;color:#666;font-weight:500">RGY stale</th>
      </tr></thead>
      <tbody>${bopmRows}</tbody>
    </table>` : "";

  return `<!doctype html><html><body style="margin:0;background:#f7f7fb;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
    <div style="max-width:640px;margin:0 auto;padding:24px">
      <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #ececf1">
        <p style="font-size:12px;color:#7c3aed;margin:0 0 4px;letter-spacing:.5px;text-transform:uppercase;font-weight:500">Weekly summary · ${htmlEscape(windowLabel)}</p>
        <h1 style="font-size:20px;margin:0 0 4px;color:#111">Hi ${htmlEscape(firstName)},</h1>
        <p style="font-size:13px;color:#666;margin:0 0 18px">${htmlEscape(scopeLabel)}</p>

        <h3 style="font-size:14px;margin:18px 0 6px;color:#333">✅ Done this week</h3>
        <table style="width:100%;border-collapse:collapse;background:#fafafa;border:1px solid #eee;border-radius:8px;overflow:hidden">
          ${row("Tasks completed", done.tasks, "#16a34a")}
          ${row("MBRs scheduled", done.mbrsScheduled, "#16a34a")}
          ${row("MBRs recorded", done.mbrsRecorded, "#16a34a")}
          ${row("RGY updates", done.rgyUpdates, "#16a34a")}
        </table>

        <h3 style="font-size:14px;margin:18px 0 6px;color:#333">⚠ Needs your attention</h3>
        <table style="width:100%;border-collapse:collapse;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;overflow:hidden">
          ${row("Tasks overdue", todo.tasksOverdue, "#dc2626")}
          ${row("MBRs to schedule", todo.mbrsToSchedule, "#dc2626")}
          ${row("MBRs to record", todo.mbrsToRecord, "#dc2626")}
          ${row("RGY stale (>14 days)", todo.rgyStale, "#dc2626")}
        </table>

        ${bopmSection}

        <div style="margin-top:24px">
          <a href="${APP_URL}/home" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500">Open dashboard</a>
        </div>
        <p style="font-size:11px;color:#999;margin-top:24px">You receive this because you have a Pepper CX account. Manage preferences in Settings → Notifications.</p>
      </div>
    </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    let dryRun = false, onlyEmail: string | null = null;
    try {
      const b = await req.json();
      if (b?.dryRun === true) dryRun = true;
      if (typeof b?.onlyEmail === "string") onlyEmail = b.onlyEmail.toLowerCase();
    } catch { /* no body */ }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const win = prevWeekWindow();

    // 1. Pull all needed reference data once.
    const [{ data: people }, { data: deals }, { data: roles }, { data: profiles }] = await Promise.all([
      admin.from("staffing_people").select("id, name, email, role_category, reporting_manager, leaving, tbh"),
      admin.from("staffing_deals").select("id, deal_id, deal_name, vsd, principal_bopm, senior_bopm, bopm, deal_status"),
      admin.from("user_roles").select("user_id, role"),
      admin.from("profiles").select("user_id, display_name, staffing_person_id, weekly_summary_opt_in"),
    ]);

    // Need auth users for emails — query via admin API.
    const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authUsers = authList?.users || [];

    const adminUserIds = new Set((roles || []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id));
    const personById = new Map((people || []).map((p: any) => [p.id, p] as [string, any]));
    const personByEmail = new Map((people || []).filter((p: any) => p.email).map((p: any) => [String(p.email).toLowerCase(), p] as [string, any]));

    // Fetch event data for window once and bucket per deal.
    const [{ data: tasksDone }, { data: tasksOpen }, { data: mbrEntries }, { data: rgyWeekly }] = await Promise.all([
      admin.from("deal_tasks").select("deal_id, stage, end_date, updated_at").gte("updated_at", win.start).lt("updated_at", win.end).ilike("stage", "%done%"),
      admin.from("deal_tasks").select("deal_id, stage, end_date").not("stage", "ilike", "%done%"),
      admin.from("mbr_entries").select("deal_id, status, week_start, notes, updated_at, created_at"),
      admin.from("deal_rgy_weekly").select("deal_id, week_start, updated_at, customer, internal, delivery, consumption"),
    ]);

    const todayIso = new Date().toISOString();

    // Build per-deal counts.
    type DealStats = { deals: number; tasksDone: number; tasksOverdue: number; mbrsScheduled: number; mbrsRecorded: number; mbrsToSchedule: number; mbrsToRecord: number; rgyUpdates: number; rgyStale: number };
    function emptyStats(): DealStats { return { deals: 0, tasksDone: 0, tasksOverdue: 0, mbrsScheduled: 0, mbrsRecorded: 0, mbrsToSchedule: 0, mbrsToRecord: 0, rgyUpdates: 0, rgyStale: 0 }; }
    function statsForDeals(dealIds: Set<string>): DealStats {
      const s = emptyStats();
      s.deals = dealIds.size;
      s.tasksDone = (tasksDone || []).filter((t: any) => dealIds.has(t.deal_id)).length;
      s.tasksOverdue = (tasksOpen || []).filter((t: any) => dealIds.has(t.deal_id) && t.end_date && t.end_date < todayIso.slice(0, 10)).length;
      const inWin = (d?: string | null) => !!d && d >= win.start && d < win.end;
      // MBR: scheduled = created within window; recorded = notes present and updated within window.
      const mbrInWin = (mbrEntries || []).filter((m: any) => dealIds.has(m.deal_id));
      s.mbrsScheduled = mbrInWin.filter((m: any) => inWin(m.created_at)).length;
      s.mbrsRecorded = mbrInWin.filter((m: any) => inWin(m.updated_at) && (m.notes || "").trim().length > 0).length;
      // To-do: count of distinct deals with no MBR in past 30 days.
      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
      const dealsWithRecentMbr = new Set(mbrInWin.filter((m: any) => m.updated_at >= cutoff).map((m: any) => m.deal_id));
      s.mbrsToSchedule = Array.from(dealIds).filter((d) => !dealsWithRecentMbr.has(d)).length;
      s.mbrsToRecord = mbrInWin.filter((m: any) => (m.status === "scheduled" || m.status === "Scheduled") && (!m.notes || !m.notes.trim())).length;
      // RGY: updates in window; stale = no row in last 14 days.
      const rgyByDeal = new Map<string, string>();
      (rgyWeekly || []).forEach((r: any) => {
        if (!dealIds.has(r.deal_id)) return;
        const cur = rgyByDeal.get(r.deal_id) || "";
        if ((r.updated_at || "") > cur) rgyByDeal.set(r.deal_id, r.updated_at || "");
      });
      s.rgyUpdates = (rgyWeekly || []).filter((r: any) => dealIds.has(r.deal_id) && r.updated_at >= win.start && r.updated_at < win.end).length;
      const staleCutoff = new Date(Date.now() - 14 * 86400000).toISOString();
      s.rgyStale = Array.from(dealIds).filter((d) => (rgyByDeal.get(d) || "") < staleCutoff).length;
      return s;
    }

    // Determine recipients (admins, VSDs, BOPMs only).
    const results: any[] = [];
    for (const u of authUsers) {
      const email = (u.email || "").toLowerCase();
      if (!email) continue;
      if (onlyEmail && email !== onlyEmail) continue;
      const profile = (profiles || []).find((p: any) => p.user_id === u.id);
      if (profile && profile.weekly_summary_opt_in === false) continue;
      const isAdmin = adminUserIds.has(u.id);
      const person = profile?.staffing_person_id ? personById.get(profile.staffing_person_id) : personByEmail.get(email);
      const cat = (person?.role_category || "").toLowerCase();
      let role: Role = "other";
      if (isAdmin) role = "admin";
      else if (cat.includes("vsd")) role = "vsd";
      else if (cat.includes("bopm")) role = "bopm";
      if (role === "other") continue;

      const firstName = (profile?.display_name || person?.name || email.split("@")[0]).split(" ")[0];

      // Scope deals.
      let dealIds = new Set<string>();
      let scopeLabel = "";
      let bopmBreakdown: any[] | undefined;
      if (role === "admin") {
        dealIds = new Set((deals || []).map((d: any) => d.id));
        scopeLabel = `All ${dealIds.size} active deals across all VSDs and BOPMs.`;
        // Per-VSD breakdown for admin.
        const vsdNames = Array.from(new Set((deals || []).map((d: any) => (d.vsd || "").trim()).filter(Boolean)));
        bopmBreakdown = vsdNames.slice(0, 25).map((nm) => {
          const ids = new Set((deals || []).filter((d: any) => eq(d.vsd, nm)).map((d: any) => d.id));
          const s = statsForDeals(ids);
          return { name: nm, deals: s.deals, tasksDone: s.tasksDone, tasksOverdue: s.tasksOverdue, mbrsRecorded: s.mbrsRecorded, mbrsToRecord: s.mbrsToRecord, rgyStale: s.rgyStale };
        });
      } else if (role === "vsd") {
        dealIds = new Set((deals || []).filter((d: any) => eq(d.vsd, person?.name)).map((d: any) => d.id));
        scopeLabel = `Your team's ${dealIds.size} deals across the BOPMs reporting to you.`;
        // Per-BOPM under this VSD.
        const bopmsUnder = (people || []).filter((p: any) => !p.leaving && !p.tbh && eq(p.reporting_manager, person?.name));
        bopmBreakdown = bopmsUnder.slice(0, 30).map((b: any) => {
          const ids = new Set((deals || []).filter((d: any) => eq(d.principal_bopm, b.name) || eq(d.senior_bopm, b.name) || eq(d.bopm, b.name)).map((d: any) => d.id));
          const s = statsForDeals(ids);
          return { name: b.name, deals: s.deals, tasksDone: s.tasksDone, tasksOverdue: s.tasksOverdue, mbrsRecorded: s.mbrsRecorded, mbrsToRecord: s.mbrsToRecord, rgyStale: s.rgyStale };
        }).filter((b) => b.deals > 0);
      } else {
        dealIds = new Set((deals || []).filter((d: any) => eq(d.principal_bopm, person?.name) || eq(d.senior_bopm, person?.name) || eq(d.bopm, person?.name)).map((d: any) => d.id));
        scopeLabel = `Your ${dealIds.size} deals where you're tagged as BOPM.`;
      }

      const stats = statsForDeals(dealIds);
      const html = renderEmail({
        firstName,
        windowLabel: win.label,
        scopeLabel,
        done: { tasks: stats.tasksDone, mbrsScheduled: stats.mbrsScheduled, mbrsRecorded: stats.mbrsRecorded, rgyUpdates: stats.rgyUpdates },
        todo: { tasksOverdue: stats.tasksOverdue, mbrsToSchedule: stats.mbrsToSchedule, mbrsToRecord: stats.mbrsToRecord, rgyStale: stats.rgyStale },
        bopmBreakdown,
      });
      const subject = `Your week at Pepper · ${win.label}`;
      if (dryRun) {
        results.push({ email, role, deals: dealIds.size, sent: false, dryRun: true, subjectPreview: subject });
      } else {
        const r = await sendEmail(email, subject, html);
        results.push({ email, role, deals: dealIds.size, sent: r.ok, status: r.status, error: r.text || undefined });
      }
    }

    return json({ ok: true, window: win, count: results.length, results });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
