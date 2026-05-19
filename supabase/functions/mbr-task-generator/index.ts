// Daily MBR task generator
// 1) Scheduling pending: for any Active deal that has been active for >=30 days
//    and has no scheduled MBR for the current month, create a "Schedule MBR" task.
// 2) Update overdue: for any mbr_entries row whose scheduled_date is in the past
//    by > 24h with status != 'Done' and no notes, create an "Update MBR notes" task.
// Deduped via mbr_reminder_log on (mbr_entry_id, reminder_type, sent_date).
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") || "https://peppercx.lovable.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ACTIVE_STATUSES = new Set(["Active Deal", "Deal Disputed"]);

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, days: number) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + days); return x; }
function monthStart(d: Date) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); }
function monthEnd(d: Date) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)); }

async function dedupedLogged(admin: any, entryId: string | null, type: string, today: string) {
  if (!entryId) return false;
  const { data } = await admin
    .from("mbr_reminder_log")
    .select("id")
    .eq("mbr_entry_id", entryId)
    .eq("reminder_type", type)
    .eq("sent_date", today)
    .limit(1);
  return Boolean(data && data.length > 0);
}

async function logSent(admin: any, entryId: string, type: string, today: string) {
  await admin.from("mbr_reminder_log").insert({ mbr_entry_id: entryId, reminder_type: type, sent_date: today, channel_id: "" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStr = ymd(today);
    const thirtyDaysAgo = addDays(today, -30);
    const mStart = ymd(monthStart(today));
    const mEnd = ymd(monthEnd(today));
    const daysToMonthEnd = Math.ceil((monthEnd(today).getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    const isEndOfMonthWindow = daysToMonthEnd <= 7; // create Schedule MBR tasks only in the last week

    // ── Part 1: scheduling pending ─────────────────────────────
    const { data: deals } = await admin
      .from("staffing_deals")
      .select("id, deal_id, deal_name, account, deal_status, start_date, principal_bopm, senior_bopm, bopm");

    const eligible = (deals || []).filter(d => {
      if (!ACTIVE_STATUSES.has(d.deal_status || "")) return false;
      if (!d.start_date) return true;
      return new Date(d.start_date) <= thirtyDaysAgo;
    });

    let p1Created = 0;
    if (eligible.length > 0) {
      const ids = eligible.map(d => d.id);
      const { data: scheduled } = await admin
        .from("mbr_entries")
        .select("id, deal_id, scheduled_date")
        .in("deal_id", ids)
        .gte("scheduled_date", mStart)
        .lte("scheduled_date", mEnd)
        .not("scheduled_date", "is", null);
      const hasSchedule = new Set((scheduled || []).map(r => r.deal_id));

      // Auto-close any open Schedule MBR auto-tasks for deals that now have a schedule.
      if (hasSchedule.size > 0) {
        await admin
          .from("deal_tasks")
          .update({ stage: "Done" })
          .in("deal_id", Array.from(hasSchedule))
          .eq("phase", "MBR")
          .neq("stage", "Done")
          .ilike("title", "Schedule MBR%");
      }

      for (const d of eligible) {
        if (hasSchedule.has(d.id)) continue;
        if (!isEndOfMonthWindow) continue;
        const assignee = d.principal_bopm || d.senior_bopm || d.bopm || "";
        if (!assignee) continue;

        // Dedupe against any auto-gen Schedule-MBR task for this deal this month
        // (regardless of stage) so we never recreate.
        const { data: existing } = await admin
          .from("deal_tasks")
          .select("id")
          .eq("deal_id", d.id)
          .eq("phase", "MBR")
          .ilike("title", "Schedule MBR%")
          .gte("created_at", `${mStart}T00:00:00Z`)
          .limit(1);
        if (existing && existing.length > 0) continue;

        const due = mEnd;
        const recordUrl = `${APP_ORIGIN}/deals/${d.id}?tab=MBR&action=record`;
        const { error: tErr } = await admin.from("deal_tasks").insert({
          deal_id: d.id,
          title: `Schedule MBR — ${d.deal_name || d.deal_id}`,
          description: `<p>Auto-generated: no MBR is scheduled for ${mStart.slice(0, 7)}. Please schedule a session.</p><p>Record the MBR directly: <a href="${recordUrl}" target="_blank" rel="noopener noreferrer">Open MBR recorder</a></p>`,
          assignee,
          stage: "To Do",
          urgency: "High",
          phase: "MBR",
          auto_regen: false,
          end_date: due,
        } as any);
        if (!tErr) p1Created++;
      }
    }

    // ── Part 2: update overdue ────────────────────────────────
    const oneDayAgo = addDays(today, -1);
    const { data: overdue } = await admin
      .from("mbr_entries")
      .select("id, deal_id, scheduled_date, status, notes")
      .lt("scheduled_date", ymd(oneDayAgo))
      .neq("status", "Done");

    let p2Created = 0;
    for (const e of overdue || []) {
      if (e.notes && e.notes.trim().length > 0) continue;
      // Look up deal owner
      const { data: deal } = await admin
        .from("staffing_deals")
        .select("id, deal_name, deal_id, principal_bopm, senior_bopm, bopm")
        .eq("id", e.deal_id)
        .single();
      if (!deal) continue;
      const assignee = deal.principal_bopm || deal.senior_bopm || deal.bopm || "";
      if (!assignee) continue;

      if (await dedupedLogged(admin, e.id, "update_overdue", todayStr)) continue;

      const { data: existingT } = await admin
        .from("deal_tasks")
        .select("id")
        .eq("deal_id", e.deal_id)
        .eq("assignee", assignee)
        .eq("phase", "MBR")
        .neq("stage", "Done")
        .ilike("title", "Update MBR%")
        .limit(1);
      if (existingT && existingT.length > 0) continue;

      const due = ymd(addDays(today, 1));
      const recordUrl = `${APP_ORIGIN}/deals/${e.deal_id}?tab=MBR&action=record`;
      const { error: tErr } = await admin.from("deal_tasks").insert({
        deal_id: e.deal_id,
        title: `Update MBR notes — ${deal.deal_name || deal.deal_id}`,
        description: `<p>Auto-generated: scheduled MBR on ${e.scheduled_date} hasn't been updated in the app. Please add notes & sentiment.</p><p>Record the MBR directly: <a href="${recordUrl}" target="_blank" rel="noopener noreferrer">Open MBR recorder</a></p>`,
        assignee,
        stage: "To Do",
        urgency: "High",
        phase: "MBR",
        auto_regen: false,
        end_date: due,
      } as any);
      if (!tErr) {
        await logSent(admin, e.id, "update_overdue", todayStr);
        p2Created++;
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      schedulingTasksCreated: p1Created,
      updateTasksCreated: p2Created,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[mbr-task-generator]", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});