// Lists channels (public + private the bot is in) for the channel picker.
const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!SLACK_BOT_TOKEN) throw new Error("SLACK_BOT_TOKEN not configured");

    const all: Array<{ id: string; name: string; is_private: boolean }> = [];
    let cursor = "";
    do {
      const url = new URL("https://slack.com/api/conversations.list");
      url.searchParams.set("limit", "200");
      url.searchParams.set("types", "public_channel,private_channel");
      url.searchParams.set("exclude_archived", "true");
      if (cursor) url.searchParams.set("cursor", cursor);
      const r = await fetch(url, { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "slack_error");
      for (const c of j.channels || []) {
        all.push({ id: c.id, name: c.name, is_private: !!c.is_private });
      }
      cursor = j.response_metadata?.next_cursor || "";
    } while (cursor);

    all.sort((a, b) => a.name.localeCompare(b.name));
    return new Response(JSON.stringify({ channels: all }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});