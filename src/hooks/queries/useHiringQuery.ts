/**
 * React Query replacement for `useStaffingData().hiringNeeds` + CRUD.
 */
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { useTableSubscription, defaultListPatcher } from "@/lib/realtime";
import { dbToHiring, hiringToDb } from "@/lib/dbMappers";
import type { HiringNeed } from "@/data/staffingData";

async function fetchHiring(): Promise<HiringNeed[]> {
  const { data, error } = await supabase.from("staffing_hiring_needs").select("*");
  if (error) throw error;
  return (data || []).map(dbToHiring);
}

export function useHiringQuery() {
  const key = qk.hiringNeeds();
  const query = useQuery({ queryKey: key, queryFn: fetchHiring });
  const patcher = useMemo(() => defaultListPatcher<HiringNeed>(key), [key]);
  useTableSubscription({ table: "staffing_hiring_needs", patcher });
  return query;
}

export function useHiringMutations() {
  const qc = useQueryClient();
  const key = qk.hiringNeeds();

  const upsertHiring = useMutation({
    mutationFn: async (need: HiringNeed) => {
      const { error } = await supabase
        .from("staffing_hiring_needs")
        .upsert(hiringToDb(need), { onConflict: "id" });
      if (error) throw error;
      return need;
    },
    onSuccess: (need) => {
      qc.setQueryData<HiringNeed[]>(key, (prev) => {
        if (!prev) return [need];
        const i = prev.findIndex((h) => h.id === need.id);
        if (i === -1) return [...prev, need];
        const next = prev.slice();
        next[i] = need;
        return next;
      });
    },
  });

  const deleteHiring = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staffing_hiring_needs").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<HiringNeed[]>(key, (prev) => prev?.filter((h) => h.id !== id));
    },
  });

  return { upsertHiring, deleteHiring };
}