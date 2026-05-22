/**
 * React Query replacement for `useStaffingData().assignments` + CRUD.
 */
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { useTableSubscription, mappedListPatcher } from "@/lib/realtime";
import {
  dbToAssignment,
  assignmentToDb,
  STAFFING_ASSIGNMENTS_SELECT,
} from "@/lib/dbMappers";
import type { StaffingAssignment } from "@/data/staffingData";
import { softDelete } from "@/lib/trash";

const PAGE_SIZE = 1000;

async function fetchAssignments(): Promise<StaffingAssignment[]> {
  // Page through the full assignments table. Supabase caps any single
  // select at 1000 rows, so without pagination newly-added assignments
  // sitting past the first page silently disappear from the cache.
  const out: StaffingAssignment[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("staffing_assignments")
      .select(STAFFING_ASSIGNMENTS_SELECT)
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw error;
    const rows = data || [];
    for (const r of rows) out.push(dbToAssignment(r));
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

export function useAssignmentsQuery() {
  const key = qk.assignments();
  const query = useQuery({ queryKey: key, queryFn: fetchAssignments });
  const patcher = useMemo(
    () => mappedListPatcher<any, StaffingAssignment>(key, dbToAssignment),
    [key],
  );
  useTableSubscription({ table: "staffing_assignments", patcher });
  return query;
}

export function useAssignmentMutations() {
  const qc = useQueryClient();
  const key = qk.assignments();

  const upsertAssignment = useMutation({
    mutationFn: async (assignment: StaffingAssignment) => {
      const { error } = await supabase
        .from("staffing_assignments")
        .upsert(assignmentToDb(assignment), { onConflict: "id" });
      if (error) throw error;
      return assignment;
    },
    onSuccess: (a) => {
      qc.setQueryData<StaffingAssignment[]>(key, (prev) => {
        if (!prev) return [a];
        const i = prev.findIndex((p) => p.id === a.id);
        if (i === -1) return [...prev, a];
        const next = prev.slice();
        next[i] = a;
        return next;
      });
    },
  });

  const deleteAssignment = useMutation({
    mutationFn: async (id: string) => {
      const ok = await softDelete("staffing_assignment", id);
      if (!ok) throw new Error("Failed to move assignment to trash");
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<StaffingAssignment[]>(key, (prev) =>
        prev?.filter((a) => a.id !== id),
      );
    },
  });

  return { upsertAssignment, deleteAssignment };
}