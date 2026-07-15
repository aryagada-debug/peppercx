// Lists channels (public + private the bot is in) for the channel picker.
const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory cache to avoid re-paginating Slack's conversations.list on every
// channel picker open. Slack tier-2 rate limits (~20 req/min) get hit easily
// when a user links channels on several deals back-to-back.
type Channel = { id: string; name: string; is_private: boolean };
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { token: string; at: number; channels: Channel[] } | null = null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!SLACK_BOT_TOKEN) throw new Error("SLACK_BOT_TOKEN not configured");

    if (cache && cache.token === SLACK_BOT_TOKEN && Date.now() - cache.at < CACHE_TTL_MS) {
      return new Response(JSON.stringify({ channels: cache.channels, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const all: Channel[] = [];
    let cursor = "";
    do {
      const url = new URL("https://slack.com/api/conversations.list");
      url.searchParams.set("limit", "200");
      url.searchParams.set("types", "public_channel,private_channel");
      url.searchParams.set("exclude_archived", "true");
      if (cursor) url.searchParams.set("cursor", cursor);
      const r = await fetch(url, { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } });
      if (r.status === 429) {
        const retryAfter = Number(r.headers.get("retry-after") || "30");
        return new Response(JSON.stringify({ error: "rate_limited", retryAfter }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(retryAfter) },
        });
      }
      const j = await r.json();
      if (!j.ok) {
        const code = j.error || "slack_error";
        if (code === "ratelimited") {
          return new Response(JSON.stringify({ error: "rate_limited", retryAfter: 30 }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (code === "token_revoked" || code === "invalid_auth" || code === "account_inactive") {
          return new Response(JSON.stringify({ error: "auth_failed", slackError: code }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(code);
      }
      for (const c of j.channels || []) {
        all.push({ id: c.id, name: c.name, is_private: !!c.is_private });
      }
      cursor = j.response_metadata?.next_cursor || "";
    } while (cursor);

    all.sort((a, b) => a.name.localeCompare(b.name));
    cache = { token: SLACK_BOT_TOKEN, at: Date.now(), channels: all };
    return new Response(JSON.stringify({ channels: all }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});