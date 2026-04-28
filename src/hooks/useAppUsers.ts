import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AppUser {
  userId: string;          // profile user_id when linked, else "person:<staffing_id>"
  displayName: string;
  email: string;
  role: string;
  staffingPersonId: string | null;
  source: "auth" | "directory";
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
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

async function loadUsers(): Promise<AppUser[]> {
  // Source of truth = Settings → People (staffing_people).
  // Auth profiles + roles are layered on top when a directory entry has been
  // linked to a real login (via profiles.staffing_person_id).
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

  // Include any auth profiles that aren't linked to a staffing_person (e.g. admins).
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

  // De-dupe by displayName key (directory entry wins over orphan profile).
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

function bindRealtime() {
  if (realtimeBound) return;
  realtimeBound = true;
  // Clean up any stale channel from a previous module instance (HMR / StrictMode).
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  const refresh = async () => {
    const next = await loadUsers();
    cache = { users: next, ts: Date.now() };
    subscribers.forEach((s) => s(next));
  };
  const channel = supabase.channel(`app-users-sync-${Date.now()}`);
  channel.on("postgres_changes", { event: "*", schema: "public", table: "staffing_people" }, refresh);
  channel.on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, refresh);
  channel.on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, refresh);
  channel.subscribe();
  realtimeChannel = channel;
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
