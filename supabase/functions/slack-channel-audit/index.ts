// Generates or returns a cached AI audit of a deal's Slack channel activity
// in the trailing 12 weeks, in the schema the Slack Review card renders.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const responseHeaders = { ...corsHeaders, "Access-Control-Allow-Methods": "POST, OPTIONS" };

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const MODEL = "google/gemini-2.5-flash";
const WINDOW_DAYS = 84; // 12 weeks

interface AuditJson {
  rating: "R" | "Y" | "G";
  health_sentiment: string;
  scope_of_work: string;
  customer_cares: string;
  engagement: string;
  performance_results: string;
  churn_signals: string[];
  what_is_working: string[];
  recommended_action: string;
  channels: Array<{ role: string; channel: string; msgs_12wk: number; activity: string; audit_status: string }>;
}

function heuristicActivity(count: number, lastAt: string | null): string {
  if (!count) return "Dormant";
  if (lastAt) {
    const days = (Date.now() - new Date(lastAt).getTime()) / 86400000;
    if (days > 30) return "Stale";
    if (days > 14) return "Slow";
  }
  if (count >= 60) return "Active";
  if (count >= 15) return "Moderate";
  return "Low";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: responseHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const dealId: string = String(body.deal_id || "").trim();
    const force: boolean = !!body.force;
    if (!dealId) return json({ error: "deal_id required" }, 400);

    if (!force) {
      const { data: cached } = await admin
        .from("slack_channel_audits")
        .select("*")
        .eq("deal_id", dealId)
        .maybeSingle();
      if (cached && Date.now() - new Date(cached.computed_at).getTime() < 24 * 3600 * 1000) {
        const { data: latestMsg } = await admin
          .from("slack_messages")
          .select("created_at")
          .eq("deal_id", dealId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const cachedAt = new Date(cached.computed_at).getTime();
        const latestAt = latestMsg?.created_at ? new Date(latestMsg.created_at).getTime() : 0;
        if (!latestAt || cachedAt >= latestAt) {
          return json({ ok: true, cached: true, audit: cached });
        }
      }
    }

    const { data: deal } = await admin
      .from("staffing_deals")
      .select("id, account, deal_name, vsd, senior_bopm, principal_bopm, bopm, slack_channel_id")
      .eq("id", dealId)
      .maybeSingle();
    if (!deal) return json({ error: "deal not found" }, 404);

    const channels = (deal.slack_channel_id || "")
      .split(/[,\s]+/)
      .map((s: string) => s.trim())
      .filter(Boolean);

    // Pull last 12wk messages for the deal's channel(s)
    const since = new Date(Date.now() - WINDOW_DAYS * 86400 * 1000).toISOString();
    let messages: Array<{ user_name: string; text: string; created_at: string; channel_id: string }> = [];
    const perChannel: Record<string, { count: number; last: string | null; name: string }> = {};

    if (channels.length) {
      const { data: msgs } = await admin
        .from("slack_messages")
        .select("user_name, text, created_at, channel_id")
        .in("channel_id", channels)
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(1500);
      messages = msgs || [];
      for (const ch of channels) perChannel[ch] = { count: 0, last: null, name: "" };
      for (const m of messages) {
        const p = perChannel[m.channel_id] || { count: 0, last: null, name: "" };
        p.count += 1;
        if (!p.last || m.created_at > p.last) p.last = m.created_at;
        perChannel[m.channel_id] = p;
      }
      // hydrate channel names from slack_channel_health if present
      const { data: health } = await admin
        .from("slack_channel_health")
        .select("channel_id, channel_name")
        .in("channel_id", channels);
      for (const h of health || []) {
        if (h.channel_id && perChannel[h.channel_id]) perChannel[h.channel_id].name = h.channel_name || "";
      }
    }

    const totalMsgs = messages.length;
    // Build a compact transcript for the model (last 400 messages, trimmed)
    const sample = messages.slice(-400).map((m) => {
      const t = (m.text || "").replace(/\s+/g, " ").slice(0, 240);
      return `[${m.created_at.slice(0, 10)}] ${m.user_name || "user"}: ${t}`;
    }).join("\n");

    const channelSummary = Object.entries(perChannel).map(([id, p]) => ({
      channel_id: id,
      channel_name: p.name || id,
      msgs_12wk: p.count,
      last_msg_at: p.last,
      activity: heuristicActivity(p.count, p.last),
    }));

    const { data: health } = await admin
      .from("slack_channel_health")
      .select("reason, msg_count_90d, msg_count_30d, last_msg_at")
      .eq("deal_id", dealId)
      .maybeSingle();
    const healthReason = String(health?.reason || "");
    const healthSentence = healthReason.replace(/[.!?]+$/, "");
    const accessBlocked = totalMsgs === 0 && channels.length > 0 && /bot|permission|scope|not in|cannot read|backend slack/i.test(healthReason);

    let audit: AuditJson;

    if (!LOVABLE_API_KEY || totalMsgs === 0) {
      // Deterministic empty/no-key fallback that matches the screenshot's layout
      audit = {
        rating: totalMsgs === 0 ? "R" : channels.length === 0 ? "R" : "Y",
        health_sentiment: accessBlocked
          ? `Unable to audit Slack activity because the backend Slack bot cannot read the linked channel: ${healthSentence}. This is an ingestion/access issue, not proof that the channel is empty.`
          : totalMsgs === 0
          ? "The channel is completely empty, zero messages in the 12-week window. No delivery activity, no client voice, no coordination of any kind is visible."
          : "Some activity present but not enough context to synthesise sentiment.",
        scope_of_work: accessBlocked ? "Not available because message history could not be read." : totalMsgs === 0 ? "Not stated, channel empty." : "Not stated.",
        customer_cares: "Not stated.",
        engagement: accessBlocked ? "Message count is unavailable because Slack history ingestion is blocked for this channel." : totalMsgs === 0 ? "Zero messages in the window." : `${totalMsgs} messages across ${channels.length} channel(s).`,
        performance_results: "None stated.",
        churn_signals: accessBlocked ? ["Slack access/permission issue is blocking message ingestion"] : totalMsgs === 0 ? ["Dormant channel with no activity whatsoever over 12 weeks"] : [],
        what_is_working: totalMsgs === 0 ? ["None"] : [],
        recommended_action: accessBlocked
          ? "Fix the backend Slack bot membership/scopes, run the Slack Review rebuild, then re-run this audit. Do not treat the current zero-message result as customer inactivity."
          : totalMsgs === 0
          ? "Confirm whether this account is live and being run elsewhere; if active, route all delivery into a tracked channel, if not, treat as churned / inactive."
          : "Add richer context in the Slack channel so audit signals can be extracted.",
        channels: channelSummary.map((c) => ({
          role: "Internal",
          channel: `#${c.channel_name}`,
          msgs_12wk: c.msgs_12wk,
          activity: c.activity,
          audit_status: accessBlocked ? "Access blocked" : "New find (not in original audit)",
        })),
      };
    } else {
      const system = `You are a customer success auditor. Given 12 weeks of Slack messages for a customer account, produce a strict JSON audit. Be concise, factual, and only use evidence from the transcript. Do not invent metrics.`;
      const schemaHint = `Return ONLY JSON matching:
{
  "rating":"R|Y|G",
  "health_sentiment":"1-3 sentences",
  "scope_of_work":"1-2 sentences",
  "customer_cares":"1-2 sentences",
  "engagement":"1-2 sentences with counts if visible",
  "performance_results":"1-2 sentences",
  "churn_signals":["short bullet",...],
  "what_is_working":["short bullet",...],
  "recommended_action":"1-2 sentences"
}
Rating rubric: R = dormant / clear churn signals / heavy escalation, Y = active but issues, G = healthy cadence with delivery + client engagement.`;
      const user = `Account: ${deal.account}\nDeal: ${deal.deal_name}\nVSD: ${deal.vsd || "-"}\nSr BOPM: ${deal.senior_bopm || deal.principal_bopm || "-"}\nChannels: ${channelSummary.map((c) => `#${c.channel_name} (${c.msgs_12wk} msgs, ${c.activity})`).join(", ") || "none"}\nTotal messages (12wk): ${totalMsgs}\n\nTranscript (chronological, may be truncated):\n${sample}`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: `${system}\n${schemaHint}` },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!aiRes.ok) {
        const t = await aiRes.text();
        throw new Error(`AI gateway ${aiRes.status}: ${t.slice(0, 300)}`);
      }
      const aiJson = await aiRes.json();
      const content = aiJson?.choices?.[0]?.message?.content || "{}";
      let parsed: Partial<AuditJson> = {};
      try { parsed = JSON.parse(content); } catch { parsed = {}; }

      audit = {
        rating: (parsed.rating as AuditJson["rating"]) || "Y",
        health_sentiment: parsed.health_sentiment || "",
        scope_of_work: parsed.scope_of_work || "",
        customer_cares: parsed.customer_cares || "",
        engagement: parsed.engagement || "",
        performance_results: parsed.performance_results || "",
        churn_signals: Array.isArray(parsed.churn_signals) ? parsed.churn_signals : [],
        what_is_working: Array.isArray(parsed.what_is_working) ? parsed.what_is_working : [],
        recommended_action: parsed.recommended_action || "",
        channels: channelSummary.map((c) => ({
          role: "Internal",
          channel: `#${c.channel_name}`,
          msgs_12wk: c.msgs_12wk,
          activity: c.activity,
          audit_status: "Auto-audited",
        })),
      };
    }

    const { data: saved, error: upErr } = await admin
      .from("slack_channel_audits")
      .upsert({
        deal_id: dealId,
        rating: audit.rating,
        health_sentiment: audit.health_sentiment,
        scope_of_work: audit.scope_of_work,
        customer_cares: audit.customer_cares,
        engagement: audit.engagement,
        performance_results: audit.performance_results,
        churn_signals: audit.churn_signals,
        what_is_working: audit.what_is_working,
        recommended_action: audit.recommended_action,
        channels: audit.channels,
        window_weeks: 12,
        model: LOVABLE_API_KEY && totalMsgs > 0 ? MODEL : "fallback",
        computed_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (upErr) throw upErr;

    return json({ ok: true, cached: false, audit: saved });
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