// Weekly role-scoped summary — sends a Slack DM to each opted-in user.
// Triggered by pg_cron every Monday 10:00 IST (04:30 UTC).
// Body: { dryRun?: boolean, onlyEmail?: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") || "";
const APP_URL = Deno.env.get("APP_URL") || "https://peppercx.lovable.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Role = "admin" | "vsd" | "bopm" | "other";
const eq = (a?: string | null, b?: string | null) =>
  (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${pad(d.getUTCDate())} ${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}`;

function prevWeekWindow() {
  const now = new Date();
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const day = istNow.getUTCDay();
  const diffToMon = (day + 6) % 7;
  const thisMonIst = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()));
  thisMonIst.setUTCDate(thisMonIst.getUTCDate() - diffToMon);
  const prevMon = new Date(thisMonIst); prevMon.setUTCDate(prevMon.getUTCDate() - 7);
  const prevSun = new Date(prevMon); prevSun.setUTCDate(prevSun.getUTCDate() + 7);
  return {
    start: prevMon.toISOString(),
    end: prevSun.toISOString(),
    label: `${fmtDate(prevMon)} → ${fmtDate(new Date(prevSun.getTime() - 1))}`,
  };
}

async function slackApi(method: string, body: Record<string, unknown>) {
  const r = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function openDm(slackUserId: string): Promise<string | null> {
  const j = await slackApi("conversations.open", { users: slackUserId });
  if (!j.ok) return null;
  return j.channel?.id || null;
}

function renderBlocks(opts: {
  firstName: string;
  windowLabel: string;
  scopeLabel: string;
  done: { tasks: number; mbrsScheduled: number; mbrsRecorded: number; rgyUpdates: number };
  todo: { tasksOverdue: number; mbrsToSchedule: number; mbrsToRecord: number; rgyStale: number };
  bopmBreakdown?: { name: string; deals: number; tasksDone: number; tasksOverdue: number; mbrsRecorded: number; mbrsToRecord: number; rgyStale: number }[];
}) {
  const { firstName, windowLabel, scopeLabel, done, todo, bopmBreakdown } = opts;
  const padR = (s: string | number, w: number) => String(s).padEnd(w, " ");
  const padL = (n: number, w: number) => String(n).padStart(w, " ");
  const lines: string[] = [];
  lines.push(`Your week at Pepper   ${windowLabel}`);
  lines.push(`Hi ${firstName} - ${scopeLabel}`);
  lines.push("");
  lines.push("Done this week");
  lines.push(`  Tasks completed     ${padL(done.tasks, 4)}`);
  lines.push(`  MBRs scheduled      ${padL(done.mbrsScheduled, 4)}`);
  lines.push(`  MBRs recorded       ${padL(done.mbrsRecorded, 4)}`);
  lines.push(`  RGY updates         ${padL(done.rgyUpdates, 4)}`);
  lines.push("");
  lines.push("Needs your attention");
  lines.push(`  Tasks overdue       ${padL(todo.tasksOverdue, 4)}`);
  lines.push(`  MBRs to schedule    ${padL(todo.mbrsToSchedule, 4)}`);
  lines.push(`  MBRs to record      ${padL(todo.mbrsToRecord, 4)}`);
  lines.push(`  RGY stale (>14d)    ${padL(todo.rgyStale, 4)}`);
  if (bopmBreakdown && bopmBreakdown.length) {
    const nameW = Math.max(4, ...bopmBreakdown.map((b) => b.name.length));
    lines.push("");
    lines.push("Per-team breakdown");
    lines.push(`  ${padR("Name", nameW)}  Deals  TaskDone  TaskOver  MBRrec  MBRtodo  RGYstale`);
    for (const b of bopmBreakdown) {
      lines.push(
        `  ${padR(b.name, nameW)}  ${padL(b.deals, 5)}  ${padL(b.tasksDone, 8)}  ${padL(b.tasksOverdue, 8)}  ${padL(b.mbrsRecorded, 6)}  ${padL(b.mbrsToRecord, 7)}  ${padL(b.rgyStale, 8)}`
      );
    }
  }
  const body = "```\n" + lines.join("\n") + "\n```";
  return [
    { type: "section", text: { type: "mrkdwn", text: body } },
    {
      type: "actions",
      elements: [{ type: "button", text: { type: "plain_text", text: "Open dashboard" }, url: `${APP_URL}/home`, style: "primary" }],
    },
    { type: "context", elements: [{ type: "mrkdwn", text: "Manage preferences in Settings > Notifications." }] },
  ];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!SLACK_BOT_TOKEN) return json({ error: "SLACK_BOT_TOKEN not configured" }, 500);

    let dryRun = false, onlyEmail: string | null = null;
    try {
      const b = await req.json();
      if (b?.dryRun === true) dryRun = true;
      if (typeof b?.onlyEmail === "string") onlyEmail = b.onlyEmail.toLowerCase();
    } catch { /* no body */ }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const win = prevWeekWindow();

    const [{ data: people }, { data: deals }, { data: roles }, { data: profiles }] = await Promise.all([
      admin.from("staffing_people").select("id, name, email, role_category, reporting_manager, leaving, tbh, slack_user_id"),
      admin.from("staffing_deals").select("id, deal_id, deal_name, vsd, principal_bopm, senior_bopm, bopm, deal_status"),
      admin.from("user_roles").select("user_id, role"),
      admin.from("profiles").select("user_id, display_name, staffing_person_id, weekly_summary_opt_in"),
    ]);

    const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authUsers = authList?.users || [];

    const adminUserIds = new Set((roles || []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id));
    const personById = new Map((people || []).map((p: any) => [p.id, p] as [string, any]));
    const personByEmail = new Map((people || []).filter((p: any) => p.email).map((p: any) => [String(p.email).toLowerCase(), p] as [string, any]));

    const [{ data: tasksDone }, { data: tasksOpen }, { data: mbrEntries }, { data: rgyWeekly }] = await Promise.all([
      admin.from("deal_tasks").select("deal_id, stage, end_date, updated_at").gte("updated_at", win.start).lt("updated_at", win.end).ilike("stage", "%done%"),
      admin.from("deal_tasks").select("deal_id, stage, end_date").not("stage", "ilike", "%done%"),
      admin.from("mbr_entries").select("deal_id, status, week_start, notes, updated_at, created_at"),
      admin.from("deal_rgy_weekly").select("deal_id, week_start, updated_at, customer, internal, delivery, consumption"),
    ]);

    const todayIso = new Date().toISOString();
    type DealStats = { deals: number; tasksDone: number; tasksOverdue: number; mbrsScheduled: number; mbrsRecorded: number; mbrsToSchedule: number; mbrsToRecord: number; rgyUpdates: number; rgyStale: number };
    const empty = (): DealStats => ({ deals: 0, tasksDone: 0, tasksOverdue: 0, mbrsScheduled: 0, mbrsRecorded: 0, mbrsToSchedule: 0, mbrsToRecord: 0, rgyUpdates: 0, rgyStale: 0 });
    const inWin = (d?: string | null) => !!d && d >= win.start && d < win.end;
    function statsForDeals(dealIds: Set<string>): DealStats {
      const s = empty();
      s.deals = dealIds.size;
      s.tasksDone = (tasksDone || []).filter((t: any) => dealIds.has(t.deal_id)).length;
      s.tasksOverdue = (tasksOpen || []).filter((t: any) => dealIds.has(t.deal_id) && t.end_date && t.end_date < todayIso.slice(0, 10)).length;
      const mbrIn = (mbrEntries || []).filter((m: any) => dealIds.has(m.deal_id));
      s.mbrsScheduled = mbrIn.filter((m: any) => inWin(m.created_at)).length;
      s.mbrsRecorded = mbrIn.filter((m: any) => inWin(m.updated_at) && (m.notes || "").trim().length > 0).length;
      const cutoff30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const dealsWithRecent = new Set(mbrIn.filter((m: any) => m.updated_at >= cutoff30).map((m: any) => m.deal_id));
      s.mbrsToSchedule = Array.from(dealIds).filter((d) => !dealsWithRecent.has(d)).length;
      s.mbrsToRecord = mbrIn.filter((m: any) => (m.status === "scheduled" || m.status === "Scheduled") && (!m.notes || !m.notes.trim())).length;
      const rgyByDeal = new Map<string, string>();
      (rgyWeekly || []).forEach((r: any) => {
        if (!dealIds.has(r.deal_id)) return;
        const cur = rgyByDeal.get(r.deal_id) || "";
        if ((r.updated_at || "") > cur) rgyByDeal.set(r.deal_id, r.updated_at || "");
      });
      s.rgyUpdates = (rgyWeekly || []).filter((r: any) => dealIds.has(r.deal_id) && r.updated_at >= win.start && r.updated_at < win.end).length;
      const stale14 = new Date(Date.now() - 14 * 86400000).toISOString();
      s.rgyStale = Array.from(dealIds).filter((d) => (rgyByDeal.get(d) || "") < stale14).length;
      return s;
    }

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

      const slackUserId = person?.slack_user_id || null;
      if (!slackUserId) {
        results.push({ email, role, sent: false, error: "no_slack_user_id" });
        continue;
      }

      const firstName = (profile?.display_name || person?.name || email.split("@")[0]).split(" ")[0];
      let dealIds = new Set<string>();
      let scopeLabel = "";
      let bopmBreakdown: any[] | undefined;
      if (role === "admin") {
        dealIds = new Set((deals || []).map((d: any) => d.id));
        scopeLabel = `all ${dealIds.size} active deals across every VSD and BOPM.`;
        const activeVsds = (people || []).filter((p: any) => !p.leaving && !p.tbh && (p.role_category || "").toLowerCase().includes("vsd"));
        const vsdNames = activeVsds.map((p: any) => p.name).filter(Boolean);
        bopmBreakdown = vsdNames.map((nm: string) => {
          const ids = new Set((deals || []).filter((d: any) => eq(d.vsd, nm)).map((d: any) => d.id));
          const s = statsForDeals(ids);
          return { name: nm, deals: s.deals, tasksDone: s.tasksDone, tasksOverdue: s.tasksOverdue, mbrsRecorded: s.mbrsRecorded, mbrsToRecord: s.mbrsToRecord, rgyStale: s.rgyStale };
        }).filter((b) => b.deals > 0);
      } else if (role === "vsd") {
        dealIds = new Set((deals || []).filter((d: any) => eq(d.vsd, person?.name)).map((d: any) => d.id));
        scopeLabel = `your team's ${dealIds.size} deals across the BOPMs reporting to you.`;
        const under = (people || []).filter((p: any) => !p.leaving && !p.tbh && eq(p.reporting_manager, person?.name));
        bopmBreakdown = under.slice(0, 30).map((b: any) => {
          const ids = new Set((deals || []).filter((d: any) => eq(d.principal_bopm, b.name) || eq(d.senior_bopm, b.name) || eq(d.bopm, b.name)).map((d: any) => d.id));
          const s = statsForDeals(ids);
          return { name: b.name, deals: s.deals, tasksDone: s.tasksDone, tasksOverdue: s.tasksOverdue, mbrsRecorded: s.mbrsRecorded, mbrsToRecord: s.mbrsToRecord, rgyStale: s.rgyStale };
        }).filter((b) => b.deals > 0);
      } else {
        dealIds = new Set((deals || []).filter((d: any) => eq(d.principal_bopm, person?.name) || eq(d.senior_bopm, person?.name) || eq(d.bopm, person?.name)).map((d: any) => d.id));
        scopeLabel = `your ${dealIds.size} deals where you're tagged as BOPM.`;
      }

      const stats = statsForDeals(dealIds);
      const blocks = renderBlocks({
        firstName, windowLabel: win.label, scopeLabel,
        done: { tasks: stats.tasksDone, mbrsScheduled: stats.mbrsScheduled, mbrsRecorded: stats.mbrsRecorded, rgyUpdates: stats.rgyUpdates },
        todo: { tasksOverdue: stats.tasksOverdue, mbrsToSchedule: stats.mbrsToSchedule, mbrsToRecord: stats.mbrsToRecord, rgyStale: stats.rgyStale },
        bopmBreakdown,
      });
      const fallback = `Your week at Pepper · ${win.label}`;

      if (dryRun) {
        results.push({ email, role, deals: dealIds.size, sent: false, dryRun: true, slackUserId });
        continue;
      }

      const dmChannel = await openDm(slackUserId);
      if (!dmChannel) {
        results.push({ email, role, sent: false, error: "open_dm_failed" });
        continue;
      }
      const post = await slackApi("chat.postMessage", { channel: dmChannel, text: fallback, blocks });
      results.push({ email, role, deals: dealIds.size, sent: !!post.ok, error: post.ok ? undefined : post.error });
    }

    return json({ ok: true, window: win, count: results.length, results });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});