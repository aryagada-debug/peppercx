
# Goal

Make the new **Department → Role Type** taxonomy the single source of truth for **People Ops**, **Staffing & Capacity**, and **Deal Staffing** (inside Clients & Deals). All three surfaces use the same data model, the same group/segment framework, and the same add-staffing flow.

Reference framework: the **Content Capability App** treats People and Capacity as two pivots over one roster — every person has a role, and every account/deal pulls from that same roster via a single dialog. We mirror that idea here, but with **Department (7) → Role Type (23)** as the grouping spine instead of a flat role list.

---

# 1. Single Add-Staffing flow (used everywhere)

Today there are two entry points (`AddStaffingMemberDialog` from Deal Staffing, and the people picker inside `BopmStaffingFlatTable`'s Staffing & Capacity table). We consolidate to **one shared dialog** mounted from both surfaces.

New flow inside `AddStaffingMemberDialog`:

```text
Step 1: Select Department          (7 cards: Operations, SEO, Content,
                                    Content Strategy, Creative Strategy,
                                    Creative Art, Creative Copy, Video,
                                    Performance & Growth — driven by
                                    staffing_departments)
Step 2: Select Role Type           (cards filtered to dept; driven by
                                    staffing_role_types)
Step 3: Select Member              (people filtered to role_type_id;
                                    with utilization + current deals,
                                    same UI as today)
Step 4: Set Allocation             (unchanged)
```

Search box on every step searches the full roster (department, role type, name, pod, region, email).

The screenshot's "Select Team" grid is replaced by a Department grid populated from `staffing_departments` (sorted by `sort_order`); selecting a card advances to a Role Type grid populated from `staffing_role_types` for that dept. "0 available" counts come from the live `people` array filtered by `departmentId` / `roleTypeId`.

---

# 2. People Ops rebuild

`PeopleReportingTable` is restructured to use the same Department → Role Type spine.

- Top-level groups: **Department** (with count + total FTE + avg utilization).
- Nested groups inside each dept: **Role Type** (with count + avg utilization).
- Inside each role type: existing person rows (inline-edit fields, deals, utilization).
- Header chips: All Departments / All Role Types / Active / TBH / Leaving filters.
- "Add Person" dialog (`AddPersonDialog`) gets **Department first, Role Type filtered to that dept** — writes `department_id` + `role_type_id`. Legacy `role_category`/`role_title` columns are kept in sync for back-compat reads only.

This matches the Content Capability App framework: one roster, segmented by the official taxonomy, with capacity rolled up at every level.

---

# 3. Staffing & Capacity views

`BopmStaffingFlatTable` (already partially migrated):

- Column groups in the header become **Department → Role Type** (matches People Ops and the new dialog).
- People dropdown in each cell uses the shared `AddStaffingMemberDialog` (4-step Dept → Role Type → Person → Allocation), instead of the inline people list.
- "Add Staffing Member" button opens the same shared dialog with no pre-selection.

Other tabs (`DealViewTab`, `LockAnalyticsTab`) keep their current visualization but re-label "Capability" → "Department" and break out a sub-row for "Role Type" where they used to show flat role keys.

---

# 4. Deal Staffing inside Clients & Deals

`DealDetail` → Staffing tab:

- "Team Members" section gets the same Department → Role Type grouping rendered above the existing per-role staffing cards.
- "Add Staffing" button opens the shared `AddStaffingMemberDialog` (so the screenshot's broken "Select Team" modal is automatically fixed — it now reads from `staffing_departments` and shows real counts).
- Request Staffing (non-admin) flow uses the same Dept → Role Type picker so requests carry `department_id` + `role_type_id`.
- The Staffing lock (admin-only) behaviour is unchanged.

---

# 5. Shared building blocks (new)

- `src/components/staffing/DepartmentRoleTypePicker.tsx` — 2-step cards (Dept → Role Type) used by `AddStaffingMemberDialog`, `AddPersonDialog`, and `RequestStaffingDialog`.
- `src/lib/peopleGrouping.ts` — pure helpers: `groupPeopleByDeptRole(people, taxonomy)`, `countByDept`, `countByRoleType`, `peopleForRoleType(id)`.
- Extends `useTaxonomyQuery` consumers; no new hooks required (taxonomy + applicability already exist).

---

# 6. Files touched

**New**
- `src/components/staffing/DepartmentRoleTypePicker.tsx`
- `src/lib/peopleGrouping.ts`

**Edited**
- `src/components/staffing/AddStaffingMemberDialog.tsx` — replace step 1/2 with the new picker; keep step 3/4 logic.
- `src/components/staffing/BopmStaffingFlatTable.tsx` — re-group columns by Dept → Role Type; route "add" through the shared dialog.
- `src/components/staffing/DealViewTab.tsx`, `LockAnalyticsTab.tsx` — re-label and re-group by Department.
- `src/components/settings/PeopleReportingTable.tsx` — Department → Role Type grouping, counts, utilization rollups.
- `src/components/settings/AddPersonDialog.tsx` — Dept → Role Type cascading select; persist `department_id` + `role_type_id`.
- `src/components/staffing/RequestStaffingDialog.tsx` — Dept → Role Type picker.
- `src/pages/DealDetail.tsx` — Staffing tab consumes the shared dialog; group "Team Members" by Department.

**Unchanged**
- DB schema (already in place from earlier migrations).
- Applicability popover, lock RPC, mutations, query keys.

---

# 7. Out of scope

- New per-department locks (single deal-level lock stays).
- Dashboard/Financials/MBR re-skin.
- CSV re-import of roster (already wiped & seeded).
- Realtime channel changes.

---

# Technical notes

- Taxonomy comes from `useTaxonomyQuery` (already has static fallback) — both `departments[]` and `roleTypesByDept` are ready.
- People filtering uses `person.departmentId` / `person.roleTypeId` (already on the `Person` interface) and falls back to the legacy `roleCategory` → dept alias map in `staffingData.ts` for any record not yet remapped.
- Counts use `peopleForRoleType(id).filter(p => !p.tbh && !p.leaving).length` so "0 available" reflects real bench, not raw rows.
- All writes go through existing mutations (`addPerson`, `updatePerson`, `addAssignment`) — they already accept `department_id` / `role_type_id` after the Phase 1 migration.
- No design-token changes; reuse current flat-UI palette and the two-weight typography rule.
