// Fetch recent Slack channel history (live from Slack) and resolve user display names.
// Used by the Home Slack bubble to show chat history regardless of whether
// the channel is mapped to a deal in our DB.
const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SlackMsg {
  type: string;
  subtype?: string;
  user?: string;
  bot_id?: string;
  username?: string;
  text: string;
  ts: string;
  thread_ts?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!SLACK_BOT_TOKEN) throw new Error("SLACK_BOT_TOKEN not configured");
    const { channelId, limit = 100 } = await req.json();
    if (!channelId) throw new Error("channelId required");

    const url = new URL("https://slack.com/api/conversations.history");
    url.searchParams.set("channel", channelId);
    url.searchParams.set("limit", String(Math.min(Number(limit) || 100, 200)));
    const r = await fetch(url, { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "slack_error");

    const raw: SlackMsg[] = (j.messages || []).filter((m: SlackMsg) => m.type === "message" && (!m.subtype || m.subtype === "thread_broadcast" || m.subtype === "bot_message"));

    // Resolve unique user IDs to display names in parallel
    const userIds = Array.from(new Set(raw.map(m => m.user).filter(Boolean))) as string[];
    const nameMap: Record<string, string> = {};
    await Promise.all(userIds.map(async (uid) => {
      try {
        const ur = await fetch(`https://slack.com/api/users.info?user=${uid}`, { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } });
        const uj = await ur.json();
        if (uj.ok) nameMap[uid] = uj.user?.profile?.display_name || uj.user?.real_name || uj.user?.name || uid;
      } catch (_) { /* ignore */ }
    }));

    const messages = raw
      .map((m) => ({
        id: m.ts,
        slack_ts: m.ts,
        thread_ts: m.thread_ts || null,
        user_id: m.user || m.bot_id || "",
        user_name: m.user ? (nameMap[m.user] || m.user) : (m.username || "Bot"),
        text: m.text || "",
        source: m.bot_id ? "bot" : "slack",
        created_at: new Date(Math.floor(Number(m.ts) * 1000)).toISOString(),
      }))
      // Slack returns newest-first; UI expects oldest-first
      .sort((a, b) => Number(a.slack_ts) - Number(b.slack_ts));

    return new Response(JSON.stringify({ messages }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});