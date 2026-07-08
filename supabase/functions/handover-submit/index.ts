import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function bad(status: number, error: string) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function s(v: unknown, max = 500): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}
function n(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function generateReference(): string {
  const d = new Date();
  const y = d.getUTCFullYear().toString().slice(-2);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `HO-${y}${m}-${rand}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return bad(405, "method_not_allowed");

  let body: any;
  try {
    body = await req.json();
  } catch {
    return bad(400, "invalid_json");
  }
  const p = body?.payload ?? body ?? {};

  const sp_email = s(p.sp_email, 255).toLowerCase();
  const sp_name = s(p.sp_name, 200);
  const company_name = s(p.company_name, 300);
  if (!sp_name) return bad(400, "sp_name_required");
  if (!sp_email || !EMAIL_RE.test(sp_email)) return bad(400, "sp_email_invalid");
  if (!company_name) return bad(400, "company_name_required");
  if (!s(p.stage, 100)) return bad(400, "stage_required");
  if (!s(p.bu, 100)) return bad(400, "bu_required");
  if (!s(p.capability, 100)) return bad(400, "capability_required");
  if (!s(p.deal_type, 100)) return bad(400, "deal_type_required");

  // Simple abuse guard: max 5 submissions per email per hour
  {
    const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("deal_handovers")
      .select("id", { count: "exact", head: true })
      .eq("sp_email", sp_email)
      .gte("created_at", sinceIso);
    if ((count ?? 0) >= 5) return bad(429, "rate_limited");
  }

  const contactsRaw = Array.isArray(p.contacts) ? p.contacts.slice(0, 20) : [];
  const contacts = contactsRaw.map((c: any) => ({
    name: s(c?.name, 200),
    role: s(c?.role, 200),
    email: s(c?.email, 255),
    phone: s(c?.phone, 50),
  }));

  const reference = s(p.reference, 40) || generateReference();

  const row = {
    reference,
    submitter_user_id: null,
    submitted_via: "public_link",
    sp_name,
    sp_email,
    sp_team: s(p.sp_team, 100),
    handover_date: s(p.handover_date, 40) || null,
    company_name,
    industry: s(p.industry, 200),
    website: s(p.website, 500),
    sow_url: s(p.sow_url, 500),
    strategy_deck_url: s(p.strategy_deck_url, 500),
    keywords_url: s(p.keywords_url, 500),
    geo_audit_url: s(p.geo_audit_url, 500),
    fireflies_url: s(p.fireflies_url, 500),
    docs_notes: s(p.docs_notes, 4000),
    stage: s(p.stage, 100),
    bu: s(p.bu, 100),
    capability: s(p.capability, 100),
    deal_type: s(p.deal_type, 100),
    mrr: n(p.mrr),
    total_amount: n(p.total_amount),
    duration_months: n(p.duration_months),
    start_date: s(p.start_date, 40) || null,
    vsd_suggested: s(p.vsd_suggested, 200),
    deal_notes: s(p.deal_notes, 8000),
    contacts,
    status: "submitted",
  };

  const { error } = await supabase.from("deal_handovers").insert(row as any);
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, reference }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});