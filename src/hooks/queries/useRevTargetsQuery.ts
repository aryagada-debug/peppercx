/**
 * React Query replacement for `useStaffingData().revenueTargets` + upsert.
 * Composite PK: (department, designation) — no `id`, so default patcher
 * does not apply. We use invalidate-on-change.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { useTableSubscription, invalidatePatcher } from "@/lib/realtime";
import { dbToRevTarget } from "@/lib/dbMappers";
import type { RevenueCapacityTarget } from "@/data/staffingData";

async function fetchRevTargets(): Promise<RevenueCapacityTarget[]> {
  const { data, error } = await supabase.from("staffing_revenue_targets").select("*");
  if (error) throw error;
  return (data || []).map(dbToRevTarget);
}

export function useRevTargetsQuery() {
  const key = qk.revenueTargets();
  const query = useQuery({ queryKey: key, queryFn: fetchRevTargets });
  useTableSubscription({
    table: "staffing_revenue_targets",
    patcher: invalidatePatcher(key),
  });
  return query;
}

export function useRevTargetMutations() {
  const qc = useQueryClient();
  const key = qk.revenueTargets();

  const upsertTarget = useMutation({
    mutationFn: async (t: RevenueCapacityTarget) => {
      const { error } = await (supabase.from("staffing_revenue_targets") as any).upsert(
        {
          department: t.department,
          designation: t.designation,
          target_deal_value_per_person: t.targetDealValuePerPerson,
        },
        { onConflict: "department,designation" },
      );
      if (error) throw error;
      return t;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });

  return { upsertTarget };
}