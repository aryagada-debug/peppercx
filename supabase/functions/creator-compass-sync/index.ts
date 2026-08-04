import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TARGET_URL = Deno.env.get("CREATOR_COMPASS_SUPABASE_URL") ?? "";
const TARGET_KEY = Deno.env.get("CREATOR_COMPASS_SERVICE_KEY") ?? "";

// Table/column mapping on the Creator Compass side. Overridable via secrets so
// the mapping can be corrected without a code change.
const DEAL_TABLE = Deno.env.get("CREATOR_COMPASS_DEAL_TABLE") ?? "deals";
const ASSIGNMENT_TABLE = Deno.env.get("CREATOR_COMPASS_ASSIGNMENT_TABLE") ?? "staffing_assignments";
const DEAL_KEY = Deno.env.get("CREATOR_COMPASS_DEAL_KEY") ?? "external_id";
const ASSIGNMENT_KEY = Deno.env.get("CREATOR_COMPASS_ASSIGNMENT_KEY") ?? "external_id";

const BATCH = 100;

type OutboxRow = {
  id: string;
  entity: "deal" | "assignment";
  entity_id: string;
  op: "insert" | "update" | "delete";
  payload: Record<string, unknown>;
  attempts: number;
};

const src = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function targetClient() {
  if (!TARGET_URL || !TARGET_KEY) {
    throw new Error(
      "Creator Compass credentials missing. Set CREATOR_COMPASS_SUPABASE_URL and CREATOR_COMPASS_SERVICE_KEY.",
    );
  }
  return createClient(TARGET_URL, TARGET_KEY, { auth: { persistSession: false } });
}

function mapDeal(p: Record<string, any>) {
  return {
    [DEAL_KEY]: p.id,
    account: p.account ?? "",
    deal_name: p.deal_name ?? "",
    deal_type: p.deal_type ?? "",
    deal_status: p.deal_status ?? "",
    business_unit: p.business_unit ?? "",
    capability_line: p.capability_line ?? "",
    pod: p.pod ?? "",
    geo: p.geo ?? "",
    vsd: p.vsd ?? "",
    principal_bopm: p.principal_bopm ?? "",
    senior_bopm: p.senior_bopm ?? "",
    bopm: p.bopm ?? "",
    mrr: p.mrr ?? null,
    duration: p.duration ?? null,
    total_deal_value: p.total_deal_value ?? null,
    currency: p.input_currency ?? "INR",
    start_date: p.start_date ?? null,
    end_date: p.end_date ?? null,
  };
}

function mapAssignment(p: Record<string, any>) {
  return {
    [ASSIGNMENT_KEY]: p.id,
    deal_external_id: p.deal_id,
    person_external_id: p.person_id,
    person_name: p.person_name ?? "",
    person_email: p.person_email ?? "",
    role_key: p.role_key ?? "",
    allocation_pct: p.allocation_pct ?? 0,
    start_date: p.start_date ?? null,
    end_date: p.end_date ?? null,
  };
}

async function deliver(row: OutboxRow) {
  const t = targetClient();
  const isDeal = row.entity === "deal";
  const table = isDeal ? DEAL_TABLE : ASSIGNMENT_TABLE;
  const keyCol = isDeal ? DEAL_KEY : ASSIGNMENT_KEY;

  if (row.op === "delete") {
    const { error } = await t.from(table).delete().eq(keyCol, row.entity_id);
    if (error) throw new Error(`${table} delete failed: ${error.message}`);
    return;
  }

  const body = isDeal ? mapDeal(row.payload) : mapAssignment(row.payload);
  const { error } = await t.from(table).upsert(body, { onConflict: keyCol });
  if (error) throw new Error(`${table} upsert failed: ${error.message}`);
}

async function processQueue(limit = BATCH) {
  const { data, error } = await src
    .from("sync_outbox")
    .select("id, entity, entity_id, op, payload, attempts")
    .in("status", ["pending", "failed"])
    .lt("attempts", 8)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`outbox read failed: ${error.message}`);

  const rows = (data ?? []) as OutboxRow[];
  let ok = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await deliver(row);
      await src
        .from("sync_outbox")
        .update({ status: "done", processed_at: new Date().toISOString(), last_error: null, attempts: row.attempts + 1 })
        .eq("id", row.id);
      ok++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[creator-compass-sync] ${row.entity}:${row.entity_id} -> ${msg}`);
      await src
        .from("sync_outbox")
        .update({ status: "failed", attempts: row.attempts + 1, last_error: msg.slice(0, 2000) })
        .eq("id", row.id);
      failed++;
    }
  }
  return { claimed: rows.length, ok, failed };
}

async function backfill() {
  // Re-enqueue every deal and every assignment so both apps start aligned.
  const { error: e1 } = await src.rpc("enqueue_full_sync_backfill");
  if (e1) throw new Error(`backfill failed: ${e1.message}`);
  return await processQueue(1000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let mode = "process";
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.mode === "backfill") mode = "backfill";
      if (body?.mode === "retry") mode = "retry";
    }

    if (mode === "retry") {
      await src.from("sync_outbox").update({ status: "pending", attempts: 0 }).eq("status", "failed");
    }

    const result = mode === "backfill" ? await backfill() : await processQueue();

    return new Response(JSON.stringify({ ok: true, mode, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[creator-compass-sync] fatal:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
