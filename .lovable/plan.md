
# Continue Staffing Rewrite — Phase 2 (UI Integration)

Phase 1 (DB taxonomy, seeding, mappers) is done. This phase wires the new 7 Departments × 23 Role Types taxonomy into every UI surface and adds the per-deal applicability control.

## Scope

### 1. Taxonomy hooks
- New `src/hooks/queries/useTaxonomyQuery.ts` — fetches `staffing_departments` + `staffing_role_types` (cached, rarely changes).
- New `src/hooks/queries/useDealApplicabilityQuery.ts` — fetches `deal_applicability` rows (dept toggles + per-role overrides) for one or all deals.
- New `src/hooks/queries/useDealApplicabilityMutations.ts` — `toggleDepartment(dealId, deptId, applicable)` and `toggleRoleType(dealId, roleTypeId, applicable)`. Admins only.

### 2. Applicability resolver
- New helper `src/lib/applicability.ts` exposing `isRoleApplicable(dealId, roleTypeId, deptId, applicabilityRows)`:
  - Per-role override wins if present.
  - Else department toggle (default `true`).
- Default: every dept + role is applicable until explicitly turned off.

### 3. Applicability popover (admin only)
- New `src/components/staffing/DealApplicabilityPopover.tsx` — gear icon per deal row.
  - 7 collapsible dept sections, each with a master toggle and nested role-type checkboxes.
  - "Reset to defaults" clears all overrides for the deal.
  - Optimistic updates via mutation hook.

### 4. `BopmStaffingFlatTable` rewrite
- Columns generated from `staffing_role_types` ordered by `(department.sort_order, role_type.sort_order)`.
- For each deal row, hide cells where `isRoleApplicable === false` (render as muted "—").
- People dropdown filters by `role_type_id` (and dept) via the rebuilt `ROLE_TO_PEOPLE_FILTER`.
- Add gear icon column triggering `DealApplicabilityPopover`.
- Keep sticky first column, lock chip, BU defaults.

### 5. Other Staffing tabs
- `DealStaffingView`, `PeopleStaffingView`, `StaffingMatrix`, `CapacityView`, `HiringTab`, `LockAnalyticsTab` — swap any `role_key`/`role_category` references to `role_type_id`/`department_id`. Group/filter UIs regenerate from taxonomy hook. `LockAnalyticsTab` "Capability" breakdown becomes "Department".

### 6. BW Rules tab
- `BWRulesTab` — switch role picker to a Department → Role Type cascading select. Existing rows whose `role_type_id` is null show a warning chip "needs remap". Save uses `role_type_id`.

### 7. People Ops
- `PeopleOps` page — top-level groups become `staffing_departments`, nested groups become `staffing_role_types`. Counts and tree from the new joins.
- `AddPersonDialog` / Edit person — Department select first; Role Type select filtered to that dept. Save writes `department_id` + `role_type_id` (plus legacy `role_category`/`role_title` strings kept in sync for back-compat reads).

### 8. Cleanup
- Remove dead references to old role keys in `src/data/staffingData.ts` that are no longer used after the new components consume the hook (keep `normalizeRoleKey` alias map for legacy reads only).

## Out of scope (this phase)
- Per-department locks (single deal-level lock stays).
- CSV re-import UI.
- Dashboard / Deal Detail / Financials / MBR changes beyond consuming new IDs where role labels render.

## Risks
- Deals previously staffed under old role keys are gone (wiped in Phase 1). Tables will display empty cells until BOPMs refill.
- BW Rules with `role_type_id IS NULL` need manual remap — surfaced with a warning chip, not auto-deleted.
- Anyone in the old DB roster not in the master sheet is no longer assignable.

## Deliverables (file list)
- New: `useTaxonomyQuery.ts`, `useDealApplicabilityQuery.ts`, `useDealApplicabilityMutations.ts`, `applicability.ts`, `DealApplicabilityPopover.tsx`
- Edited: `BopmStaffingFlatTable.tsx`, `DealStaffingView.tsx`, `PeopleStaffingView.tsx`, `StaffingMatrix.tsx`, `CapacityView.tsx`, `HiringTab.tsx`, `LockAnalyticsTab.tsx`, `BWRulesTab.tsx`, `PeopleOps.tsx`, `AddPersonDialog.tsx`, `useStaffingMutations.ts`, `staffingData.ts`

Approve to proceed with implementation.
