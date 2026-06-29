// Public (anon) endpoint that records a Pepper Pulse survey response and
// marks the corresponding invite as opened / completed.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Body = {
  token?: string;
  action?: "opened";
  payload?: Record<string, unknown>;
};

function numberInRange(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (!Number.isInteger(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const token = (body.token || "").trim();
    if (!token) return json({ error: "missing_token" }, 400);
    if (token.length < 12 || token.length > 256) return json({ error: "invalid_token" }, 404);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: invite, error: invErr } = await admin
      .from("survey_invites")
      .select("id, deal_id, recipient_name, recipient_email, completed_at")
      .eq("token", token)
      .maybeSingle();
    if (invErr) throw invErr;
    if (!invite) return json({ error: "invalid_token" }, 404);

    if (body.action === "opened") {
      await admin
        .from("survey_invites")
        .update({ opened_at: new Date().toISOString() })
        .eq("id", invite.id)
        .is("opened_at", null);
      return json({ ok: true });
    }

    if (invite.completed_at) {
      return json({ error: "already_submitted" }, 409);
    }

    const payload = body.payload || {};
    const p = payload as Record<string, any>;
    const nps = numberInRange(p?.nps?.score, 0, 10);
    const csat = numberInRange(p?.experience?.avg, 1, 5);
    if (nps === null) return json({ error: "invalid_nps" }, 400);
    if (csat === null) return json({ error: "invalid_csat" }, 400);
    const ces = p?.effort?.ces ?? null;
    const renew = p?.retention?.renewal_intent ?? null;
    const mood = p?.sentiment?.mood ?? null;
    const churn = p?.flags?.churn_risk ?? null;
    const r = p?.respondent || {};

    const { error: insErr } = await admin.from("survey_responses").insert({
      invite_id: invite.id,
      deal_id: invite.deal_id,
      nps,
      csat_avg: csat,
      ces: typeof ces === "number" ? ces : null,
      renew,
      mood,
      churn_risk: churn,
      respondent_name: r.name || invite.recipient_name || null,
      respondent_email: r.email || invite.recipient_email || null,
      respondent_company: r.company || null,
      wants_followup: r.wants_followup || null,
      payload,
    });
    if (insErr) throw insErr;

    await admin
      .from("survey_invites")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", invite.id);

    return json({ ok: true, inviteId: invite.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});