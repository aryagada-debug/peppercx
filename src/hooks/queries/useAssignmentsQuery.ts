/**
 * React Query replacement for `useStaffingData().assignments` + CRUD.
 */
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { useTableSubscription, defaultListPatcher } from "@/lib/realtime";
import {
  dbToAssignment,
  assignmentToDb,
  STAFFING_ASSIGNMENTS_SELECT,
} from "@/lib/dbMappers";
import type { StaffingAssignment } from "@/data/staffingData";
import { softDelete } from "@/lib/trash";

async function fetchAssignments(): Promise<StaffingAssignment[]> {
  const { data, error } = await supabase
    .from("staffing_assignments")
    .select(STAFFING_ASSIGNMENTS_SELECT);
  if (error) throw error;
  return (data || []).map(dbToAssignment);
}

export function useAssignmentsQuery() {
  const key = qk.assignments();
  const query = useQuery({ queryKey: key, queryFn: fetchAssignments });
  const patcher = useMemo(() => defaultListPatcher<StaffingAssignment>(key), [key]);
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