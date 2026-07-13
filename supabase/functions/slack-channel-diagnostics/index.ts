// Live Slack access check for one linked channel. This does not mutate Slack
// or local data; it explains whether the backend bot token can see/read history.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") || "";

const responseHeaders = { ...corsHeaders, "Access-Control-Allow-Methods": "POST, OPTIONS" };

const BodySchema = z.object({
  channelId: z.string().trim().min(1).max(128),
});

type SlackApiResult = {
  ok?: boolean;
  error?: string;
  channel?: {
    id?: string;
    name?: string;
    is_channel?: boolean;
    is_group?: boolean;
    is_private?: boolean;
    is_member?: boolean;
  };
  messages?: Array<{ ts?: string; text?: string; user?: string; bot_id?: string }>;
};

async function slackGet(method: string, params: Record<string, string>): Promise<SlackApiResult> {
  const url = new URL(`https://slack.com/api/${method}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } });
  const text = await res.text();
  try {
    return JSON.parse(text) as SlackApiResult;
  } catch {
    return { ok: false, error: `non_json_${res.status}` };
  }
}

function toIso(ts: string | undefined): string | null {
  if (!ts) return null;
  const seconds = Number(ts.split(".")[0]);
  if (!Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: responseHeaders });

  try {
    if (!SLACK_BOT_TOKEN) {
      return json({ ok: false, error: "no_token", summary: "Backend Slack token is not configured." }, 500);
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return json({ ok: false, error: "invalid_request", fields: parsed.error.flatten().fieldErrors }, 400);
    }

    const { channelId } = parsed.data;
    const info = await slackGet("conversations.info", { channel: channelId });
    const history = await slackGet("conversations.history", { channel: channelId, limit: "1" });
    const latest = history.messages?.[0];

    const canSeeMetadata = Boolean(info.ok);
    const botIsMember = Boolean(info.channel?.is_member);
    const canReadHistory = Boolean(history.ok);
    const channelName = info.channel?.name || null;
    const infoError = info.ok ? null : info.error || "unknown";
    const historyError = history.ok ? null : history.error || "unknown";

    let summary = "Backend Slack bot can read this channel.";
    if (!canSeeMetadata && infoError === "channel_not_found") {
      summary = "Backend Slack bot cannot see this channel. Verify the linked channel ID and whether this is the same Slack workspace/app.";
    } else if (!canReadHistory && historyError === "not_in_channel") {
      summary = "Backend Slack bot cannot read history because Slack says this token is not in the channel. If Slack shows an app added, it may be a different app/token than the backend uses.";
    } else if (!canReadHistory && historyError === "missing_scope") {
      summary = "Backend Slack bot is missing the Slack history permission needed to read this channel.";
    } else if (!canReadHistory) {
      summary = `Backend Slack bot cannot read history: ${historyError}.`;
    }

    return json({
      ok: true,
      channelId,
      channelName,
      canSeeMetadata,
      botIsMember,
      canReadHistory,
      infoError,
      historyError,
      latestMessageAt: toIso(latest?.ts),
      latestMessagePreview: latest?.text ? latest.text.replace(/\s+/g, " ").slice(0, 160) : null,
      summary,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...responseHeaders, "Content-Type": "application/json" },
  });
}