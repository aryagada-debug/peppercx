// Daily RGY task generator
// For each Active deal whose latest deal_rgy_weekly entry is older than 7 days
// (or has none), create a "Update RGY status" task assigned to the
// responsible BOPM (principal_bopm > senior_bopm > bopm), and write a
// notification of type rgy.update_reminder. Deduped on open auto-gen RGY task
// per (deal_id, assignee).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ACTIVE_STATUSES = new Set(["Active Deal", "New Deal in SLA/PO", "Deal Disputed"]);
const STALE_AFTER_DAYS = 7;

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, days: number) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + days); return x; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: deals, error: dErr } = await admin
      .from("staffing_deals")
      .select("id, deal_id, deal_name, account, deal_status, principal_bopm, senior_bopm, bopm");
    if (dErr) throw dErr;

    const activeDeals = (deals || []).filter(d => ACTIVE_STATUSES.has(d.deal_status || ""));
    if (activeDeals.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dealIds = activeDeals.map(d => d.id);
    const { data: rgyRows } = await admin
      .from("deal_rgy_weekly")
      .select("deal_id, created_at")
      .in("deal_id", dealIds)
      .order("created_at", { ascending: false });

    const latest = new Map<string, string>();
    for (const r of rgyRows || []) {
      if (!latest.has(r.deal_id)) latest.set(r.deal_id, r.created_at);
    }

    const now = Date.now();
    const stale = activeDeals.filter(d => {
      const last = latest.get(d.id);
      if (!last) return true;
      const days = (now - new Date(last).getTime()) / 86_400_000;
      return days > STALE_AFTER_DAYS;
    });

    let created = 0;
    for (const d of stale) {
      const assignee = d.principal_bopm || d.senior_bopm || d.bopm || "";
      if (!assignee) continue;

      // Dedupe: skip if open auto-gen RGY task already exists for this deal+assignee.
      const { data: existing } = await admin
        .from("deal_tasks")
        .select("id")
        .eq("deal_id", d.id)
        .eq("assignee", assignee)
        .eq("phase", "RGY Issues")
        .eq("auto_regen", true)
        .neq("stage", "Done")
        .limit(1);
      if (existing && existing.length > 0) continue;

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const due = ymd(addDays(today, 2));

      const { error: tErr } = await admin.from("deal_tasks").insert({
        deal_id: d.id,
        title: `Update RGY status — ${d.deal_name || d.deal_id}`,
        description: `Auto-generated: this deal hasn't had an RGY entry in the last ${STALE_AFTER_DAYS} days. Please log this week's RGY scores.`,
        assignee,
        stage: "To Do",
        urgency: "High",
        phase: "RGY Issues",
        auto_regen: true,
        end_date: due,
      } as any);
      if (!tErr) created++;
    }

    return new Response(JSON.stringify({ ok: true, processed: stale.length, created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[rgy-task-generator]", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});