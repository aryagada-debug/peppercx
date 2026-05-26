/**
 * Pure helpers that segment the people roster by the new Department → Role Type
 * taxonomy. Always falls back to legacy fields (`roleCategory`, `roleTitle`)
 * when a person hasn't been remapped yet, so the UI never drops anyone.
 */
import type { Person } from "@/data/staffingData";
import { ROLE_SLOTS, ROLE_TYPE_TO_DEPT } from "@/data/staffingData";
import type { Department, RoleType, Taxonomy } from "@/hooks/queries/useTaxonomyQuery";

/** Resolve a person's role type id using new field first, then legacy match. */
export function resolvePersonRoleTypeId(p: Person, taxonomy?: Taxonomy): string | null {
  if (p.roleTypeId) return p.roleTypeId;
  const title = (p.roleTitle || "").toLowerCase().trim();
  const cat = p.roleCategory;
  const roles = taxonomy?.roleTypes ?? ROLE_SLOTS.map(s => ({
    id: s.roleKey, name: s.roleLabel, departmentId: ROLE_TYPE_TO_DEPT[s.roleKey] || "", sortOrder: 0,
  }));
  // Title exact label match.
  const byTitle = roles.find(r => r.name.toLowerCase() === title);
  if (byTitle) return byTitle.id;
  // Fuzzy contains.
  const fuzzy = roles.find(r => title && title.includes(r.name.toLowerCase()));
  if (fuzzy) return fuzzy.id;
  // Fall back to category → first role in category.
  const slot = ROLE_SLOTS.find(s => s.category === cat);
  return slot?.roleKey ?? null;
}

export function resolvePersonDepartmentId(p: Person, taxonomy?: Taxonomy): string | null {
  if (p.departmentId) return p.departmentId;
  const rt = resolvePersonRoleTypeId(p, taxonomy);
  return rt ? (ROLE_TYPE_TO_DEPT[rt] || null) : null;
}

export interface RoleTypeGroup {
  roleType: RoleType;
  people: Person[];
}
export interface DepartmentGroup {
  department: Department;
  total: number;
  roleTypes: RoleTypeGroup[];
}

/** Group people by Department → Role Type using the taxonomy order. */
export function groupPeopleByDeptRole(
  people: Person[],
  taxonomy: Taxonomy,
): DepartmentGroup[] {
  const buckets = new Map<string, Map<string, Person[]>>();
  const unassignedDept = "__unassigned__";
  const unassignedRole = "__unassigned__";

  for (const p of people) {
    const rtId = resolvePersonRoleTypeId(p, taxonomy);
    const dId = (rtId && taxonomy.roleTypeById.get(rtId)?.departmentId) || unassignedDept;
    const rKey = rtId || unassignedRole;
    if (!buckets.has(dId)) buckets.set(dId, new Map());
    const m = buckets.get(dId)!;
    if (!m.has(rKey)) m.set(rKey, []);
    m.get(rKey)!.push(p);
  }

  const result: DepartmentGroup[] = [];
  for (const dept of taxonomy.departments) {
    const m = buckets.get(dept.id);
    if (!m) continue;
    const roleTypes = (taxonomy.roleTypesByDept.get(dept.id) || [])
      .filter(rt => m.has(rt.id))
      .map(rt => ({ roleType: rt, people: m.get(rt.id)!.sort(byName) }));
    const total = roleTypes.reduce((n, g) => n + g.people.length, 0);
    if (total > 0) result.push({ department: dept, total, roleTypes });
  }
  const stray = buckets.get(unassignedDept);
  if (stray) {
    const list = Array.from(stray.values()).flat().sort(byName);
    if (list.length) {
      result.push({
        department: { id: unassignedDept, name: "Unassigned", sortOrder: 999 },
        total: list.length,
        roleTypes: [{
          roleType: { id: unassignedRole, departmentId: unassignedDept, name: "No role type set", sortOrder: 0 },
          people: list,
        }],
      });
    }
  }
  return result;
}

function byName(a: Person, b: Person) { return a.name.localeCompare(b.name); }

/** Count active (non-TBH, non-leaving) people available for a role type. */
export function countAvailableForRole(people: Person[], roleTypeId: string, taxonomy?: Taxonomy): number {
  return people.filter(p =>
    !p.tbh && !p.leaving && resolvePersonRoleTypeId(p, taxonomy) === roleTypeId
  ).length;
}

export function countAvailableForDept(people: Person[], deptId: string, taxonomy?: Taxonomy): number {
  return people.filter(p =>
    !p.tbh && !p.leaving && resolvePersonDepartmentId(p, taxonomy) === deptId
  ).length;
}

export function peopleForRoleType(people: Person[], roleTypeId: string, taxonomy?: Taxonomy): Person[] {
  return people.filter(p => resolvePersonRoleTypeId(p, taxonomy) === roleTypeId);
}