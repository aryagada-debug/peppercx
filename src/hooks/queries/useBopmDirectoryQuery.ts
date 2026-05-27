/**
 * React Query replacement for `useBopmDirectory`. Same shape:
 * `{ allBopmUsers, bopmUsersForVsd, loading }`.
 */
import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { useTableSubscription, invalidatePatcher } from "@/lib/realtime";
import { VSD_NAMES } from "./useVsdUsersQuery";
import { nameKey } from "./useAppUsersQuery";

export interface BopmDirectoryRow {
  id: string;
  name: string;
  email: string;
  roleTitle: string;
  designation: string;
  reportingManager: string;
  vsd: string | null;
}

interface BopmDirectoryData {
  rows: BopmDirectoryRow[];
  byVsd: Map<string, BopmDirectoryRow[]>;
}

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

function isBopmRoleTitle(roleTitle: string, designation: string): boolean {
  const t = `${roleTitle || ""} ${designation || ""}`.toLowerCase();
  return (
    /\b(principal|senior|sr\.?)\s+bopm\b/.test(t) ||
    /\bgroup\s+bopm\b/.test(t) ||
    /principal\s+account\s+engagement\s+lead/.test(t) ||
    (t.includes("bopm") && (t.includes("principal") || t.includes("senior") || t.includes("sr")))
  );
}

async function fetchBopmDirectory(): Promise<BopmDirectoryData> {
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
    rows.push({ ...p, vsd: resolveVsd(p) });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));

  const byVsd = new Map<string, BopmDirectoryRow[]>();
  for (const r of rows) {
    if (!r.vsd) continue;
    let list = byVsd.get(r.vsd);
    if (!list) {
      list = [];
      byVsd.set(r.vsd, list);
    }
    list.push(r);
  }
  return { rows, byVsd };
}

export function useBopmDirectoryQuery() {
  const key = qk.bopmDirectory();
  const query = useQuery({
    queryKey: key,
    queryFn: fetchBopmDirectory,
    staleTime: 60_000,
  });
  const inv = useMemo(() => invalidatePatcher(key), [key]);
  useTableSubscription({ table: "staffing_people", patcher: inv });

  const data = query.data ?? { rows: [], byVsd: new Map<string, BopmDirectoryRow[]>() };
  const allBopmUsers = data.rows;
  const bopmUsersForVsd = useCallback(
    (vsd: string | null | undefined): BopmDirectoryRow[] =>
      vsd ? data.byVsd.get(vsd) || [] : [],
    [data],
  );

  return { allBopmUsers, bopmUsersForVsd, loading: query.isLoading };
}