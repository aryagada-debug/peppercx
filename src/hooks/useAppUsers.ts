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

// ----- VSD allowlist -----
// Hard-coded list of VSDs (Vertical Sales Directors) used for filter chips in
// Clients & Deals, RGY Health and MBR Tracker. Match by fuzzy name key so
// minor variations ("Aamir" vs "Aamir Khan") still resolve.
export const VSD_NAMES = [
  "Neema Jayadas",
  "Aditya Shaw",
  "Aamir Khan",
  "Sumit Shekhawat",
  "Sneha Iyer",
] as const;

const VSD_KEYS = new Set(VSD_NAMES.map((n) => nameKey(n)));
// Accept first-name-only or partial matches against the canonical list.
const VSD_PARTIALS = VSD_NAMES.map((n) => nameKey(n).split(" "));

function matchesVsd(name: string | null | undefined): string | null {
  const k = nameKey(name || "");
  if (!k) return null;
  if (VSD_KEYS.has(k)) {
    return VSD_NAMES.find((n) => nameKey(n) === k) || null;
  }
  // Token-level match: every token in input must be present in a canonical
  // name, or the canonical's first name must equal input.
  const tokens = k.split(" ");
  for (let i = 0; i < VSD_PARTIALS.length; i++) {
    const canon = VSD_PARTIALS[i];
    const allIn = tokens.every((t) => canon.includes(t));
    const firstMatch = tokens.length === 1 && canon[0] === tokens[0];
    if (allIn || firstMatch) return VSD_NAMES[i];
  }
  return null;
}

export function useVsdUsers() {
  const { users, loading } = useAppUsers();
  const vsdUsers = useMemo(() => {
    // Build canonical AppUser entries from VSD_NAMES, preferring matched
    // staffing/auth profiles when available so emails/links carry through.
    return VSD_NAMES.map<AppUser>((canonical) => {
      const found = users.find((u) => matchesVsd(u.displayName) === canonical);
      return (
        found || {
          userId: `vsd:${nameKey(canonical)}`,
          displayName: canonical,
          email: "",
          role: "user",
          staffingPersonId: null,
          source: "directory",
        }
      );
    });
  }, [users]);

  const isVsdName = useCallback(
    (name: string | null | undefined) => matchesVsd(name) !== null,
    [],
  );

  /** Canonicalise a free-text name to one of VSD_NAMES, or null. */
  const canonVsd = useCallback(
    (name: string | null | undefined) => matchesVsd(name),
    [],
  );

  return { vsdUsers, isVsdName, canonVsd, loading };
}

// ----- VSD reporting hierarchy -----
// Walks `staffing_people.reporting_manager` upward from a given person to find
// the top-level VSD they roll up to. Used by MBR Tracker and RGY Health to
// filter deals by *who actually owns the BOPM relationship*, not by the
// free-text vsd cell on the deal.

let hierarchyCache: { map: Map<string, string>; ts: number } | null = null;
const hierarchySubs = new Set<(m: Map<string, string>) => void>();
let hierarchyChannel: ReturnType<typeof supabase.channel> | null = null;
let hierarchyBound = false;

async function loadHierarchy(): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("staffing_people")
    .select("name, reporting_manager, leaving, tbh");

  // Build manager-of map keyed by nameKey.
  const managerOf = new Map<string, string>(); // person -> manager name (raw)
  (data || []).forEach((p: any) => {
    const k = nameKey(p.name || "");
    if (k) managerOf.set(k, (p.reporting_manager || "").trim());
  });

  const vsdCanonByKey = new Map<string, string>();
  VSD_NAMES.forEach((v) => vsdCanonByKey.set(nameKey(v), v));

  // For each person, walk up the chain until we hit a VSD or run out.
  const personToVsd = new Map<string, string>(); // nameKey -> VSD canonical name
  const resolve = (startKey: string): string | null => {
    const seen = new Set<string>();
    let curKey = startKey;
    for (let i = 0; i < 8; i++) {
      if (!curKey || seen.has(curKey)) return null;
      seen.add(curKey);
      // Is this person itself a VSD?
      const vsd = vsdCanonByKey.get(curKey);
      if (vsd) return vsd;
      const mgr = managerOf.get(curKey);
      if (!mgr) return null;
      curKey = nameKey(mgr);
    }
    return null;
  };

  for (const k of managerOf.keys()) {
    const v = resolve(k);
    if (v) personToVsd.set(k, v);
  }
  // Also map the VSDs themselves (so deals where the VSD is listed as BOPM still resolve).
  VSD_NAMES.forEach((v) => personToVsd.set(nameKey(v), v));
  return personToVsd;
}

function bindHierarchyRealtime() {
  if (hierarchyBound) return;
  hierarchyBound = true;
  if (hierarchyChannel) {
    supabase.removeChannel(hierarchyChannel);
    hierarchyChannel = null;
  }
  const refresh = async () => {
    const next = await loadHierarchy();
    hierarchyCache = { map: next, ts: Date.now() };
    hierarchySubs.forEach((s) => s(next));
  };
  const ch = supabase.channel(`vsd-hierarchy-sync-${Date.now()}`);
  ch.on("postgres_changes", { event: "*", schema: "public", table: "staffing_people" }, refresh);
  ch.subscribe();
  hierarchyChannel = ch;
}

export function useVsdHierarchy() {
  const [map, setMap] = useState<Map<string, string>>(hierarchyCache?.map || new Map());
  const [loading, setLoading] = useState(!hierarchyCache);

  useEffect(() => {
    bindHierarchyRealtime();
    let alive = true;
    const sub = (m: Map<string, string>) => alive && setMap(m);
    hierarchySubs.add(sub);

    if (!hierarchyCache || Date.now() - hierarchyCache.ts > 60_000) {
      loadHierarchy().then((next) => {
        if (!alive) return;
        hierarchyCache = { map: next, ts: Date.now() };
        setMap(next);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }

    return () => {
      alive = false;
      hierarchySubs.delete(sub);
    };
  }, []);

  const vsdForPerson = useCallback(
    (name: string | null | undefined): string | null => {
      const k = nameKey(name || "");
      if (!k) return null;
      return map.get(k) || null;
    },
    [map],
  );

  /** Resolve a deal's owning VSD by walking principal → senior → junior BOPM. */
  const vsdForDeal = useCallback(
    (deal: { principal_bopm?: string | null; senior_bopm?: string | null; bopm?: string | null; principalBopm?: string | null; seniorBopm?: string | null; }): string | null => {
      const candidates = [
        (deal as any).principal_bopm ?? (deal as any).principalBopm,
        (deal as any).senior_bopm ?? (deal as any).seniorBopm,
        (deal as any).bopm,
      ];
      for (const c of candidates) {
        const v = vsdForPerson(c);
        if (v) return v;
      }
      return null;
    },
    [vsdForPerson],
  );

  return { vsdForPerson, vsdForDeal, loading };
}
