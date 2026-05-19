// Lists active Slack workspace members for the @mention picker in the app chat.
// Returns a small payload of { id, name, real_name, display_name } per user.
const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SlackUser {
  id: string;
  name?: string;
  real_name?: string;
  deleted?: boolean;
  is_bot?: boolean;
  profile?: { display_name?: string; real_name?: string; email?: string; image_24?: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!SLACK_BOT_TOKEN) throw new Error("SLACK_BOT_TOKEN not configured");
    let cursor = "";
    const out: Array<{ id: string; name: string; real_name: string; display_name: string; email: string }> = [];
    for (let i = 0; i < 25; i++) {
      const url = new URL("https://slack.com/api/users.list");
      url.searchParams.set("limit", "200");
      if (cursor) url.searchParams.set("cursor", cursor);
      const r = await fetch(url, { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "slack_error");
      for (const u of (j.members || []) as SlackUser[]) {
        if (u.deleted || u.is_bot || u.id === "USLACKBOT") continue;
        const display = u.profile?.display_name || u.profile?.real_name || u.real_name || u.name || u.id;
        out.push({
          id: u.id,
          name: u.name || "",
          real_name: u.real_name || "",
          display_name: display,
          email: u.profile?.email || "",
        });
      }
      cursor = j.response_metadata?.next_cursor || "";
      if (!cursor) break;
    }
    out.sort((a, b) => a.display_name.localeCompare(b.display_name));
    return new Response(JSON.stringify({ users: out }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});