/**
 * Compatibility shim. Replaces the ~600 LOC monolithic provider with a
 * composition of the new React Query hooks under `src/hooks/queries/*`.
 * Public API is byte-compatible with the old `useStaffingData()` so the
 * 15+ consumer pages don't need touching in this phase.
 *
 * Behavior preserved:
 *  - Same return-shape: `{ people, deals, assignments, hiringNeeds,
 *    revenueTargets, bwRules, loading, addPerson, ..., refresh }`
 *  - Approval-gated assignment writes (canEditAll === false → submit
 *    approval request instead of mutating)
 *  - Slack DM on staffing assignment
 *  - First-load seeding when staffing_people is empty
 *
 * `StaffingDataProvider` is now a no-op passthrough — every consumer
 * subscribes through React Query directly so a context provider is no
 * longer required. It stays exported for backwards-compat with App.tsx,
 * which is being updated in the same patch.
 */
import { createElement, useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import {
  personToDb,
  dealToDb,
  assignmentToDb,
  hiringToDb,
} from "@/lib/dbMappers";
import { usePeopleQuery } from "@/hooks/queries/usePeopleQuery";
import { useDealsQuery } from "@/hooks/queries/useDealsQuery";
import { useAssignmentsQuery } from "@/hooks/queries/useAssignmentsQuery";
import { useHiringQuery } from "@/hooks/queries/useHiringQuery";
import { useRevTargetsQuery } from "@/hooks/queries/useRevTargetsQuery";
import { useBWRulesQuery } from "@/hooks/queries/useBWRulesQuery";

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

export function useStaffingData() {
  const qc = useQueryClient();
  const { canEditAll } = useUserRole();
  const { session, loading: authLoading } = useAuth();
  const isAuthenticated = !authLoading && !!session;

  // ── Data hooks (each owns its own realtime channel) ──
  const peopleQ = usePeopleQuery();
  const dealsQ = useDealsQuery();
  const assignmentsQ = useAssignmentsQuery();
  const hiringQ = useHiringQuery();
  const targetsQ = useRevTargetsQuery();
  const rulesQ = useBWRulesQuery();

  const people = peopleQ.data ?? DEFAULT_PEOPLE;
  const deals = dealsQ.data ?? DEFAULT_DEALS;
  const assignments = assignmentsQ.data ?? DEFAULT_ASSIGNMENTS;
  const hiringNeeds = hiringQ.data ?? DEFAULT_HIRING_NEEDS;
  const revenueTargets = targetsQ.data ?? DEFAULT_REVENUE_TARGETS;
  const bwRules = rulesQ.data ?? [];

  const loading =
    peopleQ.isLoading ||
    dealsQ.isLoading ||
    assignmentsQ.isLoading ||
    hiringQ.isLoading ||
    targetsQ.isLoading ||
    rulesQ.isLoading;

  // ── First-load seed (only when staffing_people is genuinely empty) ──
  const seedingRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated) return;
    if (peopleQ.isLoading) return;
    if ((peopleQ.data?.length ?? 0) > 0) return;
    if (seedingRef.current) return;
    seedingRef.current = true;
    (async () => {
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
  }, [isAuthenticated, peopleQ.isLoading, peopleQ.data, qc]);

  // ── Cache patch helpers (used by all mutations) ──
  const patchPeople = useCallback(
    (updater: (prev: Person[]) => Person[]) => {
      qc.setQueryData<Person[]>(qk.people(), (prev) => updater(prev || []));
    },
    [qc],
  );
  const patchDeals = useCallback(
    (updater: (prev: Deal[]) => Deal[]) => {
      qc.setQueryData<Deal[]>(qk.deals(), (prev) => updater(prev || []));
    },
    [qc],
  );
  const patchAssignments = useCallback(
    (updater: (prev: StaffingAssignment[]) => StaffingAssignment[]) => {
      qc.setQueryData<StaffingAssignment[]>(qk.assignments(), (prev) => updater(prev || []));
    },
    [qc],
  );
  const patchHiring = useCallback(
    (next: HiringNeed[]) => {
      qc.setQueryData<HiringNeed[]>(qk.hiringNeeds(), next);
    },
    [qc],
  );
  const patchTargets = useCallback(
    (next: RevenueCapacityTarget[]) => {
      qc.setQueryData<RevenueCapacityTarget[]>(qk.revenueTargets(), next);
    },
    [qc],
  );
  const patchRules = useCallback(
    (updater: (prev: BWRule[]) => BWRule[]) => {
      qc.setQueryData<BWRule[]>(qk.bwRules(), (prev) => updater(prev || []));
    },
    [qc],
  );

  // ── CRUD: People ──
  const addPerson = useCallback(
    async (person: Person) => {
      patchPeople((prev) => [...prev, person]);
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
    [patchPeople],
  );

  const updatePerson = useCallback(
    async (personId: string, updates: Partial<Person>) => {
      patchPeople((prev) => prev.map((p) => (p.id === personId ? { ...p, ...updates } : p)));
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
    [patchPeople],
  );

  const deletePerson = useCallback(
    async (personId: string) => {
      patchPeople((prev) => prev.filter((p) => p.id !== personId));
      patchAssignments((prev) => prev.filter((a) => a.personId !== personId));
      await supabase.from("staffing_people").delete().eq("id", personId);
    },
    [patchPeople, patchAssignments],
  );

  const bulkUpdatePeople = useCallback(
    async (personIds: string[], field: keyof Person, value: string) => {
      patchPeople((prev) =>
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
    [patchPeople],
  );

  // ── CRUD: Assignments ──
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
      patchAssignments((prev) => [...prev, assignment]);
      await supabase.from("staffing_assignments").insert(assignmentToDb(assignment));
      notifyStaffing(assignment.personId, assignment.dealId, assignment.roleKey, assignment.allocationPct);
    },
    [notifyStaffing, canEditAll, patchAssignments],
  );

  const updateAssignment = useCallback(
    async (id: string, updates: Partial<StaffingAssignment>) => {
      if (!canEditAll) {
        const current = assignments.find((a) => a.id === id);
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
      let next: StaffingAssignment | undefined;
      patchAssignments((prev) =>
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
      await supabase.from("staffing_assignments").update(dbUpdates).eq("id", id);
      if (next && updates.personId) {
        notifyStaffing(next.personId, next.dealId, next.roleKey, next.allocationPct);
      }
    },
    [notifyStaffing, canEditAll, assignments, patchAssignments],
  );

  const deleteAssignment = useCallback(
    async (id: string) => {
      if (!canEditAll) {
        const current = assignments.find((a) => a.id === id);
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
      patchAssignments((prev) => prev.filter((a) => a.id !== id));
      await supabase.from("staffing_assignments").delete().eq("id", id);
    },
    [canEditAll, assignments, patchAssignments],
  );

  const upsertAssignmentByRole = useCallback(
    async (
      dealId: string,
      roleKey: string,
      personId: string,
      allocationPct: number,
      extras?: { startDate?: string; endDate?: string },
    ) => {
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
          patchAssignments((prev) => prev.filter((a) => a.id !== existing.id));
          await supabase.from("staffing_assignments").delete().eq("id", existing.id);
        }
        return;
      }
      if (existing) {
        patchAssignments((prev) =>
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
        patchAssignments((prev) => [...prev, newAssignment]);
        await supabase.from("staffing_assignments").insert(assignmentToDb(newAssignment));
        notifyStaffing(personId, dealId, roleKey, allocationPct);
      }
    },
    [assignments, notifyStaffing, canEditAll, patchAssignments],
  );

  // ── CRUD: Deals ──
  const updateDeal = useCallback(
    async (dealId: string, updates: Partial<Deal>) => {
      patchDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, ...updates } : d)));
      const dbUpdates: TablesUpdate<"staffing_deals"> = {};
      Object.entries(updates).forEach(([k, v]) => {
        const snakeKey = k.replace(/([A-Z])/g, "_$1").toLowerCase();
        (dbUpdates as any)[snakeKey] = v;
      });
      await supabase.from("staffing_deals").update(dbUpdates).eq("id", dealId);
    },
    [patchDeals],
  );

  // ── CRUD: Hiring Needs ──
  const setHiringNeedsAndSync = useCallback(
    async (newNeeds: HiringNeed[]) => {
      patchHiring(newNeeds);
      await supabase.from("staffing_hiring_needs").delete().neq("id", "");
      if (newNeeds.length > 0) {
        await batchUpsert("staffing_hiring_needs", newNeeds.map(hiringToDb));
      }
    },
    [patchHiring],
  );

  // ── CRUD: Revenue Targets ──
  const setRevenueTargetsAndSync = useCallback(
    async (newTargets: RevenueCapacityTarget[]) => {
      patchTargets(newTargets);
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
    [patchTargets],
  );

  // ── CRUD: BW Rules ──
  const updateBWRule = useCallback(
    async (ruleId: string, updates: Partial<BWRule>) => {
      patchRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, ...updates } : r)));
      const dbUpdates: Record<string, any> = {};
      if (updates.recommendedPct !== undefined) dbUpdates.recommended_pct = updates.recommendedPct;
      if (updates.capability !== undefined) dbUpdates.capability = updates.capability;
      if (updates.region !== undefined) dbUpdates.region = updates.region;
      if (updates.roleKey !== undefined) dbUpdates.role_key = updates.roleKey;
      await (supabase.from("staffing_bw_rules") as any).update(dbUpdates).eq("id", ruleId);
    },
    [patchRules],
  );

  const addBWRule = useCallback(
    async (rule: BWRule) => {
      patchRules((prev) => [...prev, rule]);
      await (supabase.from("staffing_bw_rules") as any).insert(rule);
    },
    [patchRules],
  );

  const deleteBWRule = useCallback(
    async (ruleId: string) => {
      patchRules((prev) => prev.filter((r) => r.id !== ruleId));
      await (supabase.from("staffing_bw_rules") as any).delete().eq("id", ruleId);
    },
    [patchRules],
  );

  // ── Legacy setters (no-op for new code; preserved for shape compat) ──
  const setPeople = useCallback(
    (next: Person[] | ((prev: Person[]) => Person[])) => {
      patchPeople((prev) => (typeof next === "function" ? (next as any)(prev) : next));
    },
    [patchPeople],
  );
  const setDeals = useCallback(
    (next: Deal[] | ((prev: Deal[]) => Deal[])) => {
      patchDeals((prev) => (typeof next === "function" ? (next as any)(prev) : next));
    },
    [patchDeals],
  );
  const setAssignments = useCallback(
    (next: StaffingAssignment[] | ((prev: StaffingAssignment[]) => StaffingAssignment[])) => {
      patchAssignments((prev) => (typeof next === "function" ? (next as any)(prev) : next));
    },
    [patchAssignments],
  );
  const setBwRules = useCallback(
    (next: BWRule[] | ((prev: BWRule[]) => BWRule[])) => {
      patchRules((prev) => (typeof next === "function" ? (next as any)(prev) : next));
    },
    [patchRules],
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
      people,
      deals,
      assignments,
      hiringNeeds,
      revenueTargets,
      bwRules,
      loading,
      addPerson,
      updatePerson,
      deletePerson,
      bulkUpdatePeople,
      setPeople,
      addAssignment,
      updateAssignment,
      deleteAssignment,
      setAssignments,
      updateDeal,
      setDeals,
      upsertAssignmentByRole,
      setHiringNeeds: setHiringNeedsAndSync,
      setRevenueTargets: setRevenueTargetsAndSync,
      updateBWRule,
      addBWRule,
      deleteBWRule,
      setBwRules,
      refresh,
    }),
    [
      people,
      deals,
      assignments,
      hiringNeeds,
      revenueTargets,
      bwRules,
      loading,
      addPerson,
      updatePerson,
      deletePerson,
      bulkUpdatePeople,
      setPeople,
      addAssignment,
      updateAssignment,
      deleteAssignment,
      setAssignments,
      updateDeal,
      setDeals,
      upsertAssignmentByRole,
      setHiringNeedsAndSync,
      setRevenueTargetsAndSync,
      updateBWRule,
      addBWRule,
      deleteBWRule,
      setBwRules,
      refresh,
    ],
  );
}

// ── Legacy provider — now a pass-through ──
// Old code expected a context boundary. Now every consumer reads through
// React Query directly, so the provider is a no-op kept only for App.tsx
// import compatibility. Safe to delete once App.tsx is updated.
export function StaffingDataProvider({ children }: { children: ReactNode }) {
  return createElement("div", { style: { display: "contents" } }, children);
}