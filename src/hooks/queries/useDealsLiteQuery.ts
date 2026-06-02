/**
 * Shared "lite" view of staffing_deals used by access-control + VSD hierarchy.
 * Cached once and reused across hooks to avoid re-scanning the table on
 * every page navigation.
 */
import { useMemo } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { useTableSubscription, invalidatePatcher } from "@/lib/realtime";

export interface DealLiteRow {
  id: string;
  client_id: string | null;
  vsd: string | null;
  principal_bopm: string | null;
  senior_bopm: string | null;
  bopm: string | null;
}

async function fetchDealsLite(): Promise<DealLiteRow[]> {
  const { data, error } = await supabase
    .from("staffing_deals")
    .select("id, client_id, vsd, principal_bopm, senior_bopm, bopm");
  if (error) throw error;
  return (data as DealLiteRow[]) || [];
}

export function ensureDealsLite(qc: QueryClient): Promise<DealLiteRow[]> {
  return qc.fetchQuery({
    queryKey: qk.dealsLite(),
    queryFn: fetchDealsLite,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDealsLiteQuery() {
  const qc = useQueryClient();
  const key = qk.dealsLite();
  const query = useQuery({ queryKey: key, queryFn: fetchDealsLite, staleTime: 5 * 60 * 1000 });
  const inv = useMemo(() => invalidatePatcher(key), [key]);
  useTableSubscription({ table: "staffing_deals", patcher: inv });
  return query;
}
