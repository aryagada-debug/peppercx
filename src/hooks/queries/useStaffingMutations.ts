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
  normalizeRoleKey,
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
import { sendAppEmail } from "@/lib/appEmail";

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
      if (updates.revenueTargetPerPerson !== undefined) (dbUpdates as any).revenue_target_per_person = updates.revenueTargetPerPerson;
      if (updates.revenueTargetCurrency !== undefined) (dbUpdates as any).revenue_target_currency = updates.revenueTargetCurrency;
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

  const emailStaffing = useCallback(
    (
      event: "staffed" | "staffing_changed" | "staffing_removed",
      a: { personId: string; dealId: string; roleKey: string; allocationPct: number; startDate?: string; endDate?: string },
    ) => {
      if (!a.personId || !a.dealId) return;
      sendAppEmail({
        event,
        dealId: a.dealId,
        personId: a.personId,
        payload: {
          roleKey: a.roleKey,
          allocationPct: a.allocationPct,
          startDate: a.startDate,
          endDate: a.endDate,
        },
      });
    },
    [],
  );

  const addAssignment = useCallback(
    async (assignment: StaffingAssignment) => {
      if (!canEditAll) {
        toast.error("Only Admins and VSDs can edit staffing.");
        return;
      }
      // Idempotent add: if the same (deal, role, person) is already
      // staffed, merge the new allocation/dates onto the existing row
      // instead of inserting a duplicate. This makes repeated quick-add
      // clicks safe and prevents stale rows piling up in the cache.
      const normalizedAssignment = { ...assignment, roleKey: normalizeRoleKey(assignment.roleKey) };
      const existing = getAssignments().find(
        (a) =>
          a.dealId === normalizedAssignment.dealId &&
          normalizeRoleKey(a.roleKey) === normalizedAssignment.roleKey &&
          a.personId === normalizedAssignment.personId,
      );
      if (existing) {
        const merged: StaffingAssignment = {
          ...existing,
          roleKey: normalizedAssignment.roleKey,
          allocationPct: normalizedAssignment.allocationPct,
          startDate: normalizedAssignment.startDate ?? existing.startDate,
          endDate: normalizedAssignment.endDate ?? existing.endDate,
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
        notifyStaffing(merged.personId, merged.dealId, merged.roleKey, merged.allocationPct);
        emailStaffing("staffing_changed", merged);
        return;
      }
      patch.assignments((prev) => [...prev, normalizedAssignment]);
      const { error } = await supabase
        .from("staffing_assignments")
        .insert(assignmentToDb(normalizedAssignment));
      if (error) {
        console.error("[addAssignment] insert failed", error);
        patch.assignments((prev) => prev.filter((a) => a.id !== normalizedAssignment.id));
        toast.error("Couldn't add staffing — please retry");
        return;
      }
      // Lightweight invalidation: the optimistic patch already shows the new
      // row. We mark assignments stale so the next focus/refocus refetches,
      // and skip the deals refetch entirely (the server-side BOPM/VSD sync
      // trigger was removed, so deals no longer change on assignment writes).
      void qc.invalidateQueries({ queryKey: qk.assignments(), refetchType: "none" });
      notifyStaffing(normalizedAssignment.personId, normalizedAssignment.dealId, normalizedAssignment.roleKey, normalizedAssignment.allocationPct);
      emailStaffing("staffed", normalizedAssignment);
    },
    [notifyStaffing, emailStaffing, canEditAll, patch, qc, getAssignments],
  );

  const updateAssignment = useCallback(
    async (id: string, updates: Partial<StaffingAssignment>) => {
      if (!canEditAll) {
        toast.error("Only Admins and VSDs can edit staffing.");
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
      if (updates.roleKey !== undefined) dbUpdates.role_key = normalizeRoleKey(updates.roleKey);
      if (updates.dealId !== undefined) dbUpdates.staffing_deal_id = updates.dealId;
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
      qc.invalidateQueries({ queryKey: qk.assignments(), refetchType: "none" });
      if (next && updates.personId) {
        notifyStaffing(next.personId, next.dealId, next.roleKey, next.allocationPct);
        emailStaffing("staffed", next);
      } else if (next) {
        emailStaffing("staffing_changed", next);
      }
    },
    [notifyStaffing, emailStaffing, canEditAll, getAssignments, patch, qc],
  );

  const deleteAssignment = useCallback(
    async (id: string) => {
      if (!canEditAll) {
        toast.error("Only Admins and VSDs can remove staffing.");
        return;
      }
      const prevSnapshot = getAssignments().find((a) => a.id === id);
      patch.assignments((prev) => prev.filter((a) => a.id !== id));
      try {
        await softDelete("staffing_assignment", id);
        qc.invalidateQueries({ queryKey: qk.assignments(), refetchType: "none" });
        if (prevSnapshot) emailStaffing("staffing_removed", prevSnapshot);
      } catch (err) {
        console.error("[deleteAssignment] failed", err);
        if (prevSnapshot) {
          patch.assignments((prev) => [...prev, prevSnapshot]);
        }
        toast.error("Couldn't remove staffing — please retry");
      }
    },
    [canEditAll, emailStaffing, getAssignments, patch, qc],
  );

  const upsertAssignmentByRole = useCallback(
    async (
      dealId: string,
      roleKey: string,
      personId: string,
      allocationPct: number,
      extras?: { startDate?: string; endDate?: string },
    ) => {
      const normalizedRoleKey = normalizeRoleKey(roleKey);
      const assignments = getAssignments();
      const existing = assignments.find((a) => a.dealId === dealId && normalizeRoleKey(a.roleKey) === normalizedRoleKey);
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
              roleKey: normalizedRoleKey,
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
              roleKey: normalizedRoleKey,
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
          emailStaffing("staffing_removed", existing);
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
          notifyStaffing(personId, dealId, normalizedRoleKey, allocationPct);
          emailStaffing("staffed", { ...existing, personId, allocationPct });
        } else {
          emailStaffing("staffing_changed", { ...existing, personId, allocationPct });
        }
      } else {
        const id = uid();
        const newAssignment: StaffingAssignment = {
          id,
          dealId,
          roleKey: normalizedRoleKey,
          personId,
          allocationPct,
          startDate: extras?.startDate || undefined,
          endDate: extras?.endDate || undefined,
        };
        patch.assignments((prev) => [...prev, newAssignment]);
        await supabase.from("staffing_assignments").insert(assignmentToDb(newAssignment));
        notifyStaffing(personId, dealId, normalizedRoleKey, allocationPct);
        emailStaffing("staffed", newAssignment);
      }
    },
    [getAssignments, notifyStaffing, emailStaffing, canEditAll, patch],
  );

  // ── Deals ──
  const updateDeal = useCallback(
    async (dealId: string, updates: Partial<Deal>) => {
      patch.deals((prev) => prev.map((d) => (d.id === dealId ? { ...d, ...updates } : d)));
      const dbUpdates: TablesUpdate<"staffing_deals"> = {};
      Object.entries(updates).forEach(([k, v]) => {
        // Special-case: the camelCase `dealId` field maps to the
        // human-facing identifier column `new_deal_id_formulated`
        // (not a non-existent `deal_id` column).
        if (k === "dealId") {
          (dbUpdates as any).new_deal_id_formulated = v;
          return;
        }
        const snakeKey = k.replace(/([A-Z])/g, "_$1").toLowerCase();
        (dbUpdates as any)[snakeKey] = v;
      });
      await supabase.from("staffing_deals").update(dbUpdates).eq("id", dealId);
    },
    [patch],
  );

  // ── Staffing Lock (admin-only RPC) ──
  // Locking a deal marks it as "Staffed". Unlocking reverts it to "Unstaffed".
  // The DB function enforces the admin check; we still optimistically patch
  // the cache so the UI feels instant.
  const lockStaffing = useCallback(
    async (dealId: string, lock: boolean) => {
      const prevSnapshot = qc.getQueryData<Deal[]>(qk.deals());
      const optimisticAt = lock ? new Date().toISOString() : null;
      patch.deals((prev) =>
        prev.map((d) =>
          d.id === dealId
            ? {
                ...d,
                staffingLockedAt: optimisticAt,
                staffingLockedBy: lock ? d.staffingLockedBy ?? null : null,
                staffingLockedByName: lock ? d.staffingLockedByName || "" : "",
              }
            : d,
        ),
      );
      const { data, error } = await (supabase as any).rpc("toggle_staffing_lock", {
        _deal_id: dealId,
        _lock: lock,
      });
      if (error) {
        if (prevSnapshot) qc.setQueryData<Deal[]>(qk.deals(), prevSnapshot);
        const msg = /permission denied/i.test(error.message)
          ? "Only Central CX (admin) can lock staffing."
          : error.message || "Failed to update staffing lock.";
        toast.error(msg);
        throw error;
      }
      // Reconcile with server-truth row (in case the snapshot of name/at differs).
      if (data) {
        const row = data as any;
        patch.deals((prev) =>
          prev.map((d) =>
            d.id === dealId
              ? {
                  ...d,
                  staffingLockedAt: row.staffing_locked_at ?? null,
                  staffingLockedBy: row.staffing_locked_by ?? null,
                  staffingLockedByName: row.staffing_locked_by_name || "",
                }
              : d,
          ),
        );
      }
      toast.success(lock ? "Staffing locked" : "Staffing unlocked");
    },
    [patch, qc],
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
      lockStaffing,
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
      lockStaffing,
      setHiringNeeds,
      setRevenueTargets,
      updateBWRule,
      addBWRule,
      deleteBWRule,
      refresh,
    ],
  );
}