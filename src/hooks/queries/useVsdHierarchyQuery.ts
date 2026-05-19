/**
 * Derived hierarchy: VSD → BOPMs map, computed from `staffing_deals`.
 * Moved verbatim from the legacy `useAppUsers` shim.
 */
import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { useTableSubscription, invalidatePatcher } from "@/lib/realtime";
import { nameKey } from "@/hooks/queries/useAppUsersQuery";
import { VSD_NAMES } from "@/hooks/queries/useVsdUsersQuery";

const VSD_KEYS = new Set(VSD_NAMES.map((n) => nameKey(n)));
const VSD_PARTIALS = VSD_NAMES.map((n) => nameKey(n).split(" "));

function matchesVsd(name: string | null | undefined): string | null {
  const k = nameKey(name || "");
  if (!k) return null;
  if (VSD_KEYS.has(k)) return VSD_NAMES.find((n) => nameKey(n) === k) || null;
  const tokens = k.split(" ");
  for (let i = 0; i < VSD_PARTIALS.length; i++) {
    const canon = VSD_PARTIALS[i];
    const allIn = tokens.every((t) => canon.includes(t));
    const firstMatch = tokens.length === 1 && canon[0] === tokens[0];
    if (allIn || firstMatch) return VSD_NAMES[i];
  }
  return null;
}

interface HierarchyData {
  map: Map<string, string>;
  bopmsByVsd: Map<string, string[]>;
}

async function loadHierarchy(): Promise<HierarchyData> {
  const { data } = await supabase
    .from("staffing_deals")
    .select("vsd, principal_bopm, senior_bopm");

  const tally = new Map<string, Map<string, number>>();
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
    if (!v) return;
    bump(d.principal_bopm, v);
    bump(d.senior_bopm, v);
  });

  const personToVsd = new Map<string, string>();
  const bopmsByVsd = new Map<string, Set<string>>();
  for (const [personKey, vsdCounts] of tally.entries()) {
    let bestVsd = "";
    let bestN = -1;
    for (const [v, n] of vsdCounts.entries()) {
      if (n > bestN) {
        bestN = n;
        bestVsd = v;
      }
    }
    if (bestVsd) {
      personToVsd.set(personKey, bestVsd);
      const display = displayByKey.get(personKey);
      if (display && nameKey(display) !== nameKey(bestVsd)) {
        let set = bopmsByVsd.get(bestVsd);
        if (!set) {
          set = new Set();
          bopmsByVsd.set(bestVsd, set);
        }
        set.add(display);
      }
    }
  }
  VSD_NAMES.forEach((v) => personToVsd.set(nameKey(v), v));

  const bopmsSorted = new Map<string, string[]>();
  for (const [v, set] of bopmsByVsd.entries()) {
    bopmsSorted.set(v, Array.from(set).sort((a, b) => a.localeCompare(b)));
  }
  return { map: personToVsd, bopmsByVsd: bopmsSorted };
}

export function useVsdHierarchy() {
  const key = qk.vsdHierarchy();
  const query = useQuery({
    queryKey: key,
    queryFn: loadHierarchy,
    staleTime: 60_000,
  });
  const inv = useMemo(() => invalidatePatcher(key), [key]);
  useTableSubscription({ table: "staffing_deals", patcher: inv });

  const data = query.data ?? { map: new Map<string, string>(), bopmsByVsd: new Map<string, string[]>() };

  const vsdForPerson = useCallback(
    (name: string | null | undefined): string | null => {
      const k = nameKey(name || "");
      if (!k) return null;
      return data.map.get(k) || null;
    },
    [data],
  );

  const vsdForDeal = useCallback(
    (deal: {
      principal_bopm?: string | null;
      senior_bopm?: string | null;
      bopm?: string | null;
      principalBopm?: string | null;
      seniorBopm?: string | null;
      vsd?: string | null;
    }): string | null => {
      const candidates = [
        (deal as any).principal_bopm ?? (deal as any).principalBopm,
        (deal as any).senior_bopm ?? (deal as any).seniorBopm,
      ];
      for (const c of candidates) {
        const v = vsdForPerson(c);
        if (v) return v;
      }
      const dealVsd = (deal as any).vsd;
      return matchesVsd(dealVsd) || null;
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

  const allBopms = useMemo(() => {
    const set = new Set<string>();
    for (const arr of data.bopmsByVsd.values()) arr.forEach((n) => set.add(n));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  return { vsdForPerson, vsdForDeal, bopmsForVsd, allBopms, loading: query.isLoading };
}

// ─── All registered person names (for dealCellMatchesPerson) ────────────────

async function fetchAllPersonNames(): Promise<string[]> {
  const { data } = await supabase
    .from("staffing_people")
    .select("name")
    .eq("leaving", false)
    .eq("tbh", false);
  return Array.from(
    new Set(((data as any[]) || []).map((p) => (p.name || "").trim()).filter(Boolean)),
  );
}

export function useAllPersonNames(): string[] {
  const key = ["all-person-names"] as const;
  const query = useQuery({
    queryKey: key,
    queryFn: fetchAllPersonNames,
    staleTime: 60_000,
  });
  const inv = useMemo(() => invalidatePatcher(key), []);
  useTableSubscription({ table: "staffing_people", patcher: inv });
  return query.data ?? [];
}

// ─── Strict person matching for deal BOPM cells ─────────────────────────────
export function dealCellMatchesPerson(
  dealCell: string | null | undefined,
  personName: string | null | undefined,
  allRegisteredNames: string[],
): boolean {
  const a = (dealCell || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const b = (personName || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (a.length === 0 || b.length === 0) return false;
  if (a.join(" ") === b.join(" ")) return true;
  if (a[0] !== b[0]) return false;
  for (let i = 1; i < a.length; i++) {
    const t = a[i];
    const ok = b.some((bt) => bt.startsWith(t) || t.startsWith(bt));
    if (!ok) return false;
  }
  for (const otherRaw of allRegisteredNames) {
    if (!otherRaw) continue;
    const o = otherRaw
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z\s]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);
    if (o.length === 0) continue;
    if (o.join(" ") === b.join(" ")) continue;
    if (o[0] !== a[0]) continue;
    let conflicts = true;
    for (let i = 1; i < a.length; i++) {
      const t = a[i];
      if (!o.some((ot) => ot.startsWith(t) || t.startsWith(ot))) {
        conflicts = false;
        break;
      }
    }
    if (conflicts) return false;
  }
  return true;
}