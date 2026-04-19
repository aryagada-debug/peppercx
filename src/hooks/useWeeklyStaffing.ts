import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WeeklyAllocation {
  id: string;
  deal_id: string;
  person_id: string;
  week_start: string; // YYYY-MM-DD (Monday)
  allocation_pct: number;
  actual_hours: number;
}

/** Get Monday of the week containing the given date (UTC). */
export function getMonday(d: Date): Date {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1 - day);
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
}

export function fmtISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Generate N weeks from a starting Monday (inclusive). */
export function generateWeeks(startMonday: Date, count: number): string[] {
  const weeks: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(startMonday);
    d.setUTCDate(d.getUTCDate() + i * 7);
    weeks.push(fmtISODate(d));
  }
  return weeks;
}

export function useWeeklyStaffing(dealId: string | undefined) {
  const [rows, setRows] = useState<WeeklyAllocation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    if (!dealId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("staffing_weekly_allocations")
      .select("*")
      .eq("deal_id", dealId);
    if (!error && data) setRows(data as WeeklyAllocation[]);
    setLoading(false);
  }, [dealId]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const upsertCell = useCallback(async (
    person_id: string,
    week_start: string,
    patch: Partial<Pick<WeeklyAllocation, "allocation_pct" | "actual_hours">>
  ) => {
    if (!dealId) return;
    const existing = rows.find(r => r.person_id === person_id && r.week_start === week_start);
    if (existing) {
      const { error } = await supabase
        .from("staffing_weekly_allocations")
        .update(patch)
        .eq("id", existing.id);
      if (!error) {
        setRows(prev => prev.map(r => r.id === existing.id ? { ...r, ...patch } : r));
      }
    } else {
      const insertRow = {
        deal_id: dealId,
        person_id,
        week_start,
        allocation_pct: patch.allocation_pct ?? 0,
        actual_hours: patch.actual_hours ?? 0,
      };
      const { data, error } = await supabase
        .from("staffing_weekly_allocations")
        .insert(insertRow)
        .select()
        .single();
      if (!error && data) {
        setRows(prev => [...prev, data as WeeklyAllocation]);
      }
    }
  }, [dealId, rows]);

  const removePerson = useCallback(async (person_id: string) => {
    if (!dealId) return;
    await supabase
      .from("staffing_weekly_allocations")
      .delete()
      .eq("deal_id", dealId)
      .eq("person_id", person_id);
    setRows(prev => prev.filter(r => r.person_id !== person_id));
  }, [dealId]);

  const getCell = useCallback((person_id: string, week_start: string): WeeklyAllocation | undefined => {
    return rows.find(r => r.person_id === person_id && r.week_start === week_start);
  }, [rows]);

  return { rows, loading, upsertCell, removePerson, getCell, refresh: fetchRows };
}
