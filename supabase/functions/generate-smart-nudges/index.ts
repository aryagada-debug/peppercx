import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") || "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Resolve aliases (display name + staffing name + email)
    const { data: profile } = await userClient
      .from("profiles").select("display_name, staffing_person_id").eq("user_id", userId).maybeSingle();
    const aliases = new Set<string>();
    if (profile?.display_name) aliases.add(profile.display_name.toLowerCase().trim());
    if (userData.user.email) aliases.add(userData.user.email.toLowerCase().trim());
    if (profile?.staffing_person_id) {
      const { data: p } = await userClient.from("staffing_people")
        .select("name").eq("id", profile.staffing_person_id).maybeSingle();
      if (p?.name) aliases.add(p.name.toLowerCase().trim());
    }

    // Pull signals
    const aliasArr = Array.from(aliases);
    const [{ data: deals }, { data: rgyOpen }, { data: inactive }, { data: openTasks }] = await Promise.all([
      userClient.from("staffing_deals")
        .select("id, deal_name, account, vsd, principal_bopm, senior_bopm, bopm, end_date, deal_status, mrr")
        .in("deal_status", ["Active Deal", "New Deal in SLA/PO"]).limit(500),
      userClient.from("deal_rgy_weekly")
        .select("deal_id, issue_details, issue_status, resolution_due_date, week_start")
        .eq("issue_status", "Open").limit(50),
      userClient.from("slack_inactivity_nudges")
        .select("deal_id, message_count, week_start").limit(50),
      userClient.from("deal_tasks")
        .select("id, title, deal_id, end_date, urgency, stage, assignee").neq("stage", "Done").limit(200),
    ]);

    const inAliases = (s: string | null) => !!s && aliases.has(s.toLowerCase().trim());
    const myDeals = (deals || []).filter((d: any) =>
      inAliases(d.vsd) || inAliases(d.principal_bopm) || inAliases(d.senior_bopm) || inAliases(d.bopm)
    );
    const myDealIds = new Set(myDeals.map((d: any) => d.id));
    const dealById = new Map(myDeals.map((d: any) => [d.id, d]));
    const myRgy = (rgyOpen || []).filter((r: any) => myDealIds.has(r.deal_id));
    const myInactive = (inactive || []).filter((r: any) => myDealIds.has(r.deal_id));
    const myTasks = (openTasks || []).filter((t: any) => inAliases(t.assignee));

    // Contract expiry within 30 days
    const today = new Date();
    const expiring = myDeals.filter((d: any) => {
      if (!d.end_date) return false;
      const end = new Date(d.end_date);
      const diff = (end.getTime() - today.getTime()) / 86400000;
      return diff >= 0 && diff <= 30;
    });

    // Build nudge candidates from rules
    type Nudge = {
      type: string; text: string;
      target_entity_type: string; target_entity_id: string; target_entity_name: string;
      primary_action_label: string; primary_action_href: string;
      confidence: number;
    };
    const nudges: Nudge[] = [];

    myRgy.slice(0, 3).forEach((r: any) => {
      const d = dealById.get(r.deal_id);
      nudges.push({
        type: "stale_deal",
        text: `Open RGY issue on ${d?.deal_name || r.deal_id}: ${(r.issue_details || "needs attention").slice(0, 120)}`,
        target_entity_type: "deal", target_entity_id: r.deal_id, target_entity_name: d?.deal_name || r.deal_id,
        primary_action_label: "Review issue", primary_action_href: `/deals/${r.deal_id}?tab=RGY+Health`,
        confidence: 0.9,
      });
    });
    myInactive.slice(0, 3).forEach((r: any) => {
      const d = dealById.get(r.deal_id);
      nudges.push({
        type: "stale_deal",
        text: `Slack channel for ${d?.deal_name || r.deal_id} has only ${r.message_count} team msgs in the last 7d`,
        target_entity_type: "deal", target_entity_id: r.deal_id, target_entity_name: d?.deal_name || r.deal_id,
        primary_action_label: "Open deal", primary_action_href: `/deals/${r.deal_id}?tab=MBR`,
        confidence: 0.7,
      });
    });
    expiring.slice(0, 3).forEach((d: any) => {
      const days = Math.round((new Date(d.end_date).getTime() - today.getTime()) / 86400000);
      nudges.push({
        type: "renewal_risk",
        text: `${d.deal_name} contract expires in ${days} day${days === 1 ? "" : "s"} — start renewal motion`,
        target_entity_type: "deal", target_entity_id: d.id, target_entity_name: d.deal_name,
        primary_action_label: "Open deal", primary_action_href: `/deals/${d.id}`,
        confidence: 0.85,
      });
    });
    const overdueTasks = myTasks.filter((t: any) => t.end_date && new Date(t.end_date) < today);
    if (overdueTasks.length >= 3) {
      nudges.push({
        type: "pipeline_gap",
        text: `You have ${overdueTasks.length} overdue tasks across ${new Set(overdueTasks.map((t:any)=>t.deal_id)).size} deals`,
        target_entity_type: "tasks", target_entity_id: "", target_entity_name: "Overdue tasks",
        primary_action_label: "Review tasks", primary_action_href: "/home",
        confidence: 0.8,
      });
    }

    // Optionally enrich with AI (rephrase top 3 in punchier voice).
    if (LOVABLE_API_KEY && nudges.length > 0) {
      try {
        const top = nudges.slice(0, 5);
        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "Rewrite each nudge as one short, punchy sentence (<=110 chars). Keep entity names and numbers verbatim. Reply as a JSON array of strings, same order, same length." },
              { role: "user", content: JSON.stringify(top.map(n => n.text)) },
            ],
          }),
        });
        if (r.ok) {
          const j = await r.json();
          const content: string = j.choices?.[0]?.message?.content || "";
          const m = content.match(/\[[\s\S]*\]/);
          if (m) {
            const arr = JSON.parse(m[0]);
            if (Array.isArray(arr)) arr.forEach((s, i) => { if (typeof s === "string" && s.trim() && top[i]) top[i].text = s.trim(); });
          }
        }
      } catch (e) {
        console.error("AI enrich failed", e);
      }
    }

    // Replace existing non-dismissed nudges for this user
    await userClient.from("smart_nudges").delete().eq("user_id", userId).eq("dismissed", false);
    if (nudges.length > 0) {
      const rows = nudges.map(n => ({ ...n, user_id: userId, generated_at: new Date().toISOString() }));
      const { error } = await userClient.from("smart_nudges").insert(rows);
      if (error) console.error("insert nudges", error);
    }

    return new Response(JSON.stringify({ count: nudges.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-smart-nudges error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});