import type { Deal } from "@/data/staffingData";
import { bucketGeo } from "@/contexts/GeoFilterContext";

export interface PortfolioRow {
  key: string;
  label: string;
  deals: number;
  retainerDeals: number;
  nonRetainerDeals: number;
  mrr: number;
  retainerValue: number;
  nonRetainerValue: number;
  totalValue: number;
}

function blankRow(key: string, label: string): PortfolioRow {
  return {
    key,
    label,
    deals: 0,
    retainerDeals: 0,
    nonRetainerDeals: 0,
    mrr: 0,
    retainerValue: 0,
    nonRetainerValue: 0,
    totalValue: 0,
  };
}

export function addDealToRow(row: PortfolioRow, d: Deal) {
  row.deals += 1;
  const r = Number(d.retainerDealValue) || 0;
  const nr = Number(d.nonRetainerDealValue) || 0;
  const total = Number(d.totalDealValue) || r + nr;
  row.mrr += Number(d.mrr) || 0;
  row.retainerValue += r;
  row.nonRetainerValue += nr;
  row.totalValue += total;
  if (d.dealType === "Retainer") row.retainerDeals += 1;
  else if (d.dealType === "Non-Retainer" || d.dealType === "Pilot") row.nonRetainerDeals += 1;
}

export function groupDeals(
  deals: Deal[],
  keyFn: (d: Deal) => string,
  labelFn?: (key: string) => string,
  unassignedLabel: string = "Unassigned",
): PortfolioRow[] {
  const map = new Map<string, PortfolioRow>();
  for (const d of deals) {
    let k = (keyFn(d) || "").trim();
    if (!k) k = "__unassigned__";
    const label = k === "__unassigned__" ? unassignedLabel : (labelFn ? labelFn(k) : k);
    let row = map.get(k);
    if (!row) {
      row = blankRow(k, label);
      map.set(k, row);
    }
    addDealToRow(row, d);
  }
  return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue || b.mrr - a.mrr);
}

export function totalRow(rows: PortfolioRow[], label = "Grand Total"): PortfolioRow {
  const t = blankRow("__total__", label);
  for (const r of rows) {
    t.deals += r.deals;
    t.retainerDeals += r.retainerDeals;
    t.nonRetainerDeals += r.nonRetainerDeals;
    t.mrr += r.mrr;
    t.retainerValue += r.retainerValue;
    t.nonRetainerValue += r.nonRetainerValue;
    t.totalValue += r.totalValue;
  }
  return t;
}

/** Owner used for the BOPM/GAM grouping. Falls back senior → principal → bopm. */
export function bopmOwner(d: Deal): string {
  return (d.seniorBopm || d.principalBopm || d.bopm || "").trim();
}

export function geoOf(d: Deal): "US" | "India" | "Other" {
  return bucketGeo(d.geo);
}

/** MRR tier buckets (in INR). */
export const MRR_BUCKETS: { key: string; label: string; min: number; max: number }[] = [
  { key: "lt5",   label: "< ₹5L",       min: 0,         max: 5_00_000 },
  { key: "5_15",  label: "₹5L – 15L",   min: 5_00_000,  max: 15_00_000 },
  { key: "15_30", label: "₹15L – 30L",  min: 15_00_000, max: 30_00_000 },
  { key: "30_60", label: "₹30L – 60L",  min: 30_00_000, max: 60_00_000 },
  { key: "gt60",  label: "₹60L+",       min: 60_00_000, max: Number.POSITIVE_INFINITY },
];

export function mrrBucketKey(mrr: number): string {
  const n = Number(mrr) || 0;
  for (const b of MRR_BUCKETS) {
    if (n >= b.min && n < b.max) return b.key;
  }
  return MRR_BUCKETS[MRR_BUCKETS.length - 1].key;
}