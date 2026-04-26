import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const THRESHOLD = 2;

function isoMonday(d = new Date()): string {
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const m = new Date(d);
  m.setUTCDate(m.getUTCDate() + diff);
  m.setUTCHours(0, 0, 0, 0);
  return m.toISOString().split("T")[0];
}

async function countHumanMessages(admin: any, dealId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("slack_messages")
    .select("created_at")
    .eq("deal_id", dealId)
    .eq("source", "slack")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (error) return { count: 0, lastAt: null as string | null };
  return { count: (data || []).length, lastAt: (data || [])[0]?.created_at ?? null };
}

async function postSlack(channel: string, text: string, botToken: string): Promise<boolean> {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${botToken}` },
    body: JSON.stringify({ channel, text, username: "VSD-OS", icon_emoji: ":warning:" }),
  });
  const j = await res.json().catch(() => ({}));
  return Boolean(j?.ok);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode || "status";

    if (mode === "status") {
      const dealId = body?.deal_id;
      if (!dealId) {
        return new Response(JSON.stringify({ error: "deal_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { count, lastAt } = await countHumanMessages(admin, dealId);
      return new Response(
        JSON.stringify({ count, lastMessageAt: lastAt, isInactive: count < THRESHOLD, threshold: THRESHOLD }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (mode === "scan") {
      if (!SLACK_BOT_TOKEN) {
        return new Response(JSON.stringify({ error: "SLACK_BOT_TOKEN missing" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: deals, error } = await admin
        .from("staffing_deals")
        .select("id, deal_name, slack_channel_id, deal_status")
        .eq("deal_status", "Active Deal")
        .neq("slack_channel_id", "")
        .not("slack_channel_id", "is", null);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const week = isoMonday();
      const result = { scanned: 0, flagged: 0, posted: 0, skipped_already_nudged: 0, errors: [] as any[] };
      for (const d of deals || []) {
        result.scanned++;
        const { count } = await countHumanMessages(admin, d.id);
        if (count >= THRESHOLD) continue;
        result.flagged++;
        const { error: insErr } = await admin
          .from("slack_inactivity_nudges")
          .insert({ deal_id: d.id, channel_id: d.slack_channel_id, week_start: week, message_count: count });
        if (insErr) {
          if ((insErr as any).code === "23505") { result.skipped_already_nudged++; continue; }
          result.errors.push({ deal_id: d.id, error: insErr.message });
          continue;
        }
        const text =
          `:warning: *Low activity flag* — This channel had only ${count} team message${count === 1 ? "" : "s"} in the last 7 days.\n` +
          `Per VSD-OS, active deals should see at least ${THRESHOLD} weekly updates from the team. This has been flagged on the MBR tab.`;
        const ok = await postSlack(d.slack_channel_id, text, SLACK_BOT_TOKEN);
        if (ok) result.posted++;
        else result.errors.push({ deal_id: d.id, error: "slack post failed" });
      }
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown mode" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("slack-activity-check error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
