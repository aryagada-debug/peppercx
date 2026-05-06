import Papa from "papaparse";

export const METRICS = ["contraction", "delivery", "invoicing", "receivables"] as const;
export type Metric = typeof METRICS[number];

export interface VsdTargetRow {
  month: string; // YYYY-MM-DD (month start)
  vsd: string;
  contraction_target: number;
  contraction_actual: number;
  delivery_target: number;
  delivery_actual: number;
  invoicing_target: number;
  invoicing_actual: number;
  receivables_target: number;
  receivables_actual: number;
}

export interface DealTargetRow {
  month: string;
  deal_id: string;
  contraction_target: number;
  contraction_actual: number;
  delivery_target: number;
  delivery_actual: number;
  invoicing_target: number;
  invoicing_actual: number;
  receivables_target: number;
  receivables_actual: number;
}

export interface ParseResult<T> {
  rows: T[];
  errors: { line: number; message: string }[];
}

function normalizeMonth(value: string): string | null {
  const v = (value || "").trim();
  if (!v) return null;
  // Accept YYYY-MM, YYYY-MM-DD, MM/YYYY, etc.
  const ymd = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(v);
  if (ymd) return `${ymd[1]}-${ymd[2]}-01`;
  const mY = /^(\d{1,2})[\/\-](\d{4})$/.exec(v);
  if (mY) return `${mY[2]}-${String(mY[1]).padStart(2, "0")}-01`;
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  }
  return null;
}

function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/[, ₹$]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

const VSD_REQUIRED = [
  "month", "vsd",
  "contraction_target", "contraction_actual",
  "delivery_target", "delivery_actual",
  "invoicing_target", "invoicing_actual",
  "receivables_target", "receivables_actual",
];
const DEAL_REQUIRED = [
  "month", "deal_id",
  "contraction_target", "contraction_actual",
  "delivery_target", "delivery_actual",
  "invoicing_target", "invoicing_actual",
  "receivables_target", "receivables_actual",
];

function parseCsv<T>(text: string, required: string[], buildRow: (r: Record<string, string>, lineNo: number, push: (e: { line: number; message: string }) => void) => T | null): ParseResult<T> {
  const errors: { line: number; message: string }[] = [];
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });
  const headers = parsed.meta.fields || [];
  const missing = required.filter((c) => !headers.includes(c));
  if (missing.length) {
    errors.push({ line: 0, message: `Missing required columns: ${missing.join(", ")}` });
    return { rows: [], errors };
  }
  const rows: T[] = [];
  parsed.data.forEach((raw, idx) => {
    const lineNo = idx + 2;
    const r = buildRow(raw, lineNo, (e) => errors.push(e));
    if (r) rows.push(r);
  });
  return { rows, errors };
}

export function parseVsdCsv(text: string): ParseResult<VsdTargetRow> {
  return parseCsv<VsdTargetRow>(text, VSD_REQUIRED, (raw, lineNo, push) => {
    const month = normalizeMonth(raw.month);
    const vsd = (raw.vsd || "").trim();
    if (!month) { push({ line: lineNo, message: "Invalid month" }); return null; }
    if (!vsd) { push({ line: lineNo, message: "Missing VSD" }); return null; }
    const numCols: (keyof VsdTargetRow)[] = [
      "contraction_target", "contraction_actual",
      "delivery_target", "delivery_actual",
      "invoicing_target", "invoicing_actual",
      "receivables_target", "receivables_actual",
    ];
    const out: any = { month, vsd };
    for (const c of numCols) {
      const n = num(raw[c as string]);
      if (Number.isNaN(n)) { push({ line: lineNo, message: `Invalid number in ${c}` }); return null; }
      out[c] = n;
    }
    return out as VsdTargetRow;
  });
}

export function parseDealCsv(text: string): ParseResult<DealTargetRow> {
  return parseCsv<DealTargetRow>(text, DEAL_REQUIRED, (raw, lineNo, push) => {
    const month = normalizeMonth(raw.month);
    const deal_id = (raw.deal_id || "").trim();
    if (!month) { push({ line: lineNo, message: "Invalid month" }); return null; }
    if (!deal_id) { push({ line: lineNo, message: "Missing deal_id" }); return null; }
    const numCols: (keyof DealTargetRow)[] = [
      "contraction_target", "contraction_actual",
      "delivery_target", "delivery_actual",
      "invoicing_target", "invoicing_actual",
      "receivables_target", "receivables_actual",
    ];
    const out: any = { month, deal_id };
    for (const c of numCols) {
      const n = num(raw[c as string]);
      if (Number.isNaN(n)) { push({ line: lineNo, message: `Invalid number in ${c}` }); return null; }
      out[c] = n;
    }
    return out as DealTargetRow;
  });
}

export function vsdTemplateCsv(): string {
  return Papa.unparse([
    {
      month: "2026-04",
      vsd: "Anirudh",
      contraction_target: 0, contraction_actual: 0,
      delivery_target: 0, delivery_actual: 0,
      invoicing_target: 0, invoicing_actual: 0,
      receivables_target: 0, receivables_actual: 0,
    },
  ]);
}

export function dealTemplateCsv(): string {
  return Papa.unparse([
    {
      month: "2026-04",
      deal_id: "DEAL-123",
      contraction_target: 0, contraction_actual: 0,
      delivery_target: 0, delivery_actual: 0,
      invoicing_target: 0, invoicing_actual: 0,
      receivables_target: 0, receivables_actual: 0,
    },
  ]);
}

// ============================================================
// Wide-format deal template (matches the master Google Sheet)
// ============================================================

export const WIDE_DEAL_HEADERS = (monthLabel: string): string[] => [
  "Sr no.",
  "New Deal ID",
  "Add New Deal ID Here",
  "PC Code",
  "Client Name",
  "Deal Name",
  "VSD",
  "Group BOPM",
  "Senior BOPM",
  "Junior BOPM",
  "MEQS",
  "Manager",
  "Contractual Editors",
  "Customer Status",
  "Deal Status",
  "Service Line - Capability",
  "Deal Tag",
  "Deal Type",
  "Month of Closed Won",
  "Start date",
  "End date",
  "Retainer MRR (if any)",
  "Total Deal Value",
  "Overage Invoicing",
  "Deal Value Loss / Churned",
  "Net Deal Value",
  `Consumption - ${monthLabel} Target`,
  `Consumption - ${monthLabel} Attainment`,
  `Consumption - ${monthLabel} Attainment %`,
  `Delivery - ${monthLabel} Target`,
  `Delivery - ${monthLabel} Attainment`,
  `Delivery - ${monthLabel} Attainment %`,
  `Invoicing - ${monthLabel} Target`,
  `Invoicing - ${monthLabel} Attainment`,
  `Invoicing - ${monthLabel} Attainment %`,
  `Receivable - ${monthLabel} - 26 Target`,
  `Receivable - ${monthLabel} Attainment`,
  `Receivable - ${monthLabel} Attainment %`,
];

export function wideDealTemplateCsv(monthLabel: string): string {
  const headers = WIDE_DEAL_HEADERS(monthLabel);
  const sample: Record<string, string | number> = {};
  headers.forEach((h) => (sample[h] = ""));
  sample["Sr no."] = 1;
  sample["New Deal ID"] = "DEAL-123";
  sample["Client Name"] = "Acme";
  sample["Deal Name"] = "Acme Q2 Retainer";
  sample["VSD"] = "Anirudh";
  sample[`Consumption - ${monthLabel} Target`] = 0;
  sample[`Consumption - ${monthLabel} Attainment`] = 0;
  sample[`Delivery - ${monthLabel} Target`] = 0;
  sample[`Delivery - ${monthLabel} Attainment`] = 0;
  sample[`Invoicing - ${monthLabel} Target`] = 0;
  sample[`Invoicing - ${monthLabel} Attainment`] = 0;
  sample[`Receivable - ${monthLabel} - 26 Target`] = 0;
  sample[`Receivable - ${monthLabel} Attainment`] = 0;
  return Papa.unparse({ fields: headers, data: [headers.map((h) => sample[h] ?? "")] });
}

// Detect whether a CSV uses the wide format
export function looksLikeWideDealCsv(text: string): boolean {
  const firstLine = (text.split(/\r?\n/)[0] || "").toLowerCase();
  return /consumption\s*-\s*.+target/.test(firstLine) || /new deal id/.test(firstLine);
}

function findHeader(headers: string[], pattern: RegExp): string | undefined {
  return headers.find((h) => pattern.test(h));
}

export function parseWideDealCsv(text: string, monthYYYYMM: string): ParseResult<DealTargetRow> {
  const errors: { line: number; message: string }[] = [];
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const headers = parsed.meta.fields || [];
  const month = `${monthYYYYMM}-01`;

  const idCol =
    findHeader(headers, /^new deal id$/i) ||
    findHeader(headers, /^add new deal id here$/i) ||
    findHeader(headers, /^deal[_\s-]?id$/i);
  if (!idCol) {
    errors.push({ line: 0, message: "Missing 'New Deal ID' column" });
    return { rows: [], errors };
  }

  const colMap: Record<string, { target?: string; actual?: string }> = {
    contraction: {
      target: findHeader(headers, /^consumption\s*-\s*.+target\s*$/i),
      actual: findHeader(headers, /^consumption\s*-\s*.+attainment\s*$/i),
    },
    delivery: {
      target: findHeader(headers, /^delivery\s*-\s*.+target\s*$/i),
      actual: findHeader(headers, /^delivery\s*-\s*.+attainment\s*$/i),
    },
    invoicing: {
      target: findHeader(headers, /^invoicing\s*-\s*.+target\s*$/i),
      actual: findHeader(headers, /^invoicing\s*-\s*.+attainment\s*$/i),
    },
    receivables: {
      target: findHeader(headers, /^receivable.*target\s*$/i),
      actual: findHeader(headers, /^receivable.*attainment\s*$/i),
    },
  };

  const missing = Object.entries(colMap)
    .filter(([, v]) => !v.target && !v.actual)
    .map(([k]) => k);
  if (missing.length === 4) {
    errors.push({ line: 0, message: "No metric columns found (Consumption / Delivery / Invoicing / Receivable)" });
    return { rows: [], errors };
  }

  const rows: DealTargetRow[] = [];
  parsed.data.forEach((raw, idx) => {
    const lineNo = idx + 2;
    const deal_id = (raw[idCol] || "").trim();
    if (!deal_id) return; // silently skip metadata-only rows
    const out: any = { month, deal_id };
    let valid = true;
    for (const m of METRICS) {
      const tCol = colMap[m].target;
      const aCol = colMap[m].actual;
      const t = tCol ? num(raw[tCol]) : 0;
      const a = aCol ? num(raw[aCol]) : 0;
      if (Number.isNaN(t) || Number.isNaN(a)) {
        errors.push({ line: lineNo, message: `Invalid number in ${m}` });
        valid = false;
        break;
      }
      out[`${m}_target`] = t;
      out[`${m}_actual`] = a;
    }
    if (valid) rows.push(out as DealTargetRow);
  });

  return { rows, errors };
}

export function monthLabelFromYYYYMM(monthYYYYMM: string): string {
  const d = new Date(`${monthYYYYMM}-01T00:00:00`);
  if (isNaN(d.getTime())) return "April";
  return d.toLocaleString("en-US", { month: "long" });
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function attainmentPct(actual: number, target: number): number | null {
  if (!target || target <= 0) return null;
  return (actual / target) * 100;
}

export function attainmentTone(pct: number | null): string {
  if (pct === null) return "text-muted-foreground";
  if (pct >= 95) return "text-positive";
  if (pct >= 80) return "text-warning";
  return "text-destructive";
}

// Format an INR-stored amount in the user's chosen display currency.
// Reads the current currency / FX rate from the global currency store so
// non-React utilities can format consistently with React components.
import { formatMoney } from "./currency";
import { getGlobalCurrency, getGlobalFx } from "@/contexts/CurrencyContext";
export function formatINR(n: number): string {
  return formatMoney(n, getGlobalCurrency(), { compact: true }, getGlobalFx());
}

export const METRIC_LABELS: Record<Metric, string> = {
  contraction: "Contraction",
  delivery: "Delivery",
  invoicing: "Invoicing",
  receivables: "Receivables",
};