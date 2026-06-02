// Staffing capacity reminders — Slack DMs to people for:
// - mode=weekly: every Monday, ask everyone to confirm their capacity for the week
// - mode=start: when an assignment's start_date == today, nudge the assignee
// - mode=end:   when an assignment's end_date == today, nudge the assignee that it ended
// Idempotent per (person, deal, type, date) via staffing_reminder_log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") || "";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://id-preview--f5822717-2a1e-4473-97d8-aefa7ee45cc2.lovable.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function dmUser(slackUserId: string, text: string) {
  const r = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: slackUserId,
      text,
      username: "VSD-OS",
      icon_emoji: ":bell:",
    }),
  });
  return await r.json();
}

type Mode = "weekly" | "start" | "end";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!SLACK_BOT_TOKEN) throw new Error("SLACK_BOT_TOKEN not configured");
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const url = new URL(req.url);
    const mode = (url.searchParams.get("mode") || "weekly") as Mode;
    const today = ymd(new Date());

    const sent: Array<{ person_id: string; deal_id: string; type: string }> = [];
    const skipped: Array<{ person_id: string; reason: string }> = [];

    // Helper: check log + send
    async function sendOnce(args: {
      personId: string; slackUserId: string; dealId: string;
      assignmentId: string; reminderType: string; text: string;
    }) {
      if (!args.slackUserId) {
        skipped.push({ person_id: args.personId, reason: "no slack id" });
        return;
      }
      const { data: existing } = await admin
        .from("staffing_reminder_log")
        .select("id")
        .eq("person_id", args.personId)
        .eq("deal_id", args.dealId)
        .eq("reminder_type", args.reminderType)
        .eq("sent_date", today)
        .maybeSingle();
      if (existing) { skipped.push({ person_id: args.personId, reason: "already sent" }); return; }
      const result = await dmUser(args.slackUserId, args.text);
      if (result?.ok) {
        await admin.from("staffing_reminder_log").insert({
          person_id: args.personId,
          deal_id: args.dealId,
          assignment_id: args.assignmentId,
          reminder_type: args.reminderType,
        });
        sent.push({ person_id: args.personId, deal_id: args.dealId, type: args.reminderType });
      } else {
        skipped.push({ person_id: args.personId, reason: result?.error || "slack error" });
      }
    }

    if (mode === "weekly") {
      const { data: people } = await admin
        .from("staffing_people")
        .select("id, name, slack_user_id, tbh, leaving");
      for (const p of people || []) {
        if (p.tbh || p.leaving) continue;
        if (!p.slack_user_id) continue;
        const text =
          `:wave: Hi ${p.name?.split(" ")[0] || "there"} — please confirm your capacity for this week.\n` +
          `Update your allocations here: ${APP_BASE_URL}/staffing?tab=people`;
        await sendOnce({
          personId: p.id, slackUserId: p.slack_user_id, dealId: "",
          assignmentId: "", reminderType: "weekly_capacity", text,
        });
      }
    }

    if (mode === "start" || mode === "end") {
      const dateField = mode === "start" ? "start_date" : "end_date";
      const { data: assignments } = await admin
        .from("staffing_assignments")
        .select("id, staffing_deal_id, person_id, role_key, allocation_pct, start_date, end_date")
        .eq(dateField, today);

      const personIds = [...new Set((assignments || []).map(a => a.person_id))].filter(Boolean);
      const dealIds = [...new Set((assignments || []).map(a => a.staffing_deal_id))].filter(Boolean);
      const [{ data: people }, { data: deals }] = await Promise.all([
        admin.from("staffing_people").select("id, name, slack_user_id").in("id", personIds.length ? personIds : [""]),
        admin.from("staffing_deals").select("id, deal_name, account").in("id", dealIds.length ? dealIds : [""]),
      ]);
      const personMap = new Map((people || []).map(p => [p.id, p]));
      const dealMap = new Map((deals || []).map(d => [d.id, d]));

      for (const a of assignments || []) {
        const p = personMap.get(a.person_id);
        const d = dealMap.get(a.staffing_deal_id);
        if (!p) continue;
        const dealLabel = d ? `${d.account} — ${d.deal_name}` : a.staffing_deal_id;
        const text = mode === "start"
          ? `:rocket: Your assignment on *${dealLabel}* (${a.role_key}, ${a.allocation_pct}%) starts today.\n` +
            `Open the deal: ${APP_BASE_URL}/deals/${a.staffing_deal_id}`
          : `:checkered_flag: Your assignment on *${dealLabel}* (${a.role_key}) ends today. ` +
            `Please update your allocation if it has changed: ${APP_BASE_URL}/staffing?tab=people`;
        await sendOnce({
          personId: p.id, slackUserId: p.slack_user_id || "", dealId: a.staffing_deal_id,
          assignmentId: a.id, reminderType: mode === "start" ? "assignment_start" : "assignment_end", text,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, mode, today, sent_count: sent.length, skipped_count: skipped.length, sent, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("staffing-capacity-reminders error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});