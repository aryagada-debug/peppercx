// Resolves a Slack user (by email or name) and opens a DM channel for them.
// Returns or creates a slack_dm_threads row owned by the calling user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function slackApi(path: string, init: RequestInit = {}) {
  const r = await fetch(`https://slack.com/api/${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
  return r.json();
}

async function findByName(name: string): Promise<any | null> {
  let cursor = "";
  const lower = name.toLowerCase();
  for (let i = 0; i < 25; i++) {
    const url = `users.list?limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const j = await slackApi(url);
    if (!j.ok) return null;
    const m = (j.members || []).find((u: any) =>
      !u.deleted && !u.is_bot &&
      ((u.profile?.display_name || "").toLowerCase() === lower
        || (u.real_name || "").toLowerCase() === lower
        || (u.name || "").toLowerCase() === lower
        || (u.profile?.email || "").toLowerCase() === lower)
    );
    if (m) return m;
    cursor = j.response_metadata?.next_cursor || "";
    if (!cursor) break;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!SLACK_BOT_TOKEN) throw new Error("SLACK_BOT_TOKEN not configured");
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);

    const { email, name } = await req.json().catch(() => ({}));
    if (!email && !name) return json({ error: "email or name required" }, 400);

    let slackUser: any = null;
    if (email) {
      const j = await slackApi(`users.lookupByEmail?email=${encodeURIComponent(String(email))}`);
      if (j.ok) slackUser = j.user;
    }
    if (!slackUser && name) slackUser = await findByName(String(name));
    if (!slackUser) return json({ error: "user_not_found" }, 404);

    // Open DM
    const open = await slackApi("conversations.open", { method: "POST", body: JSON.stringify({ users: slackUser.id }) });
    if (!open.ok) return json({ error: open.error || "open_failed", detail: open }, 500);
    const imChannelId = open.channel?.id;
    if (!imChannelId) return json({ error: "no_im_channel" }, 500);

    const displayName = slackUser.profile?.display_name || slackUser.real_name || slackUser.name || slackUser.id;
    const slackEmail = slackUser.profile?.email || email || "";

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: existing } = await admin
      .from("slack_dm_threads")
      .select("*")
      .eq("app_user_id", u.user.id)
      .eq("slack_user_id", slackUser.id)
      .maybeSingle();

    let thread = existing;
    if (!thread) {
      const { data: ins, error } = await admin
        .from("slack_dm_threads")
        .insert({
          app_user_id: u.user.id,
          slack_user_id: slackUser.id,
          slack_user_name: displayName,
          slack_user_email: slackEmail,
          im_channel_id: imChannelId,
        })
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 500);
      thread = ins;
    } else if (thread.im_channel_id !== imChannelId) {
      await admin.from("slack_dm_threads").update({ im_channel_id: imChannelId }).eq("id", thread.id);
      thread.im_channel_id = imChannelId;
    }

    return json({ ok: true, thread, slackUser: { id: slackUser.id, displayName, email: slackEmail } });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});