import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const DEFAULT_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQvdTYtkeRTrJ0oc1mzsChsI7PocauAP6VGjBxfLDkxW4aoA1Rb8X-JNCLAiu51h1Je3PuGGxVjXlpH/pub?gid=1189053191&single=true&output=csv";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ---------- CSV parser (RFC 4180-ish, handles quoted fields, commas, newlines) ----------
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

// ---------- helpers ----------
function toNum(s: string | undefined): number | null {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t || t === "-" || t === "—") return null;
  const cleaned = t.replace(/[,₹$\s]/g, "").replace(/[()]/g, (m) => m === "(" ? "-" : "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

// Parse "Apr-2024" or "Apr-24" → "YYYY-MM-01"
function parseMonthHeader(h: string): string | null {
  const m = h.trim().match(/^([A-Za-z]{3,4})[-\s]?(\d{2}|\d{4})$/);
  if (!m) return null;
  const mon = MONTHS[m[1].toLowerCase()];
  if (mon == null) return null;
  let y = parseInt(m[2], 10);
  if (m[2].length === 2) y = 2000 + y;
  return `${y}-${String(mon + 1).padStart(2, "0")}-01`;
}

// Parse DD/MM/YYYY → YYYY-MM-DD (returns null on failure)
function parseDDMMYYYY(s: string): string | null {
  const t = (s || "").trim();
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  return `${m[3]}-${mm}-${dd}`;
}

function colIdx(letter: string): number {
  let n = 0;
  for (const c of letter) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

// ---------- main sync ----------
async function runSync(triggeredBy: string) {
  const supa = createClient(SUPABASE_URL, SERVICE_KEY);
  const csvUrl = Deno.env.get("DEAL_MASTER_CSV_URL") || DEFAULT_CSV_URL;

  const { data: runRow, error: runErr } = await supa
    .from("sync_runs")
    .insert({ source: "deal_master_csv", status: "running", triggered_by: triggeredBy })
    .select()
    .single();
  if (runErr) throw runErr;
  const runId = runRow.id;

  const errors: any[] = [];
  let dealsUpserted = 0;
  let financialsUpserted = 0;
  let clientsCreated = 0;
  let rowsSkipped = 0;

  try {
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error(`CSV fetch failed ${res.status}`);
    const text = await res.text();
    const rows = parseCSV(text);

    if (rows.length < 8) throw new Error("CSV too short");
    const header = rows[6]; // row 7 (1-indexed)
    const dataRows = rows.slice(7);

    // Build month-column groups from real headers
    const ranges = {
      invoiced:    { start: colIdx("DI"), end: colIdx("ET") },
      received:    { start: colIdx("FA"), end: colIdx("GL") },
      contracted:  { start: colIdx("HS"), end: colIdx("IQ") },
      consumption: { start: colIdx("JA"), end: colIdx("KL") },
    };

    function monthCols(start: number, end: number): Array<{ idx: number; month: string }> {
      const out: Array<{ idx: number; month: string }> = [];
      for (let i = start; i <= end; i++) {
        const m = parseMonthHeader(header[i] || "");
        if (m) out.push({ idx: i, month: m });
      }
      return out;
    }
    const invCols = monthCols(ranges.invoiced.start, ranges.invoiced.end);
    const recCols = monthCols(ranges.received.start, ranges.received.end);
    const conCols = monthCols(ranges.contracted.start, ranges.contracted.end);
    const delCols = monthCols(ranges.consumption.start, ranges.consumption.end);

    // Preload existing clients by pc_code
    const { data: existingClients } = await supa.from("clients").select("id, pc_code, name");
    const clientByPc = new Map<string, { id: string; name: string }>();
    for (const c of existingClients || []) {
      if (c.pc_code) clientByPc.set(String(c.pc_code).trim(), { id: c.id, name: c.name });
    }

    const { data: deletedDeals } = await supa
      .from("trash_items")
      .select("entity_id")
      .eq("entity_type", "staffing_deal")
      .is("restored_at", null);
    const deletedDealIds = new Set((deletedDeals || []).map((d: any) => String(d.entity_id)));

    // Collect new clients to insert in bulk, deals to upsert in bulk
    const newClientsByPc = new Map<string, string>(); // pc -> name
    const dealsToUpsert: any[] = [];
    const finMap = new Map<string, any>();

    for (const row of dataRows) {
      try {
        const pc = (row[colIdx("B")] || "").trim();
        const dealId = (row[colIdx("C")] || "").trim();
        if (!dealId || !/^\d+$/.test(dealId)) { rowsSkipped++; continue; }

        const clientName = (row[colIdx("D")] || "").trim();
        if (pc && !clientByPc.has(pc) && !newClientsByPc.has(pc)) {
          newClientsByPc.set(pc, clientName || pc);
        }
        const id = `${pc}_${dealId}`;
        if (deletedDealIds.has(id)) { rowsSkipped++; continue; }
        const dealPayload: any = {
          id,
          pc_code: pc,
          deal_id: dealId,
          deal_name: (row[colIdx("E")] || "").trim(),
          account: clientName,
          sales_leader: (row[colIdx("G")] || "").trim(),
          sales_rep: (row[colIdx("H")] || "").trim(),
          vsd: (row[colIdx("I")] || "").trim(),
          principal_bopm: (row[colIdx("J")] || "").trim(),
          senior_bopm: (row[colIdx("K")] || "").trim(),
          bopm: (row[colIdx("L")] || "").trim(),
          geo: (row[colIdx("N")] || "").trim(),
          revenue_type: (row[colIdx("O")] || "").trim(),
        };
        const sd = parseDDMMYYYY(row[colIdx("F")] || "");
        if (sd) dealPayload.start_date = sd;
        const mrr = toNum(row[colIdx("P")]); if (mrr != null) dealPayload.mrr = mrr;
        const dur = (row[colIdx("Q")] || "").trim(); if (dur) dealPayload.duration = dur;
        const rdv = toNum(row[colIdx("R")]); if (rdv != null) dealPayload.retainer_deal_value = rdv;
        const nrdv = toNum(row[colIdx("S")]); if (nrdv != null) dealPayload.non_retainer_deal_value = nrdv;
        const tdv = toNum(row[colIdx("T")]); if (tdv != null) dealPayload.total_deal_value = tdv;
        const ndv = toNum(row[colIdx("X")]); if (ndv != null) dealPayload.net_deal_value = ndv;
        dealsToUpsert.push(dealPayload);

        // Financials — only non-empty cells
        function addFin(month: string, field: string, val: number) {
          const key = `${id}__${month}`;
          if (!finMap.has(key)) finMap.set(key, { deal_id: id, month });
          finMap.get(key)[field] = val;
        }
        for (const { idx, month } of invCols) {
          const v = toNum(row[idx]); if (v != null) addFin(month, "invoiced", v);
        }
        for (const { idx, month } of recCols) {
          const v = toNum(row[idx]); if (v != null) addFin(month, "received", v);
        }
        for (const { idx, month } of conCols) {
          const v = toNum(row[idx]); if (v != null) addFin(month, "contracted", v);
        }
        for (const { idx, month } of delCols) {
          const v = toNum(row[idx]); if (v != null) addFin(month, "consumption", v);
        }
      } catch (rowErr: any) {
        errors.push({ row: row.slice(0, 5), error: String(rowErr?.message || rowErr) });
        if (errors.length > 50) errors.length = 50;
      }
    }

    // Bulk-insert new clients
    if (newClientsByPc.size) {
      const inserts = Array.from(newClientsByPc.entries()).map(([pc, name]) => ({ pc_code: pc, name }));
      const { data: created, error: cErr } = await supa.from("clients").insert(inserts).select("id, pc_code, name");
      if (cErr) errors.push({ stage: "client_insert", error: String(cErr.message) });
      else {
        for (const c of created || []) clientByPc.set(c.pc_code, { id: c.id, name: c.name });
        clientsCreated = (created || []).length;
      }
    }

    // Resolve client_id on deals + batch-upsert
    for (const d of dealsToUpsert) {
      const c = clientByPc.get(d.pc_code);
      if (c) d.client_id = c.id;
    }
    const DEAL_BATCH = 200;
    for (let i = 0; i < dealsToUpsert.length; i += DEAL_BATCH) {
      const slice = dealsToUpsert.slice(i, i + DEAL_BATCH);
      const { error: dErr } = await supa.from("staffing_deals").upsert(slice, { onConflict: "id" });
      if (dErr) errors.push({ stage: "deal_upsert", error: String(dErr.message), sample: slice[0]?.id });
      else dealsUpserted += slice.length;
    }

    // Native upsert on (deal_id, month) — requires uq_deal_financials_deal_month unique index.
    const finRows = Array.from(finMap.values());
    for (const f of finRows) {
      if (typeof f.invoiced === "number" && typeof f.received === "number") {
        f.outstanding = f.invoiced - f.received;
      }
      // Required NOT NULL columns — fill missing with 0 so partial upserts don't fail.
      if (typeof f.invoiced !== "number") f.invoiced = 0;
      if (typeof f.received !== "number") f.received = 0;
      if (typeof f.contracted !== "number") f.contracted = 0;
      if (typeof f.consumption !== "number") f.consumption = 0;
      if (typeof f.outstanding !== "number") f.outstanding = 0;
    }
    const BATCH = 1000;
    for (let i = 0; i < finRows.length; i += BATCH) {
      const slice = finRows.slice(i, i + BATCH);
      const { error: fErr } = await supa
        .from("deal_financials")
        .upsert(slice, { onConflict: "deal_id,month", ignoreDuplicates: false });
      if (fErr) errors.push({ stage: "fin_upsert", error: String(fErr.message) });
      else financialsUpserted += slice.length;
    }

    const status = errors.length === 0 ? "success" : "partial";
    await supa.from("sync_runs").update({
      status, finished_at: new Date().toISOString(),
      deals_upserted: dealsUpserted, financials_upserted: financialsUpserted,
      clients_created: clientsCreated, rows_skipped: rowsSkipped,
      error_log: errors,
    }).eq("id", runId);

    return { runId, status, dealsUpserted, financialsUpserted, clientsCreated, rowsSkipped, errorCount: errors.length };
  } catch (e: any) {
    await supa.from("sync_runs").update({
      status: "failed", finished_at: new Date().toISOString(),
      deals_upserted: dealsUpserted, financials_upserted: financialsUpserted,
      clients_created: clientsCreated, rows_skipped: rowsSkipped,
      error_log: [...errors, { fatal: String(e?.message || e) }],
    }).eq("id", runId);
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    let triggeredBy = "manual";
    try {
      const body = await req.json();
      if (body?.triggered_by) triggeredBy = String(body.triggered_by);
    } catch { /* no body */ }
    const result = await runSync(triggeredBy);
    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("sheets-sync-deals failed", e);
    return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});