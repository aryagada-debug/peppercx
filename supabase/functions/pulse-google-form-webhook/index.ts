// Public endpoint called by a Google Apps Script "on form submit" trigger.
// The script posts each submission as JSON; we look up the invite by its
// tracking token, then record a survey_responses row and mark the invite
// as completed.
//
// Expected POST body:
// {
//   "secret": "<shared secret from pulse_google_form_config.webhook_secret>",
//   "token": "<value the respondent's browser sent for the hidden entry>",
//   "nps": 8,               // optional number 0..10
//   "csat": 4,              // optional number 1..5
//   "comment": "…",         // optional free text
//   "answers": { ... }      // full raw {question: answer} map (stored on payload)
// }
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

function num(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "string" ? Number(v) : (typeof v === "number" ? v : NaN);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < min || r > max) return null;
  return r;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: cfg } = await admin
      .from("pulse_google_form_config")
      .select("webhook_secret, field_map")
      .eq("id", "default")
      .maybeSingle();
    const secret = (cfg?.webhook_secret || "").trim();
    if (!secret) return json({ error: "webhook_not_configured" }, 400);
    const provided = String(body.secret || req.headers.get("x-webhook-secret") || "").trim();
    if (provided !== secret) return json({ error: "invalid_secret" }, 401);

    const token = String(body.token || "").trim();
    if (!token || token.length < 12) return json({ error: "invalid_token" }, 400);

    const { data: invite, error: invErr } = await admin
      .from("survey_invites")
      .select("id, deal_id, recipient_name, recipient_email, account_snapshot, completed_at")
      .eq("token", token)
      .maybeSingle();
    if (invErr) throw invErr;
    if (!invite) return json({ error: "invite_not_found" }, 404);

    if (invite.completed_at) {
      return json({ ok: true, already: true, inviteId: invite.id });
    }

    const answers = (body.answers && typeof body.answers === "object") ? body.answers as Record<string, unknown> : {};
    const nps = num(body.nps, 0, 10);
    const csat = num(body.csat, 1, 5);
    const comment = body.comment != null ? String(body.comment).slice(0, 4000) : null;

    const { error: insErr } = await admin.from("survey_responses").insert({
      invite_id: invite.id,
      deal_id: invite.deal_id,
      nps,
      csat_avg: csat,
      respondent_name: invite.recipient_name || null,
      respondent_email: invite.recipient_email || null,
      respondent_company: invite.account_snapshot || null,
      source: "google_form",
      payload: { comment, answers, raw: body },
    });
    if (insErr) throw insErr;

    await admin
      .from("survey_invites")
      .update({
        completed_at: new Date().toISOString(),
        opened_at: new Date().toISOString(),
      })
      .eq("id", invite.id);

    return json({ ok: true, inviteId: invite.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});