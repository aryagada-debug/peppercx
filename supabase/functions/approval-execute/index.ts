import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const slackToken = () => Deno.env.get("SLACK_BOT_TOKEN") || "";
async function slack(method: string, body: Record<string, unknown>) {
  const token = slackToken();
  if (!token) return { ok: false, skipped: "no_slack_token" };
  const r = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  return await r.json();
}

async function notifyPerson(person: any, text: string) {
  const token = slackToken();
  if (!token || !person) return;
  let slackUserId = (person.slack_user_id || "").trim();
  if (!slackUserId && person.email) {
    const lookup: any = await slack("users.lookupByEmail", { email: person.email });
    slackUserId = lookup?.ok ? lookup.user?.id || "" : "";
  }
  if (!slackUserId) return;
  const opened: any = await slack("conversations.open", { users: slackUserId });
  const channel = opened?.channel?.id;
  if (channel) await slack("chat.postMessage", { channel, text, unfurl_links: false, unfurl_media: false });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate JWT
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userRes.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify role
    const { data: roleRows } = await admin
      .from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows || []).map((r: any) => r.role);
    if (!roles.includes("admin") && !roles.includes("member")) {
      return new Response(JSON.stringify({ error: "Forbidden — admin or member only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestId = body?.request_id;
    const editSummary = String(body?.edit_summary || "").trim();
    if (!requestId) {
      return new Response(JSON.stringify({ error: "request_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: reqRow, error: rErr } = await admin
      .from("approval_requests").select("*").eq("id", requestId).maybeSingle();
    if (rErr || !reqRow) {
      return new Response(JSON.stringify({ error: "Request not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (reqRow.status === "approved") {
      return new Response(JSON.stringify({ ok: true, message: "Already applied" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (reqRow.status === "rejected" || reqRow.status === "cancelled") {
      return new Response(JSON.stringify({ error: "Request is not approvable" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const p = reqRow.payload || {};

    switch (reqRow.request_type) {
      case "staffing.add": {
        await admin.from("staffing_assignments").insert({
          id: p.id,
          deal_id: p.dealId,
          person_id: p.personId,
          role_key: p.roleKey || "",
          allocation_pct: p.allocationPct ?? 0,
          start_date: p.startDate || null,
          end_date: p.endDate || null,
        });
        break;
      }
      case "staffing.update": {
        const patch: any = {};
        if (p.allocationPct !== undefined) patch.allocation_pct = p.allocationPct;
        if (p.roleKey !== undefined) patch.role_key = p.roleKey;
        if (p.personId !== undefined) patch.person_id = p.personId;
        if (p.startDate !== undefined) patch.start_date = p.startDate || null;
        if (p.endDate !== undefined) patch.end_date = p.endDate || null;
        await admin.from("staffing_assignments").update(patch).eq("id", p.id);
        break;
      }
      case "staffing.remove": {
        await admin.from("staffing_assignments").delete().eq("id", p.id);
        break;
      }
      case "client.create": {
        await admin.from("clients").insert(p);
        break;
      }
      case "deal.create": {
        // Insert minimal staffing_deal row; full wizard flow is handled by re-running it client-side, but we accept the payload
        await admin.from("staffing_deals").insert(p);
        break;
      }
      case "deal.update": {
        const targetId = reqRow.target_id;
        if (!targetId) {
          return new Response(JSON.stringify({ error: "Missing target_id for deal.update" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        await admin.from("staffing_deals").update(p).eq("id", targetId);
        break;
      }
      default:
        return new Response(JSON.stringify({ error: "Unknown request_type" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Mark as approved
    const { data: profile } = await admin
      .from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
    await admin.from("approval_requests").update({
      status: "approved",
      reviewer_id: userId,
      reviewer_name: (profile as any)?.display_name || userRes.user.email || "",
      decided_at: new Date().toISOString(),
    }).eq("id", requestId);

    if (editSummary) {
      const dealId = reqRow.target_id || reqRow.deal_id || p.dealId || p.id || "";
      const { data: deal } = dealId
        ? await admin.from("staffing_deals").select("id, deal_name, account, vsd, principal_bopm, senior_bopm, bopm").eq("id", dealId).maybeSingle()
        : { data: null } as any;
      const dealLike: any = deal || p || {};
      const names = Array.from(new Set([
        dealLike.vsd,
        dealLike.principal_bopm,
        dealLike.senior_bopm,
        dealLike.bopm,
      ].map((v) => String(v || "").trim()).filter(Boolean)));
      const peopleByName = names.length
        ? await admin.from("staffing_people").select("id, name, email, slack_user_id").in("name", names)
        : { data: [] } as any;
      const concernedId = p.personId || reqRow.target_kind === "staffing_assignment" ? p.personId : "";
      const concerned = concernedId
        ? await admin.from("staffing_people").select("id, name, email, slack_user_id").eq("id", concernedId).maybeSingle()
        : { data: null } as any;
      const recipients = new Map<string, any>();
      ((peopleByName.data || []) as any[]).forEach((person) => recipients.set(person.id, person));
      if (concerned.data) recipients.set((concerned.data as any).id, concerned.data);
      const dealLabel = `${dealLike.account ? `${dealLike.account} — ` : ""}${dealLike.deal_name || reqRow.deal_id || reqRow.target_id || "approval request"}`;
      const text = `Approval updated and approved for ${dealLabel}. ${editSummary}`;
      await Promise.all(Array.from(recipients.values()).map((person) => notifyPerson(person, text)));
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
