import { supabase } from "@/integrations/supabase/client";

const STALE_DAYS = 30;

export type StaleRgyMap = Map<string, { lastUpdate: Date | null; isStale: boolean; daysSince: number | null }>;

/**
 * Returns a per-deal map describing the last RGY update timestamp + whether
 * it is older than 30 days. A deal with no RGY entry at all is considered stale.
 */
export async function loadStaleRgy(dealIds?: string[]): Promise<StaleRgyMap> {
  let query = supabase
    .from("deal_rgy_weekly")
    .select("deal_id, created_at, week_start")
    .order("created_at", { ascending: false });
  if (dealIds && dealIds.length > 0) {
    query = query.in("deal_id", dealIds);
  }
  const { data, error } = await query;
  if (error) {
    console.warn("[staleRgy] failed to load deal_rgy_weekly", error);
    return new Map();
  }
  const latest = new Map<string, Date>();
  for (const row of data || []) {
    if (!row.deal_id) continue;
    if (latest.has(row.deal_id)) continue; // already most-recent due to order
    const ts = row.created_at ? new Date(row.created_at) : (row.week_start ? new Date(row.week_start) : null);
    if (ts) latest.set(row.deal_id, ts);
  }

  const now = Date.now();
  const out: StaleRgyMap = new Map();
  const ids = dealIds && dealIds.length > 0 ? dealIds : Array.from(latest.keys());
  for (const id of ids) {
    const last = latest.get(id) || null;
    const daysSince = last ? Math.floor((now - last.getTime()) / 86_400_000) : null;
    out.set(id, {
      lastUpdate: last,
      daysSince,
      isStale: daysSince === null || daysSince > STALE_DAYS,
    });
  }
  return out;
}

export function isStale(daysSince: number | null): boolean {
  return daysSince === null || daysSince > STALE_DAYS;
}

export const STALE_RGY_DAYS = STALE_DAYS;