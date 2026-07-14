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

    const fetchHistory = async () => {
      const url = new URL("https://slack.com/api/conversations.history");
      url.searchParams.set("channel", channelId);
      url.searchParams.set("limit", String(Math.min(Number(limit) || 100, 200)));
      const r = await fetch(url, { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } });
      return await r.json();
    };

    let j = await fetchHistory();
    let autoJoined = false;

    // If the bot isn't in the channel, try to auto-join (works for public channels
    // when the token has `channels:join`). This is the most common reason some
    // channels show history and others don't — the bot was never invited.
    if (!j.ok && j.error === "not_in_channel") {
      const joinRes = await fetch("https://slack.com/api/conversations.join", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ channel: channelId }),
      });
      const joinJson = await joinRes.json();
      if (joinJson.ok) {
        autoJoined = true;
        j = await fetchHistory();
      } else if (joinJson.error === "is_private" || joinJson.error === "method_not_supported_for_channel_type") {
        // Private channel or DM/MPIM — bot must be invited by a human.
        return new Response(
          JSON.stringify({
            messages: [],
            users: {},
            warning: "not_in_channel",
            hint: "This is a private channel. Invite the Lovable bot from Slack (/invite @Lovable) to load history.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (!j.ok) {
      // Common, non-fatal: bot isn't in the channel yet. Return empty history
      // with a friendly hint instead of a 500 so the UI doesn't blank-screen.
      if (j.error === "not_in_channel" || j.error === "channel_not_found" || j.error === "missing_scope") {
        return new Response(
          JSON.stringify({
            messages: [],
            users: {},
            warning: j.error,
            hint: j.error === "not_in_channel"
              ? "Invite the Lovable bot to this Slack channel (/invite @Lovable) to load history."
              : j.error === "channel_not_found"
              ? "Slack cannot find this channel. Check the linked channel ID and workspace."
              : "The Slack bot is missing the history scope. Reconnect Slack to grant it.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(j.error || "slack_error");
    }

    const raw: SlackMsg[] = (j.messages || []).filter((m: SlackMsg) => m.type === "message" && (!m.subtype || m.subtype === "thread_broadcast" || m.subtype === "bot_message"));

    // Collect user IDs from authors AND from inline <@Uxxx> mentions in message text.
    const mentionRegex = /<@([UW][A-Z0-9]+)(?:\|[^>]+)?>/g;
    const userIds = new Set<string>();
    for (const m of raw) {
      if (m.user) userIds.add(m.user);
      const text = m.text || "";
      let mt: RegExpExecArray | null;
      while ((mt = mentionRegex.exec(text)) !== null) {
        userIds.add(mt[1]);
      }
    }
    const nameMap: Record<string, string> = {};
    await Promise.all(Array.from(userIds).map(async (uid) => {
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

    return new Response(JSON.stringify({ messages, users: nameMap }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      ...(autoJoined ? {} : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});