import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
