// Posts a message to Slack as the logged-in VSD (overrides bot username + icon)
// Requires the request to be authenticated.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!SLACK_BOT_TOKEN) throw new Error("SLACK_BOT_TOKEN not configured");

    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate user
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { dealId, channelId, text, threadTs, recipientType, dmThreadId } = body || {};
    const isDm = recipientType === "user" || !!dmThreadId;
    if (!text || (!isDm && (!dealId || !channelId)) || (isDm && !dmThreadId)) {
      return new Response(JSON.stringify({ error: "missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Lookup VSD display name from profile
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", u.user.id)
      .maybeSingle();

    const displayName = (profile?.display_name && profile.display_name.trim())
      || u.user.email?.split("@")[0]
      || "VSD";
    const avatar = profile?.avatar_url || undefined;

    // Resolve target channel: deal channel or DM channel from thread
    let targetChannelId: string = channelId;
    let dmThread: any = null;
    if (isDm) {
      const { data: t } = await admin
        .from("slack_dm_threads")
        .select("*")
        .eq("id", dmThreadId)
        .eq("app_user_id", u.user.id)
        .maybeSingle();
      if (!t) {
        return new Response(JSON.stringify({ error: "dm_thread_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      dmThread = t;
      targetChannelId = t.im_channel_id;
    }

    const slackBody: Record<string, unknown> = {
      channel: targetChannelId,
      text,
      username: displayName,
      ...(avatar ? { icon_url: avatar } : { icon_emoji: ":bust_in_silhouette:" }),
    };
    if (threadTs) slackBody.thread_ts = threadTs;

    const r = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(slackBody),
    });
    const j = await r.json();
    if (!j.ok) {
      return new Response(JSON.stringify({ error: j.error || "slack_error", detail: j }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Persist locally so realtime updates the chat immediately
    await admin.from("slack_messages").upsert({
      deal_id: isDm ? null : dealId,
      channel_id: targetChannelId,
      slack_ts: j.ts,
      thread_ts: threadTs || null,
      user_id: "",
      user_name: displayName,
      text,
      source: "app",
      sent_by_app_user: u.user.id,
      sent_by_display_name: displayName,
      raw: j.message || {},
      dm_thread_id: isDm ? dmThread.id : null,
    }, { onConflict: "channel_id,slack_ts" });

    if (isDm && dmThread) {
      await admin.from("slack_dm_threads").update({ last_message_at: new Date().toISOString() }).eq("id", dmThread.id);
    }

    return new Response(JSON.stringify({ ok: true, ts: j.ts }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});