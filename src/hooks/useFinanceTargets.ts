import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth } from "date-fns";
import { METRICS, type Metric } from "@/lib/csvTargets";

export interface VsdTargetRecord {
  id: string;
  month: string;
  vsd: string;
  contraction_target: number; contraction_actual: number;
  delivery_target: number; delivery_actual: number;
  invoicing_target: number; invoicing_actual: number;
  receivables_target: number; receivables_actual: number;
}
export interface DealTargetRecord {
  id: string;
  month: string;
  deal_id: string;
  contraction_target: number; contraction_actual: number;
  delivery_target: number; delivery_actual: number;
  invoicing_target: number; invoicing_actual: number;
  receivables_target: number; receivables_actual: number;
}

export interface MetricTotals {
  target: number;
  actual: number;
}
export type Totals = Record<Metric, MetricTotals>;

export function emptyTotals(): Totals {
  return METRICS.reduce((acc, m) => { acc[m] = { target: 0, actual: 0 }; return acc; }, {} as Totals);
}

export function rollup<T extends Record<string, any>>(rows: T[]): Totals {
  const t = emptyTotals();
  for (const r of rows) {
    for (const m of METRICS) {
      t[m].target += Number(r[`${m}_target`]) || 0;
      t[m].actual += Number(r[`${m}_actual`]) || 0;
    }
  }
  return t;
}

export function monthIso(monthYYYYMM: string): string {
  return format(startOfMonth(new Date(`${monthYYYYMM}-01T00:00:00`)), "yyyy-MM-dd");
}

export function useVsdTargets(monthYYYYMM: string) {
  const [rows, setRows] = useState<VsdTargetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const iso = monthIso(monthYYYYMM);
    const { data } = await supabase
      .from("vsd_financial_targets")
      .select("*")
      .eq("month", iso)
      .order("vsd");
    setRows((data as VsdTargetRecord[]) || []);
    setLoading(false);
  }, [monthYYYYMM]);

  useEffect(() => { load(); }, [load]);

  return { rows, loading, totals: rollup(rows), reload: load };
}

export function useDealTargets(monthYYYYMM: string) {
  const [rows, setRows] = useState<DealTargetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const iso = monthIso(monthYYYYMM);
    const { data } = await supabase
      .from("deal_financial_targets")
      .select("*")
      .eq("month", iso)
      .order("deal_id");
    setRows((data as DealTargetRecord[]) || []);
    setLoading(false);
  }, [monthYYYYMM]);

  useEffect(() => { load(); }, [load]);

  return { rows, loading, totals: rollup(rows), reload: load };
}