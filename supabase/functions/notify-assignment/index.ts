// Sends a Slack DM to a person when they are assigned to a deal or task.
// Branded as if from the deal's VSD (overrides bot username).
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type NotifyKind = "staffing" | "task";

interface Body {
  kind: NotifyKind;
  personId?: string;       // staffing_people.id (preferred)
  assigneeName?: string;   // fallback lookup by exact name (used by tasks)
  dealId: string;          // staffing_deals.id
  // staffing
  roleKey?: string;
  allocationPct?: number;
  // task
  taskTitle?: string;
  taskUrgency?: string;
  taskDueDate?: string;
}

async function slack<T = any>(method: string, body: Record<string, unknown>): Promise<T> {
  const r = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  return await r.json();
}

async function resolveSlackUser(person: { email?: string; slack_user_id?: string }): Promise<string | null> {
  if (person.slack_user_id && person.slack_user_id.trim()) return person.slack_user_id.trim();
  if (person.email && person.email.trim()) {
    const j = await slack<{ ok: boolean; user?: { id: string }; error?: string }>(
      "users.lookupByEmail",
      { email: person.email.trim() }
    );
    if (j.ok && j.user?.id) return j.user.id;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!SLACK_BOT_TOKEN) throw new Error("SLACK_BOT_TOKEN not configured");

    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = auth.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as Body;
    if (!body || !body.kind || !body.dealId || (!body.personId && !body.assigneeName)) {
      return new Response(JSON.stringify({ error: "kind, dealId and (personId or assigneeName) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Resolve person — by id when available, else by exact name match.
    let personQuery = admin.from("staffing_people").select("id,name,email,slack_user_id").limit(1);
    if (body.personId) personQuery = personQuery.eq("id", body.personId);
    else personQuery = personQuery.ilike("name", body.assigneeName!.trim());

    const [personRes, dealRes] = await Promise.all([
      personQuery.maybeSingle(),
      admin.from("staffing_deals").select("id,deal_name,account,vsd").eq("id", body.dealId).maybeSingle(),
    ]);

    const person = personRes.data as any;
    const deal = dealRes.data as any;
    if (!person) {
      return new Response(JSON.stringify({ skipped: true, reason: "person_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!deal) {
      return new Response(JSON.stringify({ skipped: true, reason: "deal_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const slackUserId = await resolveSlackUser(person);
    if (!slackUserId) {
      return new Response(JSON.stringify({
        skipped: true,
        reason: "no_slack_mapping",
        hint: "Set the person's email or slack_user_id in Staffing → People to enable DMs.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Open DM
    const open = await slack<{ ok: boolean; channel?: { id: string }; error?: string }>(
      "conversations.open",
      { users: slackUserId }
    );
    if (!open.ok || !open.channel?.id) {
      return new Response(JSON.stringify({ error: "slack_open_failed", detail: open }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compose VSD-branded message
    const vsdName = (deal.vsd || "").trim() || "Your VSD";
    const dealLabel = `${deal.account ? `${deal.account} — ` : ""}${deal.deal_name || deal.id}`;

    let header = "";
    let detail = "";
    if (body.kind === "staffing") {
      header = `:wave: You've been added to *${dealLabel}*`;
      const bits: string[] = [];
      if (body.roleKey) bits.push(`Role: *${body.roleKey}*`);
      if (typeof body.allocationPct === "number" && body.allocationPct > 0) bits.push(`Allocation: *${body.allocationPct}%*`);
      detail = bits.length ? bits.join(" · ") : "You're now part of the deal team.";
    } else {
      header = `:clipboard: New task on *${dealLabel}*`;
      const bits: string[] = [];
      if (body.taskTitle) bits.push(`*${body.taskTitle}*`);
      if (body.taskUrgency) bits.push(`Urgency: ${body.taskUrgency}`);
      if (body.taskDueDate) bits.push(`Due: ${body.taskDueDate}`);
      detail = bits.join(" · ");
    }

    const text = `${header}\n${detail}\n_From ${vsdName}_`;

    const post = await slack<{ ok: boolean; ts?: string; error?: string }>("chat.postMessage", {
      channel: open.channel.id,
      text,
      username: vsdName,
      icon_emoji: ":bust_in_silhouette:",
      unfurl_links: false,
      unfurl_media: false,
    });

    if (!post.ok) {
      return new Response(JSON.stringify({ error: "slack_post_failed", detail: post }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, ts: post.ts, dm: open.channel.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});