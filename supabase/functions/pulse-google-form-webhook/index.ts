// Public endpoint called by a Google Apps Script "on form submit" trigger.
// The script posts each submission as JSON; we match the respondent email to
// the latest open Google Form invite, then record a survey_responses row and
// mark the invite as completed. Legacy token matching remains as a fallback.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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

function text(v: unknown): string {
  const first = firstValue(v);
  if (first == null) return "";
  return String(first).trim();
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

function normalizeEmail(v: unknown): string {
  const m = text(v).toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/i);
  return (m?.[0] || "").trim().toLowerCase();
}

function collectEmailCandidates(answers: Record<string, unknown>): string[] {
  const out: string[] = [];
  const add = (v: unknown) => {
    if (Array.isArray(v)) {
      v.forEach(add);
      return;
    }
    const email = normalizeEmail(v);
    if (email) out.push(email);
  };
  Object.values(answers).forEach(add);
  return Array.from(new Set(out)).slice(0, 10);
}

function collectTokenCandidates(answers: Record<string, unknown>): string[] {
  const out: string[] = [];
  const add = (v: unknown) => {
    if (Array.isArray(v)) {
      v.forEach(add);
      return;
    }
    const s = String(v || "").trim();
    if (/^[a-f0-9]{24,128}$/i.test(s)) out.push(s);
  };
  Object.values(answers).forEach(add);
  return Array.from(new Set(out)).slice(0, 10);
}

function num(v: unknown, min: number, max: number): number | null {
  const raw = text(v);
  if (!raw || /^n\/?a$/i.test(raw)) return null;
  const n = typeof v === "number" ? v : Number(raw.match(/-?\d+(?:\.\d+)?/)?.[0] ?? NaN);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < min || r > max) return null;
  return r;
}

const CSAT_DIMENSIONS = [
  "Quality of the creative output",
  "Briefing & kickoff process",
  "Revisions & feedback handling",
  "Turnaround & delivery",
  "Communication & updates",
  "Ease of day-to-day collaboration",
  "Feeling like a strategic partner",
] as const;

function parseCsatMatrix(v: unknown): { perDimension: Record<string, number | null>; avg: number | null; display: string | null } {
  // Normalize to a 7-slot array indexed by CSAT_DIMENSIONS order.
  let slots: unknown[] = [];
  let cur: unknown = v;
  // Unwrap single-element nested arrays: [["1","2",...]] -> ["1","2",...]
  while (Array.isArray(cur) && cur.length === 1 && Array.isArray(cur[0])) {
    cur = cur[0];
  }
  if (Array.isArray(cur)) {
    slots = cur.slice(0, CSAT_DIMENSIONS.length);
  } else if (cur && typeof cur === "object") {
    const obj = cur as Record<string, unknown>;
    slots = CSAT_DIMENSIONS.map((dim, i) => {
      if (dim in obj) return obj[dim];
      if (String(i) in obj) return obj[String(i)];
      // Loose title match (case/whitespace-insensitive)
      const normDim = dim.toLowerCase().replace(/\s+/g, " ").trim();
      for (const [k, val] of Object.entries(obj)) {
        if (k.toLowerCase().replace(/\s+/g, " ").trim() === normDim) return val;
      }
      return undefined;
    });
  } else if (typeof cur === "string" && /[,\n;|]/.test(cur)) {
    slots = cur.split(/[,\n;|]+/).map((s) => s.trim()).slice(0, CSAT_DIMENSIONS.length);
  } else if (cur == null || cur === "") {
    slots = [];
  } else {
    slots = [cur];
  }

  const perDimension: Record<string, number | null> = {};
  const scores: number[] = [];
  CSAT_DIMENSIONS.forEach((dim, i) => {
    const parsed = num(slots[i], 1, 5);
    perDimension[dim] = parsed;
    if (parsed != null) scores.push(parsed);
  });
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const display = avg == null ? null : `${avg.toFixed(1)}/5`;
  return { perDimension, avg, display };
}

async function logUnmatched(
  admin: ReturnType<typeof createClient>,
  submittedEmail: string | null,
  rawPayload: Record<string, unknown>,
  requestId: string,
  reason: string,
) {
  const { error } = await admin.from("pulse_unmatched_submissions").insert({
    submitted_email: submittedEmail,
    source: "google_form",
    raw_payload: { ...rawPayload, diagnostics: { request_id: requestId, reason } },
  });
  if (error) console.warn("pulse_google_form_webhook_unmatched_log_failed", { request_id: requestId, error: error.message });
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
      has_answers: Object.keys(answers).length > 0,
      answer_keys: safeKeys(answers),
      is_ping: body.ping === true,
      is_test: body.test === true,
    });

    const { data: cfg } = await admin
      .from("pulse_google_form_config")
      .select("webhook_secret, field_map, email_question_title")
      .eq("id", "default")
      .maybeSingle();
    const secret = (cfg?.webhook_secret || "").trim();
    if (!secret) return json({ error: "webhook_not_configured" }, 400);
    const provided = String(body.secret || req.headers.get("x-webhook-secret") || "").trim();
    if (provided !== secret) return json({ error: "invalid_secret" }, 401);

    const fieldMap = (cfg?.field_map && typeof cfg.field_map === "object")
      ? cfg.field_map as FieldMap
      : {};
    const emailQuestionTitle = String(cfg?.email_question_title || fieldMap.email || "Email").trim();

    // Diagnostic mode: allow a synthetic ping that only validates auth+config.
    if (body.ping === true) {
      return json({
        ok: true,
        ping: true,
        request_id: requestId,
        has_field_map: Object.keys(fieldMap).length > 0,
        email_question_title: emailQuestionTitle,
        mapped_fields: Object.keys(fieldMap),
      });
    }

    const emailCandidates = [
      normalizeEmail(body.email),
      normalizeEmail(pickMapped(body, answers, fieldMap, "email")),
      normalizeEmail(emailQuestionTitle ? answers[emailQuestionTitle] : null),
      ...collectEmailCandidates(answers),
    ].filter(Boolean);
    const submittedEmail = Array.from(new Set(emailCandidates))[0] || "";

    let matchSource = submittedEmail ? "email" : "none";
    let invite: any = null;
    if (submittedEmail) {
      const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
      const { data, error } = await admin
        .from("survey_invites")
        .select("id, deal_id, recipient_name, recipient_email, account_snapshot, completed_at, sent_at")
        .eq("source", "google_form")
        .ilike("recipient_email", submittedEmail)
        .is("completed_at", null)
        .gte("sent_at", since)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      invite = data;
    }

    const tokenRaw = hasValue(body.token) ? body.token : pickMapped(body, answers, fieldMap, "tracking_token");
    let token = String(firstValue(tokenRaw) || "").trim();
    const tokenCandidates = !invite && !token ? collectTokenCandidates(answers) : [];
    if (!invite && !token && tokenCandidates.length) token = tokenCandidates[0];
    if (!invite && token && token.length >= 12) {
      const { data, error } = await admin
        .from("survey_invites")
        .select("id, deal_id, recipient_name, recipient_email, account_snapshot, completed_at, sent_at")
        .eq("token", token)
        .maybeSingle();
      if (error) throw error;
      invite = data;
      if (invite) matchSource = "legacy_token";
    }

    if (!submittedEmail && !invite) {
      await logUnmatched(admin, null, { body, answers, answer_keys: safeKeys(answers) }, requestId, "missing_email");
      console.warn("pulse_google_form_webhook_missing_email", {
        request_id: requestId,
        email_question_title: emailQuestionTitle,
        answer_keys: safeKeys(answers),
      });
      return json({
        ok: false,
        error: "missing_email",
        diagnostic: "Apps Script reached the webhook, but the submitted answers did not include a valid respondent email. Make sure the Google Form question title matches the Email question title in Settings.",
        request_id: requestId,
        expected_email_question: emailQuestionTitle,
        answer_keys: safeKeys(answers),
      }, 400);
    }

    if (!invite) {
      await logUnmatched(admin, submittedEmail || null, { body, answers, answer_keys: safeKeys(answers) }, requestId, "no_matching_open_invite");
      console.warn("pulse_google_form_webhook_no_matching_invite", { request_id: requestId, submitted_email: submittedEmail });
      return json({
        ok: false,
        error: "no_matching_open_invite",
        diagnostic: "Submission received, but no pending Google Form invite was found for this email in the last 60 days. It has been saved under unmatched submissions for admin review.",
        request_id: requestId,
        submitted_email: submittedEmail,
      }, 202);
    }

    if (invite.completed_at) {
      return json({ ok: true, already: true, inviteId: invite.id, request_id: requestId, match_source: matchSource });
    }

    // Prefer top-level fields, else fall back to answers[fieldMap[key]].
    const nps = num(firstValue(pickMapped(body, answers, fieldMap, "nps")), 0, 10);
    const csatRaw = pickMapped(body, answers, fieldMap, "csat");
    const csatMatrix = parseCsatMatrix(csatRaw);
    const csat = csatMatrix.avg;
    try {
      const rawSample = typeof csatRaw === "string"
        ? csatRaw.slice(0, 200)
        : JSON.stringify(csatRaw)?.slice(0, 300);
      console.info("pulse_google_form_webhook_csat_parsed", {
        request_id: requestId,
        raw_type: Array.isArray(csatRaw) ? "array" : csatRaw === null ? "null" : typeof csatRaw,
        raw_sample: rawSample,
        perDimension: csatMatrix.perDimension,
        avg: csatMatrix.avg,
        display: csatMatrix.display,
      });
    } catch (_) { /* ignore log errors */ }
    const commentRaw = firstValue(pickMapped(body, answers, fieldMap, "comment"));
    const comment = commentRaw != null ? String(commentRaw).slice(0, 4000) : null;

    // Structured warning when a mapping was configured but the field is missing.
    const missingMapped: string[] = [];
    for (const key of ["email", "nps", "csat", "comment"] as const) {
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
        email_ok: !!submittedEmail,
        submitted_email: submittedEmail || invite.recipient_email,
        match_source: matchSource,
        would_write_response: true,
        parsed: { nps, csat, csat_display: csatMatrix.display, csat_dimensions: csatMatrix.perDimension, has_comment: !!comment },
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
      respondent_email: submittedEmail || invite.recipient_email || null,
      respondent_company: invite.account_snapshot || null,
      source: "google_form",
      submitted_at: now,
      payload: {
        comment,
        answers,
        raw: body,
        csat_dimensions: csatMatrix.perDimension,
        csat_display: csatMatrix.display,
        diagnostics: { request_id: requestId, missing_mapped: missingMapped, match_source: matchSource, submitted_email: submittedEmail },
      },
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

    console.info("pulse_google_form_webhook_recorded", { request_id: requestId, invite_id: invite.id, match_source: matchSource, missing: missingMapped });
    return json({ ok: true, inviteId: invite.id, request_id: requestId, match_source: matchSource, missing_mapped: missingMapped });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("pulse_google_form_webhook_error", { request_id: requestId, error: msg });
    return json({ ok: false, error: msg, request_id: requestId }, 500);
  }
});