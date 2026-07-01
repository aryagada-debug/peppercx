// Recomputes public.slack_channel_health for all active deals, then
// hydrates channel names for the connected ones via Slack (bot token).
// Safe to invoke on demand (admin button) or from a daily cron.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") || "";

async function slackChannelName(channelId: string): Promise<string | null> {
  if (!SLACK_BOT_TOKEN) return null;
  try {
    const res = await fetch(
      `https://slack.com/api/conversations.info?channel=${encodeURIComponent(channelId)}`,
      { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } },
    );
    const data = await res.json();
    if (!data?.ok) return null;
    return data.channel?.name || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1) Recompute all rollup rows in a single SQL pass.
    const { error: rpcErr } = await admin.rpc("refresh_slack_channel_health");
    if (rpcErr) throw rpcErr;

    // 2) Hydrate channel names for connected rows that don't have one yet.
    const { data: rows } = await admin
      .from("slack_channel_health")
      .select("deal_id, channel_id, channel_name")
      .eq("is_connected", true)
      .is("channel_name", null)
      .limit(200);

    let hydrated = 0;
    for (const r of rows || []) {
      if (!r.channel_id) continue;
      const name = await slackChannelName(r.channel_id);
      if (!name) continue;
      await admin.from("slack_channel_health").update({ channel_name: name }).eq("deal_id", r.deal_id);
      hydrated++;
    }

    const { count } = await admin
      .from("slack_channel_health")
      .select("*", { count: "exact", head: true });

    return new Response(
      JSON.stringify({ ok: true, rows: count ?? 0, hydrated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});