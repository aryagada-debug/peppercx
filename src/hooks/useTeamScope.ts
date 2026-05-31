import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { getDescendantPersonIds, type Person } from "@/data/staffingData";

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
    if (role !== "member" && role !== "capability_lead") {
      const empty = new Set<string>();
      return {
        loading,
        scopeMode: "none",
        leaderPerson: null,
        teamPersonIds: empty,
        inScope: () => false,
        inScopeByName: () => false,
      };
    }

    const leader = allPeople.find((p) => p.id === leaderPersonId) || null;
    const ids = new Set<string>();
    if (leader) {
      ids.add(leader.id);
      const descendants = getDescendantPersonIds([leader.name], allPeople);
      descendants.forEach((id) => ids.add(id));
    }
    const namesLc = new Set<string>(
      Array.from(ids)
        .map((id) => allPeople.find((p) => p.id === id)?.name?.trim().toLowerCase())
        .filter((n): n is string => !!n),
    );
    return {
      loading,
      scopeMode: "team",
      leaderPerson: leader,
      teamPersonIds: ids,
      inScope: (pid: string) => ids.has(pid),
      inScopeByName: (name) => {
        const n = (name || "").trim().toLowerCase();
        return n ? namesLc.has(n) : false;
      },
    };
  }, [authLoading, roleLoading, profileLoading, enabled, isAdmin, role, leaderPersonId, allPeople]);
}