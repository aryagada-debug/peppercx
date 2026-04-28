import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AppUser {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  staffingPersonId: string | null;
}

/** Lower-case + collapse whitespace + strip punctuation for fuzzy name match. */
function nameKey(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

let cache: { users: AppUser[]; ts: number } | null = null;
const subscribers = new Set<(u: AppUser[]) => void>();
let realtimeBound = false;

async function loadUsers(): Promise<AppUser[]> {
  const [{ data: profiles }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("user_id, display_name, staffing_person_id"),
    supabase.from("user_roles").select("user_id, role"),
  ]);

  const roleByUser = new Map<string, string>();
  (roles || []).forEach((r: any) => {
    const cur = roleByUser.get(r.user_id);
    // admin > moderator > user
    const rank = (rr: string) => (rr === "admin" ? 3 : rr === "moderator" ? 2 : 1);
    if (!cur || rank(r.role) > rank(cur)) roleByUser.set(r.user_id, r.role);
  });

  // Try to get emails via the admin function (best-effort; works for admins).
  let emailByUser = new Map<string, string>();
  try {
    const { data } = await supabase.functions.invoke("admin-user-mgmt", { body: { action: "list" } });
    if (data?.users) {
      emailByUser = new Map(data.users.map((u: any) => [u.id, u.email || ""]));
    }
  } catch {
    /* non-admins won't have access — fine */
  }

  const built: AppUser[] = (profiles || []).map((p: any) => ({
    userId: p.user_id,
    displayName: (p.display_name || "").trim() || "Unnamed",
    email: emailByUser.get(p.user_id) || "",
    role: roleByUser.get(p.user_id) || "user",
    staffingPersonId: p.staffing_person_id || null,
  }));
  built.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return built;
}

function bindRealtime() {
  if (realtimeBound) return;
  realtimeBound = true;
  supabase
    .channel("app-users-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, async () => {
      const next = await loadUsers();
      cache = { users: next, ts: Date.now() };
      subscribers.forEach((s) => s(next));
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, async () => {
      const next = await loadUsers();
      cache = { users: next, ts: Date.now() };
      subscribers.forEach((s) => s(next));
    })
    .subscribe();
}

export function useAppUsers() {
  const [users, setUsers] = useState<AppUser[]>(cache?.users || []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    bindRealtime();
    let alive = true;
    const sub = (u: AppUser[]) => alive && setUsers(u);
    subscribers.add(sub);

    if (!cache || Date.now() - cache.ts > 60_000) {
      loadUsers().then((next) => {
        if (!alive) return;
        cache = { users: next, ts: Date.now() };
        setUsers(next);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }

    return () => {
      alive = false;
      subscribers.delete(sub);
    };
  }, []);

  const refresh = useCallback(async () => {
    const next = await loadUsers();
    cache = { users: next, ts: Date.now() };
    subscribers.forEach((s) => s(next));
  }, []);

  const byUserId = useMemo(() => new Map(users.map((u) => [u.userId, u])), [users]);
  const byNameKey = useMemo(() => {
    const m = new Map<string, AppUser>();
    users.forEach((u) => m.set(nameKey(u.displayName), u));
    return m;
  }, [users]);
  const nameSet = useMemo(() => new Set(users.map((u) => nameKey(u.displayName))), [users]);

  /** Returns true if a free-text name (e.g. from a deal field) matches any registered user. */
  const isRegisteredName = useCallback(
    (name: string | null | undefined) => {
      const k = nameKey(name || "");
      return k.length > 0 && nameSet.has(k);
    },
    [nameSet],
  );

  return { users, loading, byUserId, byNameKey, isRegisteredName, nameKey, refresh };
}

export { nameKey };
