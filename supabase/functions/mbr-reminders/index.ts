// Daily MBR Slack reminders
// - 10 days before scheduled MBR date: ask VSD to fill MBR details (only if status = Pending)
// - 2 days and 1 day before: countdown reminder
// Posts as VSD-OS into the deal's linked Slack channel and mirrors into slack_messages.
import { createClient } from "jsr:@supabase/supabase-js@2";

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
function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

type ReminderType = "fill_details" | "t_minus_2" | "t_minus_1";

async function postSlack(channel: string, text: string) {
  const r = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel,
      text,
      username: "VSD-OS",
      icon_emoji: ":bell:",
    }),
  });
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!SLACK_BOT_TOKEN) throw new Error("SLACK_BOT_TOKEN not configured");
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const targetDates: Record<string, ReminderType> = {
      [ymd(addDays(today, 10))]: "fill_details",
      [ymd(addDays(today, 2))]: "t_minus_2",
      [ymd(addDays(today, 1))]: "t_minus_1",
    };
    const dateList = Object.keys(targetDates);
    const todayStr = ymd(today);

    // Fetch MBR entries scheduled on any of the target dates
    const { data: entries, error: entriesErr } = await admin
      .from("mbr_entries")
      .select("id, deal_id, scheduled_date, status")
      .in("scheduled_date", dateList);
    if (entriesErr) throw entriesErr;

    const sent: any[] = [];
    const skipped: any[] = [];
    const errors: any[] = [];

    for (const e of entries || []) {
      const reminderType = targetDates[e.scheduled_date as string];
      if (!reminderType) continue;

      // Lookup deal -> channel + name
      const { data: deal } = await admin
        .from("staffing_deals")
        .select("id, deal_name, slack_channel_id")
        .eq("id", e.deal_id)
        .maybeSingle();
      if (!deal || !deal.slack_channel_id) {
        skipped.push({ entry: e.id, reason: "no_channel" });
        continue;
      }

      // Fill-details only if still Pending
      if (reminderType === "fill_details" && e.status !== "Pending") {
        skipped.push({ entry: e.id, reason: "not_pending" });
        continue;
      }

      // Dedup
      const { data: existing } = await admin
        .from("mbr_reminder_log")
        .select("id")
        .eq("mbr_entry_id", e.id)
        .eq("reminder_type", reminderType)
        .eq("sent_date", todayStr)
        .maybeSingle();
      if (existing) {
        skipped.push({ entry: e.id, reason: "already_sent" });
        continue;
      }

      const dealName = deal.deal_name || "Deal";
      const dateLabel = new Date(e.scheduled_date as string).toUTCString().slice(0, 16);
      let text = "";
      if (reminderType === "fill_details") {
        const link = `${APP_BASE_URL}/deals/${deal.id}`;
        text = `📝 *Reminder:* MBR for *${dealName}* is scheduled on *${dateLabel}*. Please fill in the MBR details here: ${link}`;
      } else if (reminderType === "t_minus_2") {
        text = `⏰ *Reminder:* MBR for *${dealName}* in *2 days* (${dateLabel}).`;
      } else {
        text = `⏰ *Reminder:* MBR for *${dealName}* *tomorrow* (${dateLabel}).`;
      }

      const slackResp = await postSlack(deal.slack_channel_id, text);
      if (!slackResp.ok) {
        errors.push({ entry: e.id, error: slackResp.error || "slack_error" });
        continue;
      }

      // Mirror in slack_messages so it shows in app chat
      await admin.from("slack_messages").insert({
        deal_id: deal.id,
        channel_id: deal.slack_channel_id,
        slack_ts: slackResp.ts,
        user_id: "",
        user_name: "VSD-OS",
        text,
        source: "app",
        sent_by_display_name: "VSD-OS",
        raw: slackResp.message || {},
      });

      // Log it
      await admin.from("mbr_reminder_log").insert({
        mbr_entry_id: e.id,
        reminder_type: reminderType,
        sent_date: todayStr,
        channel_id: deal.slack_channel_id,
      });

      sent.push({ entry: e.id, type: reminderType, deal: deal.id });
    }

    return new Response(
      JSON.stringify({ ok: true, sent, skipped, errors, checked: entries?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});