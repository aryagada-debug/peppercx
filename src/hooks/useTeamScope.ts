import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { type Person } from "@/data/staffingData";

export type ScopeMode = "all" | "team" | "none";

export interface TeamScope {
  loading: boolean;
  scopeMode: ScopeMode;
  /** When scopeMode === "team", the leader's own person record (if resolvable). */
  leaderPerson: Person | null;
  /** Person ids in scope (self + direct & indirect reportees). Undefined when scopeMode === "all". */
  teamPersonIds: Set<string> | null;
  /** Filter helper: returns true if the person is in scope (admins => always true). */
  inScope: (personId: string) => boolean;
  /** Filter helper for a person's *name* (case-insensitive). */
  inScopeByName: (name: string | undefined | null) => boolean;
}

/**
 * Determines which people / deals the current viewer should see in People Ops.
 * Admins see everything. VSDs (member) and Capability Leaders see themselves
 * + all direct and indirect reportees via staffing_people.reporting_manager.
 */
export function useTeamScope(allPeople: Person[]): TeamScope {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, role, loading: roleLoading } = useUserRole();
  const userId = user?.id ?? null;
  const enabled = !authLoading && !roleLoading && !isAdmin && !!userId;

  const { data: leaderPersonId, isLoading: profileLoading } = useQuery({
    queryKey: ["team-scope.leader-person-id", userId],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("staffing_person_id")
        .eq("user_id", userId!)
        .maybeSingle();
      return (data as any)?.staffing_person_id ?? null;
    },
  });

  return useMemo<TeamScope>(() => {
    const loading = authLoading || roleLoading || (enabled && profileLoading);
    if (isAdmin) {
      return {
        loading,
        scopeMode: "all",
        leaderPerson: null,
        teamPersonIds: null,
        inScope: () => true,
        inScopeByName: () => true,
      };
    }
    // VSDs and Capability Leaders see only themselves + their reportee subtree
    // (mirrors Clients & Deals RLS scoping). Add/Edit controls remain gated by
    // `isAdmin` at the component level.
    if (role === "member" || role === "capability_lead") {
      const leader = allPeople.find((p) => p.id === leaderPersonId) || null;
      const ids = new Set<string>();
      const names = new Set<string>();
      if (leader) {
        ids.add(leader.id);
        names.add(leader.name.trim().toLowerCase());
        // BFS over reportingManager edges
        const byManager = new Map<string, typeof allPeople>();
        for (const p of allPeople) {
          const mgr = (p.reportingManager || "").trim().toLowerCase();
          if (!mgr) continue;
          const arr = byManager.get(mgr) || [];
          arr.push(p);
          byManager.set(mgr, arr);
        }
        const queue: string[] = [leader.name.trim().toLowerCase()];
        while (queue.length) {
          const mgr = queue.shift()!;
          const reports = byManager.get(mgr) || [];
          for (const r of reports) {
            if (ids.has(r.id)) continue;
            ids.add(r.id);
            names.add(r.name.trim().toLowerCase());
            queue.push(r.name.trim().toLowerCase());
          }
        }
      }
      return {
        loading,
        scopeMode: leader ? "team" : "none",
        leaderPerson: leader,
        teamPersonIds: ids,
        inScope: (pid: string) => ids.has(pid),
        inScopeByName: (n) => !!n && names.has(n.trim().toLowerCase()),
      };
    }
    const empty = new Set<string>();
    return {
      loading,
      scopeMode: "none",
      leaderPerson: null,
      teamPersonIds: empty,
      inScope: () => false,
      inScopeByName: () => false,
    };
  }, [authLoading, roleLoading, profileLoading, enabled, isAdmin, role, leaderPersonId, allPeople]);
}