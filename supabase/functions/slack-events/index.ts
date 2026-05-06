// Slack Events API webhook receiver
// - URL verification handshake
// - Verifies signature using SLACK_SIGNING_SECRET
// - Stores incoming channel messages in slack_messages, mapped to a deal via staffing_deals.slack_channel_id
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SIGNING_SECRET = Deno.env.get("SLACK_SIGNING_SECRET") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-slack-signature, x-slack-request-timestamp",
};

async function verifySlackSignature(req: Request, rawBody: string): Promise<boolean> {
  if (!SIGNING_SECRET) return false;
  const ts = req.headers.get("x-slack-request-timestamp");
  const sig = req.headers.get("x-slack-signature");
  if (!ts || !sig) return false;
  // Reject replays older than 5 min
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 60 * 5) return false;
  const base = `v0:${ts}:${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const macBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(base));
  const hex = Array.from(new Uint8Array(macBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
  const expected = `v0=${hex}`;
  // Constant-time compare
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rawBody = await req.text();
  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return new Response("bad json", { status: 400 }); }

  // Slack URL verification
  if (payload.type === "url_verification") {
    return new Response(JSON.stringify({ challenge: payload.challenge }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify signature for all real events
  const ok = await verifySlackSignature(req, rawBody);
  if (!ok) return new Response("invalid signature", { status: 401, headers: corsHeaders });

  if (payload.type !== "event_callback" || !payload.event) {
    return new Response("ignored", { status: 200, headers: corsHeaders });
  }

  const ev = payload.event;
  console.log("[slack-events]", ev.type, ev.subtype || "", "channel=", ev.channel, "channel_type=", ev.channel_type);
  if (ev.type !== "message") return new Response("ok", { status: 200, headers: corsHeaders });
  // Allow plain messages and edit syncs; ignore most other subtypes (joins/leaves/deletes/etc).
  const allowedSubtypes = new Set(["thread_broadcast", "message_changed"]);
  if (ev.subtype && !allowedSubtypes.has(ev.subtype)) return new Response("ok", { status: 200, headers: corsHeaders });
  // Skip our own bot's echoes (we mirror via slack-send already).
  if (ev.bot_id) return new Response("ok", { status: 200, headers: corsHeaders });

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

  const isDm = ev.channel_type === "im";
  // For DMs, route to the matching slack_dm_threads row; for channels, to the deal.
  let dealId: string | null = null;
  let dmThreadId: string | null = null;
  if (isDm) {
    const { data: t } = await supa
      .from("slack_dm_threads")
      .select("id, app_user_id")
      .eq("im_channel_id", ev.channel)
      .maybeSingle();
    if (!t) {
      console.log("[slack-events] no DM thread mapped for channel", ev.channel);
      return new Response("no dm thread", { status: 200, headers: corsHeaders });
    }
    dmThreadId = t.id;
  } else {
    const { data: deal } = await supa
      .from("staffing_deals")
      .select("id")
      .eq("slack_channel_id", ev.channel)
      .maybeSingle();
    if (!deal) {
      console.log("[slack-events] no deal mapped for channel", ev.channel);
      return new Response("no deal mapped", { status: 200, headers: corsHeaders });
    }
    dealId = deal.id;
  }

  // For message_changed, the actual content lives under ev.message.
  const msg = ev.subtype === "message_changed" ? (ev.message || {}) : ev;
  const userId = msg.user || ev.user || "";
  const ts = msg.ts || ev.ts;
  const text = msg.text || "";
  const threadTs = msg.thread_ts || ev.thread_ts || null;

  // Resolve user display name (best-effort)
  let userName = userId;
  try {
    const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");
    if (SLACK_BOT_TOKEN && userId) {
      const r = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
        headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
      });
      const j = await r.json();
      if (j.ok) userName = j.user?.profile?.display_name || j.user?.real_name || j.user?.name || userId;
    }
  } catch (_) { /* ignore */ }

  const { error: upErr } = await supa.from("slack_messages").upsert({
    deal_id: dealId,
    dm_thread_id: dmThreadId,
    channel_id: ev.channel,
    slack_ts: ts,
    thread_ts: threadTs,
    user_id: userId,
    user_name: userName,
    text,
    source: "slack",
    raw: ev,
  }, { onConflict: "channel_id,slack_ts" });
  if (upErr) console.log("[slack-events] upsert error", upErr.message);

  if (isDm && dmThreadId) {
    await supa.from("slack_dm_threads").update({ last_message_at: new Date().toISOString() }).eq("id", dmThreadId);
  }

  return new Response("ok", { status: 200, headers: corsHeaders });
});