/**
 * Fetches the staffing taxonomy (departments + role types) from the database.
 * Falls back to the static taxonomy in `staffingData.ts` if the query fails,
 * so the UI stays usable offline.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { ROLE_SLOTS, ROLE_TYPE_TO_DEPT, DEPARTMENT_LABELS } from "@/data/staffingData";

export interface Department {
  id: string;
  name: string;
  sortOrder: number;
}

export interface RoleType {
  id: string;
  departmentId: string;
  name: string;
  sortOrder: number;
}

export interface Taxonomy {
  departments: Department[];
  roleTypes: RoleType[];
  roleTypesByDept: Map<string, RoleType[]>;
  roleTypeById: Map<string, RoleType>;
  departmentById: Map<string, Department>;
}

function buildTaxonomy(deps: Department[], roles: RoleType[]): Taxonomy {
  const roleTypesByDept = new Map<string, RoleType[]>();
  for (const r of roles) {
    const arr = roleTypesByDept.get(r.departmentId) || [];
    arr.push(r);
    roleTypesByDept.set(r.departmentId, arr);
  }
  return {
    departments: deps,
    roleTypes: roles,
    roleTypesByDept,
    roleTypeById: new Map(roles.map((r) => [r.id, r])),
    departmentById: new Map(deps.map((d) => [d.id, d])),
  };
}

function fallback(): Taxonomy {
  // Derive from static data
  const deptIds = Array.from(new Set(Object.values(ROLE_TYPE_TO_DEPT)));
  const deps: Department[] = deptIds.map((id, i) => ({
    id,
    name: DEPARTMENT_LABELS[id] || id,
    sortOrder: i * 10,
  }));
  const roles: RoleType[] = ROLE_SLOTS.map((s, i) => ({
    id: s.roleKey,
    departmentId: ROLE_TYPE_TO_DEPT[s.roleKey] || "",
    name: s.roleLabel,
    sortOrder: i * 10,
  }));
  return buildTaxonomy(deps, roles);
}

async function fetchTaxonomy(): Promise<Taxonomy> {
  const [dr, rr] = await Promise.all([
    supabase.from("staffing_departments").select("*").order("sort_order"),
    supabase.from("staffing_role_types").select("*").order("sort_order"),
  ]);
  if (dr.error || rr.error) return fallback();
  const deps = (dr.data || []).map((d: any) => ({
    id: d.id,
    name: d.name,
    sortOrder: d.sort_order ?? 0,
  }));
  const roles = (rr.data || []).map((r: any) => ({
    id: r.id,
    departmentId: r.department_id,
    name: r.name,
    sortOrder: r.sort_order ?? 0,
  }));
  if (!deps.length || !roles.length) return fallback();
  return buildTaxonomy(deps, roles);
}

export function useTaxonomyQuery() {
  return useQuery({
    queryKey: qk.taxonomy(),
    queryFn: fetchTaxonomy,
    staleTime: 10 * 60 * 1000, // taxonomy rarely changes
    placeholderData: fallback,
  });
}