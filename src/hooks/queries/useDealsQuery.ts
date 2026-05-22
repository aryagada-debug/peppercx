/**
 * React Query replacement for `useStaffingData().deals` + deal CRUD.
 */
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { useTableSubscription, mappedListPatcher } from "@/lib/realtime";
import { dbToDeal, dealToDb, STAFFING_DEALS_SELECT } from "@/lib/dbMappers";
import type { Deal } from "@/data/staffingData";
import { softDelete } from "@/lib/trash";

const PAGE_SIZE = 1000;

async function fetchDeals(): Promise<Deal[]> {
  const out: Deal[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("staffing_deals")
      .select(STAFFING_DEALS_SELECT)
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw error;
    const rows = data || [];
    for (const r of rows) out.push(dbToDeal(r));
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

export function useDealsQuery() {
  const key = qk.deals();
  const query = useQuery({ queryKey: key, queryFn: fetchDeals });
  const patcher = useMemo(
    () => mappedListPatcher<any, Deal>(key, dbToDeal),
    [key],
  );
  useTableSubscription({ table: "staffing_deals", patcher });
  return query;
}

export function useDealMutations() {
  const qc = useQueryClient();
  const key = qk.deals();

  const addDeal = useMutation({
    mutationFn: async (deal: Deal) => {
      const { error } = await supabase.from("staffing_deals").insert(dealToDb(deal));
      if (error) throw error;
      return deal;
    },
    onSuccess: (deal) => {
      qc.setQueryData<Deal[]>(key, (prev) => (prev ? [...prev, deal] : [deal]));
    },
  });

  const updateDeal = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Deal> }) => {
      // Full row upsert — keeps mapping logic in one place.
      const current = qc.getQueryData<Deal[]>(key)?.find((d) => d.id === id);
      if (!current) throw new Error("deal not in cache");
      const next = { ...current, ...updates } as Deal;
      const { error } = await supabase
        .from("staffing_deals")
        .update(dealToDb(next))
        .eq("id", id);
      if (error) throw error;
      return { id, updates };
    },
    onMutate: ({ id, updates }) => {
      const prev = qc.getQueryData<Deal[]>(key);
      qc.setQueryData<Deal[]>(key, (cur) =>
        cur?.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
  });

  const deleteDeal = useMutation({
    mutationFn: async (id: string) => {
      const ok = await softDelete("staffing_deal", id);
      if (!ok) throw new Error("Failed to move deal to trash");
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<Deal[]>(key, (prev) => prev?.filter((d) => d.id !== id));
    },
  });

  return { addDeal, updateDeal, deleteDeal };
}