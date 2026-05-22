/**
 * Mutation orchestration for staffing CRUD. Wraps direct Supabase writes
 * with optimistic React Query cache patches, approval-gating, Slack
 * notifications, and the first-load seed effect. Consumers should pair
 * this with the individual `useXQuery` hooks for reads.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { softDelete } from "@/lib/trash";
import {
  DEFAULT_DEALS,
  DEFAULT_PEOPLE,
  DEFAULT_ASSIGNMENTS,
  DEFAULT_HIRING_NEEDS,
  DEFAULT_REVENUE_TARGETS,
  type Deal,
  type Person,
  type StaffingAssignment,
  type HiringNeed,
  type RevenueCapacityTarget,
  type BWRule,
  uid,
} from "@/data/staffingData";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/components/auth/AuthProvider";
import { submitApprovalRequest } from "@/lib/approvals";
import { qk } from "@/lib/queryKeys";
import { toast } from "sonner";
import {
  personToDb,
  dealToDb,
  assignmentToDb,
  hiringToDb,
} from "@/lib/dbMappers";

async function batchUpsert<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  batchSize = 500,
) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await (supabase.from(table as any) as any).upsert(batch, {
      onConflict: "id",
    });
    if (error) console.error(`Seed error ${table} batch ${i}:`, error);
  }
}

/**
 * One-shot seeder. Mount once at the top of the app (or skip — Phase 1
 * runs this from <StaffingDataProvider> historically). Safe no-op when
 * staffing_people already has rows.
 */
export function useStaffingSeeder() {
  const qc = useQueryClient();
  const { session, loading: authLoading } = useAuth();
  const isAuthenticated = !authLoading && !!session;
  const seedingRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || seedingRef.current) return;
    seedingRef.current = true;
    (async () => {
      const { count } = await supabase
        .from("staffing_people")
        .select("id", { count: "exact", head: true });
      if ((count ?? 0) > 0) return;
      await batchUpsert("staffing_people", DEFAULT_PEOPLE.map(personToDb));
      await batchUpsert("staffing_deals", DEFAULT_DEALS.map(dealToDb));
      const validPersonIds = new Set(DEFAULT_PEOPLE.map((p) => p.id));
      const validDealIds = new Set(DEFAULT_DEALS.map((d) => d.id));
      const validAssignments = DEFAULT_ASSIGNMENTS.filter(
        (a) => validPersonIds.has(a.personId) && validDealIds.has(a.dealId),
      );
      await batchUpsert("staffing_assignments", validAssignments.map(assignmentToDb));
      await batchUpsert("staffing_hiring_needs", DEFAULT_HIRING_NEEDS.map(hiringToDb));
      for (const rt of DEFAULT_REVENUE_TARGETS) {
        await (supabase.from("staffing_revenue_targets") as any).upsert(
          {
            department: rt.department,
            designation: rt.designation,
            target_deal_value_per_person: rt.targetDealValuePerPerson,
          },
          { onConflict: "department,designation" },
        );
      }
      qc.invalidateQueries({ queryKey: qk.people() });
      qc.invalidateQueries({ queryKey: qk.deals() });
      qc.invalidateQueries({ queryKey: qk.assignments() });
      qc.invalidateQueries({ queryKey: qk.hiringNeeds() });
      qc.invalidateQueries({ queryKey: qk.revenueTargets() });
    })();
  }, [isAuthenticated, qc]);
}

export function useStaffingMutations() {
  const qc = useQueryClient();
  const { canEditAll } = useUserRole();

  const patch = useMemo(
    () => ({
      people: (u: (prev: Person[]) => Person[]) =>
        qc.setQueryData<Person[]>(qk.people(), (p) => u(p || [])),
      deals: (u: (prev: Deal[]) => Deal[]) =>
        qc.setQueryData<Deal[]>(qk.deals(), (p) => u(p || [])),
      assignments: (u: (prev: StaffingAssignment[]) => StaffingAssignment[]) =>
        qc.setQueryData<StaffingAssignment[]>(qk.assignments(), (p) => u(p || [])),
      hiring: (next: HiringNeed[]) =>
        qc.setQueryData<HiringNeed[]>(qk.hiringNeeds(), next),
      targets: (next: RevenueCapacityTarget[]) =>
        qc.setQueryData<RevenueCapacityTarget[]>(qk.revenueTargets(), next),
      rules: (u: (prev: BWRule[]) => BWRule[]) =>
        qc.setQueryData<BWRule[]>(qk.bwRules(), (p) => u(p || [])),
    }),
    [qc],
  );

  const getAssignments = useCallback(
    () => qc.getQueryData<StaffingAssignment[]>(qk.assignments()) || [],
    [qc],
  );

  // ── People ──
  const addPerson = useCallback(
    async (person: Person) => {
      patch.people((prev) => [...prev, person]);
      await supabase.from("staffing_people").insert(personToDb(person));
      const email = (person.email || "").trim();
      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        try {
          const { data, error } = await supabase.functions.invoke("admin-user-mgmt", {
            body: { action: "provision_person", person_id: person.id, email, name: person.name },
          });
          if (error || (data as any)?.error) {
            console.warn("[provision_person]", error || (data as any)?.error);
          }
        } catch (e) {
          console.warn("[provision_person] failed", e);
        }
      }
    },
    [patch],
  );

  const updatePerson = useCallback(
    async (personId: string, updates: Partial<Person>) => {
      patch.people((prev) => prev.map((p) => (p.id === personId ? { ...p, ...updates } : p)));
      const dbUpdates: TablesUpdate<"staffing_people"> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.roleCategory !== undefined) dbUpdates.role_category = updates.roleCategory;
      if (updates.roleTitle !== undefined) dbUpdates.role_title = updates.roleTitle;
      if (updates.pod !== undefined) dbUpdates.pod = updates.pod;
      if (updates.region !== undefined) dbUpdates.region = updates.region;
      if (updates.leaving !== undefined) dbUpdates.leaving = updates.leaving;
      if (updates.tbh !== undefined) dbUpdates.tbh = updates.tbh;
      if (updates.department !== undefined) dbUpdates.department = updates.department;
      if (updates.designation !== undefined) dbUpdates.designation = updates.designation;
      if (updates.reportingManager !== undefined) dbUpdates.reporting_manager = updates.reportingManager;
      if (updates.band !== undefined) dbUpdates.band = updates.band;
      if (updates.hourlyRate !== undefined) dbUpdates.hourly_rate = updates.hourlyRate;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.slackUserId !== undefined) dbUpdates.slack_user_id = updates.slackUserId;
      if (updates.subTeam !== undefined) dbUpdates.sub_team = updates.subTeam;
      await supabase.from("staffing_people").update(dbUpdates).eq("id", personId);
    },
    [patch],
  );

  const deletePerson = useCallback(
    async (personId: string) => {
      patch.people((prev) => prev.filter((p) => p.id !== personId));
      patch.assignments((prev) => prev.filter((a) => a.personId !== personId));
      await supabase.from("staffing_people").delete().eq("id", personId);
    },
    [patch],
  );

  const bulkUpdatePeople = useCallback(
    async (personIds: string[], field: keyof Person, value: string) => {
      patch.people((prev) =>
        prev.map((p) => (personIds.includes(p.id) ? { ...p, [field]: value } : p)),
      );
      const dbField =
        field === "roleCategory"
          ? "role_category"
          : field === "roleTitle"
            ? "role_title"
            : field === "reportingManager"
              ? "reporting_manager"
              : field;
      const updateObj: TablesUpdate<"staffing_people"> = { [dbField]: value } as any;
      await supabase.from("staffing_people").update(updateObj).in("id", personIds);
    },
    [patch],
  );

  // ── Assignments ──
  const notifyStaffing = useCallback(
    (personId: string, dealId: string, roleKey: string, allocationPct: number) => {
      if (!personId || !dealId) return;
      void supabase.functions
        .invoke("notify-assignment", {
          body: { kind: "staffing", personId, dealId, roleKey, allocationPct },
        })
        .catch((err) => console.warn("[notify-assignment] staffing failed", err));
    },
    [],
  );

  const addAssignment = useCallback(
    async (assignment: StaffingAssignment) => {
      if (!canEditAll) {
        await submitApprovalRequest({
          type: "staffing.add",
          dealId: assignment.dealId,
          targetKind: "staffing_assignment",
          targetId: assignment.id,
          payload: assignment,
        });
        return;
      }
      // Idempotent add: if the same (deal, role, person) is already
      // staffed, merge the new allocation/dates onto the existing row
      // instead of inserting a duplicate. This makes repeated quick-add
      // clicks safe and prevents stale rows piling up in the cache.
      const existing = getAssignments().find(
        (a) =>
          a.dealId === assignment.dealId &&
          a.roleKey === assignment.roleKey &&
          a.personId === assignment.personId,
      );
      if (existing) {
        const merged: StaffingAssignment = {
          ...existing,
          allocationPct: assignment.allocationPct,
          startDate: assignment.startDate ?? existing.startDate,
          endDate: assignment.endDate ?? existing.endDate,
        };
        patch.assignments((prev) => prev.map((a) => (a.id === existing.id ? merged : a)));
        const upd: TablesUpdate<"staffing_assignments"> = {
          allocation_pct: merged.allocationPct,
          start_date: merged.startDate || null,
          end_date: merged.endDate || null,
        };
        const { error } = await supabase
          .from("staffing_assignments")
          .update(upd)
          .eq("id", existing.id);
        if (error) {
          console.error("[addAssignment] merge update failed", error);
          patch.assignments((prev) => prev.map((a) => (a.id === existing.id ? existing : a)));
          toast.error("Couldn't update staffing — please retry");
          return;
        }
        void qc.refetchQueries({ queryKey: qk.assignments(), type: "active" });
        void qc.refetchQueries({ queryKey: qk.deals(), type: "active" });
        void qc.invalidateQueries({ queryKey: ["deal-access"] });
        notifyStaffing(merged.personId, merged.dealId, merged.roleKey, merged.allocationPct);
        return;
      }
      patch.assignments((prev) => [...prev, assignment]);
      const { error } = await supabase
        .from("staffing_assignments")
        .insert(assignmentToDb(assignment));
      if (error) {
        console.error("[addAssignment] insert failed", error);
        patch.assignments((prev) => prev.filter((a) => a.id !== assignment.id));
        toast.error("Couldn't add staffing — please retry");
        return;
      }
      // Refresh assignments + deals so DB-side BOPM/VSD recompute triggers
      // surface in the table without a manual page reload. Use refetch
      // (not invalidate) so the cache is overwritten with mapped data
      // immediately — invalidate-only can leave stale renders in flight.
      void qc.refetchQueries({ queryKey: qk.assignments(), type: "active" });
      void qc.refetchQueries({ queryKey: qk.deals(), type: "active" });
      void qc.invalidateQueries({ queryKey: ["deal-access"] });
      notifyStaffing(assignment.personId, assignment.dealId, assignment.roleKey, assignment.allocationPct);
    },
    [notifyStaffing, canEditAll, patch, qc, getAssignments],
  );

  const updateAssignment = useCallback(
    async (id: string, updates: Partial<StaffingAssignment>) => {
      if (!canEditAll) {
        const current = getAssignments().find((a) => a.id === id);
        await submitApprovalRequest({
          type: "staffing.update",
          dealId: current?.dealId,
          targetKind: "staffing_assignment",
          targetId: id,
          previous: current || {},
          payload: { id, ...updates },
        });
        return;
      }
      const prevSnapshot = getAssignments().find((a) => a.id === id);
      let next: StaffingAssignment | undefined;
      patch.assignments((prev) =>
        prev.map((a) => {
          if (a.id !== id) return a;
          next = { ...a, ...updates };
          return next;
        }),
      );
      const dbUpdates: TablesUpdate<"staffing_assignments"> = {};
      if (updates.personId !== undefined) dbUpdates.person_id = updates.personId;
      if (updates.allocationPct !== undefined) dbUpdates.allocation_pct = updates.allocationPct;
      if (updates.roleKey !== undefined) dbUpdates.role_key = updates.roleKey;
      if (updates.dealId !== undefined) dbUpdates.deal_id = updates.dealId;
      if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate || null;
      if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate || null;
      const { error } = await supabase.from("staffing_assignments").update(dbUpdates).eq("id", id);
      if (error) {
        console.error("[updateAssignment] failed", error);
        if (prevSnapshot) {
          patch.assignments((prev) => prev.map((a) => (a.id === id ? prevSnapshot : a)));
        }
        toast.error("Couldn't update staffing — please retry");
        return;
      }
      qc.invalidateQueries({ queryKey: qk.assignments() });
      qc.invalidateQueries({ queryKey: qk.deals() });
      if (next && updates.personId) {
        notifyStaffing(next.personId, next.dealId, next.roleKey, next.allocationPct);
      }
    },
    [notifyStaffing, canEditAll, getAssignments, patch, qc],
  );

  const deleteAssignment = useCallback(
    async (id: string) => {
      if (!canEditAll) {
        const current = getAssignments().find((a) => a.id === id);
        await submitApprovalRequest({
          type: "staffing.remove",
          dealId: current?.dealId,
          targetKind: "staffing_assignment",
          targetId: id,
          previous: current || {},
          payload: { id },
        });
        return;
      }
      const prevSnapshot = getAssignments().find((a) => a.id === id);
      patch.assignments((prev) => prev.filter((a) => a.id !== id));
      try {
        await softDelete("staffing_assignment", id);
        qc.invalidateQueries({ queryKey: qk.assignments() });
        qc.invalidateQueries({ queryKey: qk.deals() });
      } catch (err) {
        console.error("[deleteAssignment] failed", err);
        if (prevSnapshot) {
          patch.assignments((prev) => [...prev, prevSnapshot]);
        }
        toast.error("Couldn't remove staffing — please retry");
      }
    },
    [canEditAll, getAssignments, patch, qc],
  );

  const upsertAssignmentByRole = useCallback(
    async (
      dealId: string,
      roleKey: string,
      personId: string,
      allocationPct: number,
      extras?: { startDate?: string; endDate?: string },
    ) => {
      const assignments = getAssignments();
      const existing = assignments.find((a) => a.dealId === dealId && a.roleKey === roleKey);
      if (!canEditAll) {
        if (!personId) {
          if (existing) {
            await submitApprovalRequest({
              type: "staffing.remove",
              dealId,
              targetKind: "staffing_assignment",
              targetId: existing.id,
              previous: existing,
              payload: { id: existing.id },
            });
          }
          return;
        }
        if (existing) {
          await submitApprovalRequest({
            type: "staffing.update",
            dealId,
            targetKind: "staffing_assignment",
            targetId: existing.id,
            previous: existing,
            payload: {
              id: existing.id,
              personId,
              allocationPct,
              roleKey,
              startDate: extras?.startDate ?? existing.startDate,
              endDate: extras?.endDate ?? existing.endDate,
            },
          });
        } else {
          const newId = uid();
          await submitApprovalRequest({
            type: "staffing.add",
            dealId,
            targetKind: "staffing_assignment",
            targetId: newId,
            payload: {
              id: newId,
              dealId,
              roleKey,
              personId,
              allocationPct,
              startDate: extras?.startDate || undefined,
              endDate: extras?.endDate || undefined,
            },
          });
        }
        return;
      }
      if (!personId) {
        if (existing) {
          patch.assignments((prev) => prev.filter((a) => a.id !== existing.id));
          await softDelete("staffing_assignment", existing.id);
        }
        return;
      }
      if (existing) {
        patch.assignments((prev) =>
          prev.map((a) =>
            a.id === existing.id
              ? {
                  ...a,
                  personId,
                  allocationPct,
                  startDate: extras?.startDate ?? a.startDate,
                  endDate: extras?.endDate ?? a.endDate,
                }
              : a,
          ),
        );
        const upd: TablesUpdate<"staffing_assignments"> = {
          person_id: personId,
          allocation_pct: allocationPct,
        };
        if (extras?.startDate !== undefined) upd.start_date = extras.startDate || null;
        if (extras?.endDate !== undefined) upd.end_date = extras.endDate || null;
        await supabase.from("staffing_assignments").update(upd).eq("id", existing.id);
        if (existing.personId !== personId) {
          notifyStaffing(personId, dealId, roleKey, allocationPct);
        }
      } else {
        const id = uid();
        const newAssignment: StaffingAssignment = {
          id,
          dealId,
          roleKey,
          personId,
          allocationPct,
          startDate: extras?.startDate || undefined,
          endDate: extras?.endDate || undefined,
        };
        patch.assignments((prev) => [...prev, newAssignment]);
        await supabase.from("staffing_assignments").insert(assignmentToDb(newAssignment));
        notifyStaffing(personId, dealId, roleKey, allocationPct);
      }
    },
    [getAssignments, notifyStaffing, canEditAll, patch],
  );

  // ── Deals ──
  const updateDeal = useCallback(
    async (dealId: string, updates: Partial<Deal>) => {
      patch.deals((prev) => prev.map((d) => (d.id === dealId ? { ...d, ...updates } : d)));
      const dbUpdates: TablesUpdate<"staffing_deals"> = {};
      Object.entries(updates).forEach(([k, v]) => {
        const snakeKey = k.replace(/([A-Z])/g, "_$1").toLowerCase();
        (dbUpdates as any)[snakeKey] = v;
      });
      await supabase.from("staffing_deals").update(dbUpdates).eq("id", dealId);
    },
    [patch],
  );

  // ── Hiring Needs ──
  const setHiringNeeds = useCallback(
    async (newNeeds: HiringNeed[]) => {
      patch.hiring(newNeeds);
      await supabase.from("staffing_hiring_needs").delete().neq("id", "");
      if (newNeeds.length > 0) {
        await batchUpsert("staffing_hiring_needs", newNeeds.map(hiringToDb));
      }
    },
    [patch],
  );

  // ── Revenue Targets ──
  const setRevenueTargets = useCallback(
    async (newTargets: RevenueCapacityTarget[]) => {
      patch.targets(newTargets);
      await supabase
        .from("staffing_revenue_targets")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      for (const rt of newTargets) {
        await (supabase.from("staffing_revenue_targets") as any).upsert(
          {
            department: rt.department,
            designation: rt.designation,
            target_deal_value_per_person: rt.targetDealValuePerPerson,
          },
          { onConflict: "department,designation" },
        );
      }
    },
    [patch],
  );

  // ── BW Rules ──
  const updateBWRule = useCallback(
    async (ruleId: string, updates: Partial<BWRule>) => {
      patch.rules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, ...updates } : r)));
      const dbUpdates: Record<string, any> = {};
      if (updates.recommendedPct !== undefined) dbUpdates.recommended_pct = updates.recommendedPct;
      if (updates.capability !== undefined) dbUpdates.capability = updates.capability;
      if (updates.region !== undefined) dbUpdates.region = updates.region;
      if (updates.roleKey !== undefined) dbUpdates.role_key = updates.roleKey;
      await (supabase.from("staffing_bw_rules") as any).update(dbUpdates).eq("id", ruleId);
    },
    [patch],
  );

  const addBWRule = useCallback(
    async (rule: BWRule) => {
      patch.rules((prev) => [...prev, rule]);
      await (supabase.from("staffing_bw_rules") as any).insert(rule);
    },
    [patch],
  );

  const deleteBWRule = useCallback(
    async (ruleId: string) => {
      patch.rules((prev) => prev.filter((r) => r.id !== ruleId));
      await (supabase.from("staffing_bw_rules") as any).delete().eq("id", ruleId);
    },
    [patch],
  );

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

  return useMemo(
    () => ({
      addPerson,
      updatePerson,
      deletePerson,
      bulkUpdatePeople,
      addAssignment,
      updateAssignment,
      deleteAssignment,
      upsertAssignmentByRole,
      updateDeal,
      setHiringNeeds,
      setRevenueTargets,
      updateBWRule,
      addBWRule,
      deleteBWRule,
      refresh,
    }),
    [
      addPerson,
      updatePerson,
      deletePerson,
      bulkUpdatePeople,
      addAssignment,
      updateAssignment,
      deleteAssignment,
      upsertAssignmentByRole,
      updateDeal,
      setHiringNeeds,
      setRevenueTargets,
      updateBWRule,
      addBWRule,
      deleteBWRule,
      refresh,
    ],
  );
}