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

type FieldMap = Record<string, string>;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
}

function hasValue(v: unknown): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim() !== "";
}

function firstValue(v: unknown): unknown {
  return Array.isArray(v) ? v[0] : v;
}

function pickMapped(
  body: Record<string, unknown>,
  answers: Record<string, unknown>,
  fieldMap: FieldMap,
  key: string,
): unknown {
  if (hasValue(body[key])) return body[key];
  const label = fieldMap[key];
  if (label && hasValue(answers[label])) return answers[label];
  return null;
}

function safeKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).slice(0, 60);
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
  const requestId = crypto.randomUUID();
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const answers = asRecord(body.answers);

    console.info("pulse_google_form_webhook_request", {
      request_id: requestId,
      has_token: hasValue(body.token),
      has_answers: Object.keys(answers).length > 0,
      answer_keys: safeKeys(answers),
      is_ping: body.ping === true,
      is_test: body.test === true,
    });

    const { data: cfg } = await admin
      .from("pulse_google_form_config")
      .select("webhook_secret, field_map")
      .eq("id", "default")
      .maybeSingle();
    const secret = (cfg?.webhook_secret || "").trim();
    if (!secret) return json({ error: "webhook_not_configured" }, 400);
    const provided = String(body.secret || req.headers.get("x-webhook-secret") || "").trim();
    if (provided !== secret) return json({ error: "invalid_secret" }, 401);

    const fieldMap = (cfg?.field_map && typeof cfg.field_map === "object")
      ? cfg.field_map as FieldMap
      : {};

    // Diagnostic mode: allow a synthetic ping that only validates auth+config.
    if (body.ping === true) {
      return json({
        ok: true,
        ping: true,
        request_id: requestId,
        has_field_map: Object.keys(fieldMap).length > 0,
        has_tracking_token_map: !!fieldMap.tracking_token,
        mapped_fields: Object.keys(fieldMap),
      });
    }

    const tokenRaw = pickMapped(body, answers, fieldMap, "tracking_token");
    const token = String(firstValue(tokenRaw) || "").trim();
    if (!token || token.length < 12) {
      console.warn("pulse_google_form_webhook_invalid_token", {
        request_id: requestId,
        has_top_level_token: hasValue(body.token),
        tracking_token_map: fieldMap.tracking_token || null,
        answer_keys: safeKeys(answers),
      });
      return json({
        ok: false,
        error: "invalid_token",
        diagnostic: "Apps Script reached the webhook, but it did not send a valid tracking token. Map field_map.tracking_token to the exact Google Form question title, or send token as a top-level field.",
        request_id: requestId,
        expected_tracking_question: fieldMap.tracking_token || null,
        answer_keys: safeKeys(answers),
      }, 400);
    }

    const { data: invite, error: invErr } = await admin
      .from("survey_invites")
      .select("id, deal_id, recipient_name, recipient_email, account_snapshot, completed_at")
      .eq("token", token)
      .maybeSingle();
    if (invErr) throw invErr;
    if (!invite) {
      console.warn("pulse_google_form_webhook_invite_not_found", { request_id: requestId, token_preview: `${token.slice(0, 8)}…` });
      return json({ ok: false, error: "invite_not_found", request_id: requestId }, 404);
    }

    if (invite.completed_at) {
      return json({ ok: true, already: true, inviteId: invite.id, request_id: requestId });
    }

    // Prefer top-level fields, else fall back to answers[fieldMap[key]].
    const nps = num(firstValue(pickMapped(body, answers, fieldMap, "nps")), 0, 10);
    const csat = num(firstValue(pickMapped(body, answers, fieldMap, "csat")), 1, 5);
    const commentRaw = firstValue(pickMapped(body, answers, fieldMap, "comment"));
    const comment = commentRaw != null ? String(commentRaw).slice(0, 4000) : null;

    // Structured warning when a mapping was configured but the field is missing.
    const missingMapped: string[] = [];
    for (const key of ["tracking_token", "nps", "csat", "comment"] as const) {
      const label = fieldMap[key];
      if (label && !hasValue(answers[label]) && !hasValue(body[key])) missingMapped.push(key);
    }
    if (missingMapped.length) {
      console.warn("pulse_google_form_webhook_missing_mapped_field", {
        request_id: requestId,
        invite_id: invite.id,
        missing: missingMapped,
        answer_keys: safeKeys(answers),
      });
    }

    if (body.test === true) {
      return json({
        ok: true,
        test: true,
        request_id: requestId,
        inviteId: invite.id,
        token_ok: true,
        would_write_response: true,
        parsed: { nps, csat, has_comment: !!comment },
        missing_mapped: missingMapped,
      });
    }

    const now = new Date().toISOString();

    const { error: insErr } = await admin.from("survey_responses").insert({
      invite_id: invite.id,
      deal_id: invite.deal_id,
      nps,
      csat_avg: csat,
      respondent_name: invite.recipient_name || null,
      respondent_email: invite.recipient_email || null,
      respondent_company: invite.account_snapshot || null,
      source: "google_form",
      submitted_at: now,
      payload: { comment, answers, raw: body, diagnostics: { request_id: requestId, missing_mapped: missingMapped } },
    });
    if (insErr) throw insErr;

    await admin
      .from("survey_invites")
      .update({
        completed_at: now,
        opened_at: now,
        updated_at: now,
      })
      .eq("id", invite.id);

    console.info("pulse_google_form_webhook_recorded", { request_id: requestId, invite_id: invite.id, missing: missingMapped });
    return json({ ok: true, inviteId: invite.id, request_id: requestId, missing_mapped: missingMapped });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("pulse_google_form_webhook_error", { request_id: requestId, error: msg });
    return json({ ok: false, error: msg, request_id: requestId }, 500);
  }
});