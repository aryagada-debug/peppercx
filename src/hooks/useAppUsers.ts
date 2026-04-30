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
// Source of truth = the Clients & Deals table (`staffing_deals`).
// For each deal we look at `principal_bopm` and `senior_bopm` ONLY (junior
// `bopm` is intentionally excluded) and map those people to the deal's
// canonicalised `vsd`. Used by MBR Tracker and RGY Health so that the VSD
// chip filter shows exactly the deals whose P-BOPM / Sr BOPM rolls up to the
// selected VSD per the deals sheet.

interface HierarchyData {
  map: Map<string, string>;                    // person nameKey -> VSD
  bopmsByVsd: Map<string, string[]>;           // VSD -> sorted BOPM display names
}
let hierarchyCache: { data: HierarchyData; ts: number } | null = null;
const hierarchySubs = new Set<(d: HierarchyData) => void>();
let hierarchyChannel: ReturnType<typeof supabase.channel> | null = null;
let hierarchyBound = false;

async function loadHierarchy(): Promise<HierarchyData> {
  const { data } = await supabase
    .from("staffing_deals")
    .select("vsd, principal_bopm, senior_bopm");

  // person nameKey -> { vsd: count } so the most-frequent VSD wins when a
  // person appears on deals tagged to multiple VSDs (rare but possible).
  const tally = new Map<string, Map<string, number>>();
  // Track preferred display label (first non-empty original casing) per nameKey
  const displayByKey = new Map<string, string>();
  const bump = (rawName: string | null | undefined, vsd: string) => {
    const k = nameKey(rawName || "");
    if (!k) return;
    const trimmed = (rawName || "").trim();
    if (trimmed && !displayByKey.has(k)) displayByKey.set(k, trimmed);
    let inner = tally.get(k);
    if (!inner) {
      inner = new Map();
      tally.set(k, inner);
    }
    inner.set(vsd, (inner.get(vsd) || 0) + 1);
  };

  (data || []).forEach((d: any) => {
    const v = matchesVsd(d.vsd);
    if (!v) return; // deal's vsd cell doesn't map to one of the 5 VSDs
    bump(d.principal_bopm, v);
    bump(d.senior_bopm, v);
  });

  const personToVsd = new Map<string, string>();
  const bopmsByVsd = new Map<string, Set<string>>();
  for (const [personKey, vsdCounts] of tally.entries()) {
    let bestVsd = "";
    let bestN = -1;
    for (const [v, n] of vsdCounts.entries()) {
      if (n > bestN) { bestN = n; bestVsd = v; }
    }
    if (bestVsd) {
      personToVsd.set(personKey, bestVsd);
      const display = displayByKey.get(personKey);
      // Skip self-mapping (VSD's own name) and empties
      if (display && nameKey(display) !== nameKey(bestVsd)) {
        let set = bopmsByVsd.get(bestVsd);
        if (!set) { set = new Set(); bopmsByVsd.set(bestVsd, set); }
        set.add(display);
      }
    }
  }

  // Also map each VSD name to itself, so a deal where the BOPM cell literally
  // contains the VSD's name still resolves cleanly.
  VSD_NAMES.forEach((v) => personToVsd.set(nameKey(v), v));

  const bopmsSorted = new Map<string, string[]>();
  for (const [v, set] of bopmsByVsd.entries()) {
    bopmsSorted.set(v, Array.from(set).sort((a, b) => a.localeCompare(b)));
  }
  return { map: personToVsd, bopmsByVsd: bopmsSorted };
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
    hierarchyCache = { data: next, ts: Date.now() };
    hierarchySubs.forEach((s) => s(next));
  };
  const ch = supabase.channel(`vsd-hierarchy-sync-${Date.now()}`);
  ch.on("postgres_changes", { event: "*", schema: "public", table: "staffing_deals" }, refresh);
  ch.subscribe();
  hierarchyChannel = ch;
}

export function useVsdHierarchy() {
  const [data, setData] = useState<HierarchyData>(
    hierarchyCache?.data || { map: new Map(), bopmsByVsd: new Map() },
  );
  const [loading, setLoading] = useState(!hierarchyCache);

  useEffect(() => {
    bindHierarchyRealtime();
    let alive = true;
    const sub = (d: HierarchyData) => alive && setData(d);
    hierarchySubs.add(sub);

    if (!hierarchyCache || Date.now() - hierarchyCache.ts > 60_000) {
      loadHierarchy().then((next) => {
        if (!alive) return;
        hierarchyCache = { data: next, ts: Date.now() };
        setData(next);
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
      return data.map.get(k) || null;
    },
    [data],
  );

  /** Resolve a deal's owning VSD by checking principal → senior BOPM only. */
  const vsdForDeal = useCallback(
    (deal: { principal_bopm?: string | null; senior_bopm?: string | null; bopm?: string | null; principalBopm?: string | null; seniorBopm?: string | null; vsd?: string | null; }): string | null => {
      const candidates = [
        (deal as any).principal_bopm ?? (deal as any).principalBopm,
        (deal as any).senior_bopm ?? (deal as any).seniorBopm,
      ];
      for (const c of candidates) {
        const v = vsdForPerson(c);
        if (v) return v;
      }
      // Fallback: use the deal's own VSD field (canonicalised) so that deals
      // tagged to a VSD but without a recognised BOPM still roll up to that
      // VSD instead of being lumped into Unassigned.
      const dealVsd = (deal as any).vsd;
      const canon = matchesVsd(dealVsd);
      return canon || null;
    },
    [vsdForPerson],
  );

  const bopmsForVsd = useCallback(
    (vsd: string | null | undefined): string[] => {
      if (!vsd) return [];
      return data.bopmsByVsd.get(vsd) || [];
    },
    [data],
  );

  /** All BOPM display names across all VSDs, sorted A-Z and de-duplicated. */
  const allBopms = useMemo(() => {
    const set = new Set<string>();
    for (const arr of data.bopmsByVsd.values()) arr.forEach((n) => set.add(n));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  return { vsdForPerson, vsdForDeal, bopmsForVsd, allBopms, loading };
}

// ----- BOPM directory (Settings → People as source of truth) -----
// Returns the active Principal/Senior BOPMs registered in Settings → People,
// grouped by their VSD (resolved through the reportingManager chain). Used
// by the BOPM filter on Clients & Deals and Staffing so the dropdown shows
// only real users that report under the selected VSD — not free-text names
// pulled from `staffing_deals` BOPM cells (which can include role labels,
// typos, or people who no longer report under that VSD).

interface BopmDirectoryRow {
  id: string;
  name: string;
  email: string;
  roleTitle: string;
  designation: string;
  reportingManager: string;
  vsd: string | null; // canonical VSD name (one of VSD_NAMES) or null
}

interface BopmDirectoryData {
  rows: BopmDirectoryRow[];
  byVsd: Map<string, BopmDirectoryRow[]>; // canonical VSD name -> rows
}

let bopmDirCache: { data: BopmDirectoryData; ts: number } | null = null;
const bopmDirSubs = new Set<(d: BopmDirectoryData) => void>();
let bopmDirChannel: ReturnType<typeof supabase.channel> | null = null;
let bopmDirBound = false;

function isBopmRoleTitle(roleTitle: string, designation: string): boolean {
  const t = `${roleTitle || ""} ${designation || ""}`.toLowerCase();
  return /\b(principal|senior|sr\.?)\s+bopm\b/.test(t)
    || /principal\s+account\s+engagement\s+lead/.test(t)
    || (t.includes("bopm") && (t.includes("principal") || t.includes("senior") || t.includes("sr")));
}

async function loadBopmDirectory(): Promise<BopmDirectoryData> {
  const { data } = await supabase
    .from("staffing_people")
    .select("id, name, email, role_title, designation, reporting_manager, leaving, tbh")
    .eq("leaving", false)
    .eq("tbh", false);

  const all = (data || []).map((r: any) => ({
    id: r.id as string,
    name: (r.name || "").trim(),
    email: (r.email || "").trim(),
    roleTitle: r.role_title || "",
    designation: r.designation || "",
    reportingManager: (r.reporting_manager || "").trim(),
  }));
  const byNameLower = new Map<string, typeof all[number]>();
  all.forEach((p) => byNameLower.set(p.name.toLowerCase(), p));

  // Walk the reporting chain (max 8 hops) until we find a registered VSD or
  // run out of managers.
  const resolveVsd = (start: typeof all[number]): string | null => {
    let cursor: typeof all[number] | undefined = start;
    const seen = new Set<string>();
    for (let i = 0; i < 8 && cursor; i++) {
      const canon = matchesVsd(cursor.name);
      if (canon) return canon;
      const mgr = (cursor.reportingManager || "").trim().toLowerCase();
      if (!mgr || seen.has(mgr)) break;
      seen.add(mgr);
      cursor = byNameLower.get(mgr);
    }
    return null;
  };

  const rows: BopmDirectoryRow[] = [];
  for (const p of all) {
    if (!isBopmRoleTitle(p.roleTitle, p.designation)) continue;
    const vsd = resolveVsd(p);
    rows.push({ ...p, vsd });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));

  const byVsd = new Map<string, BopmDirectoryRow[]>();
  for (const r of rows) {
    if (!r.vsd) continue;
    let list = byVsd.get(r.vsd);
    if (!list) { list = []; byVsd.set(r.vsd, list); }
    list.push(r);
  }
  return { rows, byVsd };
}

function bindBopmDirRealtime() {
  if (bopmDirBound) return;
  bopmDirBound = true;
  if (bopmDirChannel) {
    supabase.removeChannel(bopmDirChannel);
    bopmDirChannel = null;
  }
  const refresh = async () => {
    const next = await loadBopmDirectory();
    bopmDirCache = { data: next, ts: Date.now() };
    bopmDirSubs.forEach((s) => s(next));
  };
  const ch = supabase.channel(`bopm-directory-sync-${Date.now()}`);
  ch.on("postgres_changes", { event: "*", schema: "public", table: "staffing_people" }, refresh);
  ch.subscribe();
  bopmDirChannel = ch;
}

export function useBopmDirectory() {
  const [data, setData] = useState<BopmDirectoryData>(
    bopmDirCache?.data || { rows: [], byVsd: new Map() },
  );
  const [loading, setLoading] = useState(!bopmDirCache);

  useEffect(() => {
    bindBopmDirRealtime();
    let alive = true;
    const sub = (d: BopmDirectoryData) => alive && setData(d);
    bopmDirSubs.add(sub);
    if (!bopmDirCache || Date.now() - bopmDirCache.ts > 60_000) {
      loadBopmDirectory().then((next) => {
        if (!alive) return;
        bopmDirCache = { data: next, ts: Date.now() };
        setData(next);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
    return () => {
      alive = false;
      bopmDirSubs.delete(sub);
    };
  }, []);

  /** All Principal/Senior BOPM users (from Settings → People), sorted A-Z. */
  const allBopmUsers = useMemo(() => data.rows, [data]);

  /** BOPM users whose reportingManager chain rolls up to the given VSD. */
  const bopmUsersForVsd = useCallback(
    (vsd: string | null | undefined): BopmDirectoryRow[] => {
      if (!vsd) return [];
      return data.byVsd.get(vsd) || [];
    },
    [data],
  );

  return { allBopmUsers, bopmUsersForVsd, loading };
}

/**
 * Hook returning all active person names from Settings → People. Used by
 * `dealMatchesBopm` so the strict matcher can run its ambiguity guard.
 */
export function useAllPersonNames(): string[] {
  const [extra, setExtra] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("staffing_people")
      .select("name")
      .eq("leaving", false)
      .eq("tbh", false)
      .then(({ data }) => {
        if (cancelled) return;
        setExtra(((data as any[]) || []).map((p) => (p.name || "").trim()).filter(Boolean));
      });
    return () => { cancelled = true; };
  }, []);
  return useMemo(() => Array.from(new Set(extra)), [extra]);
}

// ----- Strict person matching for deal BOPM cells -----
// Used by useDealAccess so a BOPM persona only sees deals where the deal's
// BOPM cells unambiguously point to *their* registered Settings person.
// Prevents two issues that have leaked unrelated deals into BOPM views:
//   1. First-name-only matches across people who share a first name.
//   2. Stale staffing_assignments rows that no longer reflect the deal sheet.
/**
 * Strict comparison: deal cell text refers to `personName` if either
 *  - the normalised full name is identical, OR
 *  - the cell is "<first> <last-initial(s)>" where last-initial is a prefix
 *    of the person's last name AND no other registered person shares that
 *    first name + last-initial prefix.
 */
export function dealCellMatchesPerson(
  dealCell: string | null | undefined,
  personName: string | null | undefined,
  allRegisteredNames: string[],
): boolean {
  const a = (dealCell || "")
    .toLowerCase().normalize("NFKD").replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const b = (personName || "")
    .toLowerCase().normalize("NFKD").replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (a.length === 0 || b.length === 0) return false;
  if (a.join(" ") === b.join(" ")) return true;
  if (a[0] !== b[0]) return false;

  // Every remaining token in the cell must be prefix-compatible with some
  // token in the person's name (so "Shreshtha P" → "Shreshtha Pathak").
  for (let i = 1; i < a.length; i++) {
    const t = a[i];
    const ok = b.some((bt) => bt.startsWith(t) || t.startsWith(bt));
    if (!ok) return false;
  }

  // Ambiguity guard: if any OTHER registered person also matches this cell
  // under the same rule, refuse the match — better to drop the deal than
  // leak it into the wrong person's view.
  for (const otherRaw of allRegisteredNames) {
    if (!otherRaw) continue;
    const o = otherRaw.toLowerCase().normalize("NFKD").replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    if (o.length === 0) continue;
    if (o.join(" ") === b.join(" ")) continue; // same person
    if (o[0] !== a[0]) continue;
    let conflicts = true;
    for (let i = 1; i < a.length; i++) {
      const t = a[i];
      if (!o.some((ot) => ot.startsWith(t) || t.startsWith(ot))) { conflicts = false; break; }
    }
    if (conflicts) return false;
  }
  return true;
}
