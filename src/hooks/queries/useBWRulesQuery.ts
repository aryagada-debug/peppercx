/**
 * React Query replacement for `useStaffingData().bwRules` + CRUD.
 */
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { useTableSubscription, defaultListPatcher } from "@/lib/realtime";
import { dbToBWRule, bwRuleToDb } from "@/lib/dbMappers";
import type { BWRule } from "@/data/staffingData";

async function fetchRules(): Promise<BWRule[]> {
  const { data, error } = await supabase.from("staffing_bw_rules").select("*");
  if (error) throw error;
  return (data || []).map(dbToBWRule);
}

export function useBWRulesQuery() {
  const key = qk.bwRules();
  const query = useQuery({ queryKey: key, queryFn: fetchRules });
  const patcher = useMemo(() => defaultListPatcher<BWRule>(key), [key]);
  useTableSubscription({ table: "staffing_bw_rules", patcher });
  return query;
}

export function useBWRuleMutations() {
  const qc = useQueryClient();
  const key = qk.bwRules();

  const upsertRule = useMutation({
    mutationFn: async (rule: BWRule) => {
      const { error } = await (supabase.from("staffing_bw_rules") as any).upsert(
        bwRuleToDb(rule),
        { onConflict: "id" },
      );
      if (error) throw error;
      return rule;
    },
    onSuccess: (rule) => {
      qc.setQueryData<BWRule[]>(key, (prev) => {
        if (!prev) return [rule];
        const i = prev.findIndex((r) => r.id === rule.id);
        if (i === -1) return [...prev, rule];
        const next = prev.slice();
        next[i] = rule;
        return next;
      });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staffing_bw_rules").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<BWRule[]>(key, (prev) => prev?.filter((r) => r.id !== id));
    },
  });

  return { upsertRule, deleteRule };
}