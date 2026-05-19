/**
 * Thin read-only aggregator that returns the same array surface as the
 * old `useStaffingData()` queries plus a unified `loading` and
 * `refresh`. Pair with `useStaffingMutations()` for writes.
 */
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_DEALS,
  DEFAULT_PEOPLE,
  DEFAULT_ASSIGNMENTS,
  DEFAULT_HIRING_NEEDS,
  DEFAULT_REVENUE_TARGETS,
} from "@/data/staffingData";
import { qk } from "@/lib/queryKeys";
import { usePeopleQuery } from "./usePeopleQuery";
import { useDealsQuery } from "./useDealsQuery";
import { useAssignmentsQuery } from "./useAssignmentsQuery";
import { useHiringQuery } from "./useHiringQuery";
import { useRevTargetsQuery } from "./useRevTargetsQuery";
import { useBWRulesQuery } from "./useBWRulesQuery";

export function useStaffingQueries() {
  const qc = useQueryClient();
  const peopleQ = usePeopleQuery();
  const dealsQ = useDealsQuery();
  const assignmentsQ = useAssignmentsQuery();
  const hiringQ = useHiringQuery();
  const targetsQ = useRevTargetsQuery();
  const rulesQ = useBWRulesQuery();

  const refresh = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: qk.people() }),
      qc.invalidateQueries({ queryKey: qk.deals() }),
      qc.invalidateQueries({ queryKey: qk.assignments() }),
      qc.invalidateQueries({ queryKey: qk.hiringNeeds() }),
      qc.invalidateQueries({ queryKey: qk.revenueTargets() }),
      qc.invalidateQueries({ queryKey: qk.bwRules() }),
    ]);
  }, [qc]);

  return {
    people: peopleQ.data ?? DEFAULT_PEOPLE,
    deals: dealsQ.data ?? DEFAULT_DEALS,
    assignments: assignmentsQ.data ?? DEFAULT_ASSIGNMENTS,
    hiringNeeds: hiringQ.data ?? DEFAULT_HIRING_NEEDS,
    revenueTargets: targetsQ.data ?? DEFAULT_REVENUE_TARGETS,
    bwRules: rulesQ.data ?? [],
    loading:
      peopleQ.isLoading ||
      dealsQ.isLoading ||
      assignmentsQ.isLoading ||
      hiringQ.isLoading ||
      targetsQ.isLoading ||
      rulesQ.isLoading,
    refresh,
  };
}