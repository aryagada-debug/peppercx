import type { ApplicabilityRow } from "@/hooks/queries/useDealApplicabilityQuery";

/**
 * Resolve whether a (deal, department, roleType) combination is applicable.
 * Default: applicable. Per-role override wins; otherwise dept toggle.
 */
export function isRoleApplicable(
  dealId: string,
  departmentId: string,
  roleTypeId: string,
  rows: ApplicabilityRow[] | undefined,
): boolean {
  if (!rows || rows.length === 0) return true;
  let deptApplicable = true;
  for (const r of rows) {
    if (r.dealId !== dealId) continue;
    if (r.roleTypeId === roleTypeId) return r.isApplicable;
    if (r.roleTypeId == null && r.departmentId === departmentId) {
      deptApplicable = r.isApplicable;
    }
  }
  return deptApplicable;
}

/**
 * Build a per-deal lookup: dealId -> { dept: Map<deptId,boolean>, role: Map<roleTypeId,boolean> }
 * useful when iterating many cells.
 */
export function buildApplicabilityIndex(rows: ApplicabilityRow[] | undefined) {
  const byDeal = new Map<
    string,
    { dept: Map<string, boolean>; role: Map<string, boolean> }
  >();
  if (!rows) return byDeal;
  for (const r of rows) {
    const slot =
      byDeal.get(r.dealId) || { dept: new Map<string, boolean>(), role: new Map<string, boolean>() };
    if (r.roleTypeId == null) slot.dept.set(r.departmentId, r.isApplicable);
    else slot.role.set(r.roleTypeId, r.isApplicable);
    byDeal.set(r.dealId, slot);
  }
  return byDeal;
}

export type ApplicabilityIndex = ReturnType<typeof buildApplicabilityIndex>;

export function isApplicableFromIndex(
  idx: ApplicabilityIndex,
  dealId: string,
  departmentId: string,
  roleTypeId: string,
): boolean {
  const slot = idx.get(dealId);
  if (!slot) return true;
  if (slot.role.has(roleTypeId)) return !!slot.role.get(roleTypeId);
  if (slot.dept.has(departmentId)) return !!slot.dept.get(departmentId);
  return true;
}