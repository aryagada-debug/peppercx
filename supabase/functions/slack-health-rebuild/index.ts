// Recomputes public.slack_channel_health for all active deals, then
// hydrates channel names for the connected ones via Slack (bot token).
// Safe to invoke on demand (admin button) or from a daily cron.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const responseHeaders = { ...corsHeaders, "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };

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

interface SlackHistMsg {
  type?: string;
  subtype?: string;
  user?: string;
  bot_id?: string;
  username?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
}

type SlackWarning = {
  code: string;
  detail?: string;
};

// Pull up to `days` of history from a Slack channel, paginating conversations.history.
// Returns messages plus an optional warning code (e.g. not_in_channel).
async function fetchChannelHistory(channelId: string, days = 90): Promise<{ messages: SlackHistMsg[]; warning?: SlackWarning }> {
  if (!SLACK_BOT_TOKEN) return { messages: [], warning: { code: "no_token" } };
  const oldest = Math.floor((Date.now() - days * 86400 * 1000) / 1000).toString();
  const out: SlackHistMsg[] = [];
  let cursor = "";
  let joined = false;
  for (let i = 0; i < 20; i++) { // hard cap ~4000 msgs / channel
    const url = new URL("https://slack.com/api/conversations.history");
    url.searchParams.set("channel", channelId);
    url.searchParams.set("limit", "200");
    url.searchParams.set("oldest", oldest);
    if (cursor) url.searchParams.set("cursor", cursor);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } });
    const j = await r.json();
    if (!j.ok) {
      // The bot must be a member to read history. Public channels can be joined
      // programmatically; retry once after joining. Private channels still require
      // a human invite and will surface as `not_in_channel`.
      if (j.error === "not_in_channel" && !joined) {
        joined = true;
        const jr = await fetch("https://slack.com/api/conversations.join", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `channel=${encodeURIComponent(channelId)}`,
        });
        const jj = await jr.json();
        if (jj.ok) {
          cursor = "";
          i--; // retry this iteration
          continue;
        }
        if (jj.error === "method_not_supported_for_channel_type") {
          return { messages: out, warning: { code: "private_channel_needs_invite", detail: jj.error } };
        }
        if (jj.error === "missing_scope") {
          return { messages: out, warning: { code: "not_in_channel_missing_join_scope", detail: "Slack reported not_in_channel, and conversations.join failed with missing_scope." } };
        }
        return { messages: out, warning: { code: "not_in_channel_join_failed", detail: jj.error || "not_in_channel" } };
      }
      if (j.error === "missing_scope") {
        return { messages: out, warning: { code: "missing_history_scope", detail: "conversations.history returned missing_scope." } };
      }
      return { messages: out, warning: { code: j.error || "slack_error" } };
    }
    for (const m of (j.messages || []) as SlackHistMsg[]) {
      if (m.type && m.type !== "message") continue;
      if (m.subtype && !["thread_broadcast", "bot_message", "me_message"].includes(m.subtype)) continue;
      out.push(m);
    }
    if (!j.has_more) break;
    cursor = j.response_metadata?.next_cursor || "";
    if (!cursor) break;
  }
  return { messages: out };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: responseHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1) Backfill Slack history for every deal-linked channel so the rollup
    //    reflects real activity, not just messages captured via the webhook.
    const { data: linked } = await admin
      .from("staffing_deals")
      .select("id, slack_channel_id, deal_status")
      .not("slack_channel_id", "is", null)
      .in("deal_status", ["Active Deal", "New Deal in SLA/PO", "Deal Disputed", "Deal in Renewal Process"]);

    const channelToDeal = new Map<string, string>();
    for (const d of linked || []) {
      const ch = (d.slack_channel_id || "").trim();
      if (ch && !channelToDeal.has(ch)) channelToDeal.set(ch, d.id);
    }

    let ingested = 0;
    let staleAuditsDeleted = 0;
    const touchedDealIds = new Set<string>();
    const warnings: Record<string, string> = {};
    const warningDetails: Record<string, string> = {};
    for (const [channelId, dealId] of channelToDeal) {
      const { messages, warning } = await fetchChannelHistory(channelId, 90);
      if (warning) {
        warnings[channelId] = warning.code;
        if (warning.detail) warningDetails[channelId] = warning.detail;
      }
      if (messages.length === 0) continue;
      const rows = messages.map((m) => ({
        deal_id: dealId,
        channel_id: channelId,
        slack_ts: m.ts,
        thread_ts: m.thread_ts || null,
        user_id: m.user || m.bot_id || "",
        user_name: m.username || "",
        text: m.text || "",
        source: m.bot_id ? "bot" : "slack",
        raw: m as unknown as Record<string, unknown>,
        created_at: new Date(Math.floor(Number(m.ts) * 1000)).toISOString(),
      }));
      // Upsert in chunks; unique (channel_id, slack_ts) makes this idempotent.
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await admin
          .from("slack_messages")
          .upsert(chunk, { onConflict: "channel_id,slack_ts", ignoreDuplicates: true });
        if (!error) {
          ingested += chunk.length;
          touchedDealIds.add(dealId);
        }
      }
    }

    // If history was successfully ingested after a previous empty/fallback AI
    // audit, clear that stale audit so the next open/regenerate uses real data.
    for (const dealId of touchedDealIds) {
      const { error: delErr, count: delCount } = await admin
        .from("slack_channel_audits")
        .delete({ count: "exact" })
        .eq("deal_id", dealId)
        .or("model.eq.fallback,health_sentiment.ilike.%empty channel%,engagement.ilike.%Zero messages%");
      if (!delErr) staleAuditsDeleted += delCount || 0;
    }

    // 2) Recompute all rollup rows in a single SQL pass.
    const { error: rpcErr } = await admin.rpc("refresh_slack_channel_health");
    if (rpcErr) throw rpcErr;

    // 2b) Overlay fetch warnings on the rollup so rows with real Slack access
    //     issues (bot not in channel, missing scope, private channel etc.)
    //     don't get misreported as "empty channel / no messages in 30 days".
    const warningReason: Record<string, { rgy: "R" | "Y"; reason: string }> = {
      not_in_channel: { rgy: "R", reason: "Backend Slack bot is not in this channel, or Slack shows a different app than the backend token." },
      not_in_channel_missing_join_scope: { rgy: "R", reason: "Backend Slack bot cannot read this channel: Slack says it is not in the channel, and auto-join is blocked by missing channels:join. Re-authorize with channels:join and channels:history, or invite the backend bot used by this app." },
      not_in_channel_join_failed: { rgy: "R", reason: "Backend Slack bot cannot read this channel: Slack says it is not in the channel and auto-join failed. Verify the backend Slack app/token is the same app added in Slack." },
      channel_not_found: { rgy: "R", reason: "Channel not found — verify the linked Slack channel ID" },
      missing_scope: { rgy: "R", reason: "Backend Slack bot missing permission to read channel history — re-authorize with the required Slack history scopes." },
      missing_history_scope: { rgy: "R", reason: "Backend Slack bot missing conversations.history permission for this channel — re-authorize with channels:history/groups:history as needed." },
      private_channel_needs_invite: { rgy: "R", reason: "Private channel — invite @vsdos so we can read history" },
      no_token: { rgy: "R", reason: "Slack bot token not configured" },
    };
    let overlaid = 0;
    for (const [channelId, warning] of Object.entries(warnings)) {
      const dealId = channelToDeal.get(channelId);
      if (!dealId) continue;
      const map = warningReason[warning] ?? { rgy: "R" as const, reason: `Slack error: ${warning}` };
      const { error: upErr } = await admin
        .from("slack_channel_health")
        .update({ rgy: map.rgy, reason: map.reason, computed_at: new Date().toISOString() })
        .eq("deal_id", dealId);
      if (!upErr) overlaid++;
    }

    // 3) Hydrate channel names for connected rows that don't have one yet.
    const { data: rows } = await admin
      .from("slack_channel_health")
      .select("deal_id, channel_id, channel_name")
      .eq("is_connected", true)
      .is("channel_name", null)
      .limit(500);

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
      JSON.stringify({ ok: true, rows: count ?? 0, hydrated, ingested, staleAuditsDeleted, overlaid, channels: channelToDeal.size, warnings, warningDetails }),
      { headers: { ...responseHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...responseHeaders, "Content-Type": "application/json" },
    });
  }
});