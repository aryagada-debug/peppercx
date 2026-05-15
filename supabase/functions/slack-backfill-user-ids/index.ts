// Backfills staffing_people.slack_user_id by looking up each person's email via Slack users.lookupByEmail.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function slackApi(path: string) {
  const r = await fetch(`https://slack.com/api/${path}`, {
    headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
  });
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!SLACK_BOT_TOKEN) return json({ error: "SLACK_BOT_TOKEN not configured" }, 500);
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);

    let onlyMissing = true;
    let onlyEmail: string | null = null;
    try {
      const body = await req.json();
      if (body && typeof body === "object") {
        if (body.all === true) onlyMissing = false;
        if (typeof body.email === "string") onlyEmail = body.email;
      }
    } catch (_) { /* no body */ }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const limit = 80;
    let q = admin.from("staffing_people")
      .select("id, email, slack_user_id, name")
      .eq("leaving", false)
      .eq("tbh", false)
      .not("email", "is", null)
      .limit(limit);
    if (onlyMissing) q = q.or("slack_user_id.is.null,slack_user_id.eq.");
    if (onlyEmail) q = q.ilike("email", onlyEmail);
    const { data: people, error } = await q;
    if (error) return json({ error: error.message }, 500);

    const results = { total: people?.length || 0, resolved: 0, not_found: 0, errors: 0, samples: [] as any[] };
    for (const p of people || []) {
      const email = (p.email || "").trim();
      if (!email) continue;
      const j = await slackApi(`users.lookupByEmail?email=${encodeURIComponent(email)}`);
      if (j.ok && j.user?.id) {
        const upd = await admin.from("staffing_people").update({ slack_user_id: j.user.id }).eq("id", p.id);
        if (upd.error) { results.errors++; results.samples.push({ email, error: upd.error.message }); }
        else results.resolved++;
      } else if (j.error === "users_not_found") {
        results.not_found++;
      } else if (j.error === "ratelimited") {
        await new Promise((r) => setTimeout(r, 1500));
        results.errors++;
        results.samples.push({ email, error: "ratelimited" });
      } else {
        results.errors++;
        if (results.samples.length < 10) results.samples.push({ email, error: j.error });
      }
      // Light pacing for Slack tier rate limits (~50/min for lookupByEmail).
      await new Promise((r) => setTimeout(r, 120));
    }

    return json({ ok: true, ...results });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});