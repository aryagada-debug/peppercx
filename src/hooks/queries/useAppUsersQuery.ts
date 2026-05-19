/**
 * React Query replacement for `useAppUsers`.
 *
 * Same source-of-truth composition as the legacy hook: staffing_people
 * (directory) layered with profiles + user_roles (auth side). Realtime on
 * those three tables triggers a debounced refetch of the combined view.
 *
 * In Phase 3 this hook will replace the hand-rolled pubsub in
 * `src/hooks/useAppUsers.ts` and consumers will switch over.
 */
import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { useTableSubscription, invalidatePatcher } from "@/lib/realtime";

export interface AppUser {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  staffingPersonId: string | null;
  source: "auth" | "directory";
}

export function nameKey(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchAppUsers(): Promise<AppUser[]> {
  const [peopleRes, profilesRes, rolesRes] = await Promise.all([
    supabase
      .from("staffing_people")
      .select("id, name, email, leaving, tbh")
      .eq("leaving", false)
      .eq("tbh", false),
    supabase.from("profiles").select("user_id, display_name, staffing_person_id"),
    supabase.from("user_roles").select("user_id, role"),
  ]);

  const roleByUser = new Map<string, string>();
  const rank = (rr: string) => (rr === "admin" ? 3 : rr === "moderator" ? 2 : 1);
  (rolesRes.data || []).forEach((r: any) => {
    const cur = roleByUser.get(r.user_id);
    if (!cur || rank(r.role) > rank(cur)) roleByUser.set(r.user_id, r.role);
  });

  const profileByPersonId = new Map<string, { user_id: string; display_name: string }>();
  const linkedPersonIds = new Set<string>();
  (profilesRes.data || []).forEach((p: any) => {
    if (p.staffing_person_id) {
      profileByPersonId.set(p.staffing_person_id, p);
      linkedPersonIds.add(p.staffing_person_id);
    }
  });

  const built: AppUser[] = (peopleRes.data || []).map((person: any) => {
    const linked = profileByPersonId.get(person.id);
    return {
      userId: linked?.user_id || `person:${person.id}`,
      displayName: (person.name || "").trim() || "Unnamed",
      email: (person.email || "").trim(),
      role: linked ? roleByUser.get(linked.user_id) || "user" : "user",
      staffingPersonId: person.id,
      source: linked ? "auth" : "directory",
    };
  });

  (profilesRes.data || []).forEach((p: any) => {
    if (p.staffing_person_id && linkedPersonIds.has(p.staffing_person_id)) return;
    built.push({
      userId: p.user_id,
      displayName: (p.display_name || "").trim() || "Unnamed",
      email: "",
      role: roleByUser.get(p.user_id) || "user",
      staffingPersonId: null,
      source: "auth",
    });
  });

  const seen = new Set<string>();
  const dedup: AppUser[] = [];
  for (const u of built) {
    const k = nameKey(u.displayName);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    dedup.push(u);
  }
  dedup.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return dedup;
}

export function useAppUsersQuery() {
  const qc = useQueryClient();
  const key = qk.appUsers();
  const query = useQuery({
    queryKey: key,
    queryFn: fetchAppUsers,
    staleTime: 60_000,
  });

  const inv = useMemo(() => invalidatePatcher(key), [key]);
  useTableSubscription({ table: "staffing_people", patcher: inv });
  useTableSubscription({ table: "profiles", patcher: inv });
  useTableSubscription({ table: "user_roles", patcher: inv });

  const users = query.data ?? [];
  const byUserId = useMemo(() => new Map(users.map((u) => [u.userId, u])), [users]);
  const byNameKey = useMemo(() => {
    const m = new Map<string, AppUser>();
    users.forEach((u) => m.set(nameKey(u.displayName), u));
    return m;
  }, [users]);
  const nameSet = useMemo(() => new Set(users.map((u) => nameKey(u.displayName))), [users]);

  const isRegisteredName = useCallback(
    (name: string | null | undefined) => {
      const k = nameKey(name || "");
      return k.length > 0 && nameSet.has(k);
    },
    [nameSet],
  );

  const refresh = useCallback(() => {
    return qc.invalidateQueries({ queryKey: key });
  }, [qc, key]);

  return {
    users,
    loading: query.isLoading,
    byUserId,
    byNameKey,
    isRegisteredName,
    nameKey,
    refresh,
  };
}