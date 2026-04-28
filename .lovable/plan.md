## BOPM persona — table-only, own-deals-only views

Goal: when the effective role is BOPM (`user`, or admin viewing-as `user`), every operational page collapses to a deal-scoped table; insight/health-board / VSD-cross-cut surfaces hide.

The scoping primitive already exists: `useDealAccess()` returns `visibleDealIds` / `editableDealIds` based on the logged-in user's `profiles.staffing_person_id` matching `principal_bopm | senior_bopm | bopm` on `staffing_deals` (plus `staffing_assignments`). We will reuse it everywhere instead of inventing new logic.

### 1. RGY Health (`src/pages/RGYHealth.tsx`)

- Read `role` from `useUserRole()` and `visibleDealIds` from `useDealAccess()`.
- When `role === "user"`:
  - Filter the master deal list to `visibleDealIds` before any KPI/aggregate is computed (so KPI tiles, worst-RGY rollups, and the table all reflect only her deals).
  - Hide the **Insights** tab trigger and the heatmap/VSD drill section. The page becomes a single "Deals" table view.
  - Hide the global VSD filter chips and the new BOPM filter (her view is already pre-filtered to herself).
  - Keep the search box, status pill filters, and inline RGY editing (gated by `editableDealIds` — peer-VSD deals stay read-only).

### 2. MBR Tracker (`src/pages/MBRTracker.tsx`)

- Same hook pair. When `role === "user"`:
  - Pre-filter `deals` and `entries` to `visibleDealIds`.
  - Force `viewMode = "current"` and hide the Current / Month-on-Month / **Trend** segmented control (BOPM only sees the table). MoM and Trend remain available to admin/VSD.
  - Hide the "VSD/BOPM Insights" KPI strip and the VSD filter chip row; keep search, status filters, schedule/upload actions on her own deals.
  - Keep `Bell`/reminder buttons but only on her rows.

### 3. Staffing & Capacity (`src/pages/Staffing.tsx`)

- When `role === "user"`:
  - Hide the **Deal view** tab. The tab list becomes `People view` and `Staffing` only; default tab becomes `people`.
  - Pass `visibleDealIds` (or pre-filtered `deals` + `assignments`) into `PeopleViewTab` and `MatrixTab` so:
    - **People view** only shows assignments tied to her deals (and people on those deals).
    - **Staffing matrix** only lists her deals as rows.
  - Page subtitle counts ("N deals • M people") reflect the filtered scope.
- Implementation: filter `deals` to `visibleDealIds` and `assignments` to `assignments.filter(a => visibleDealIds.has(a.dealId))` before passing down. No prop-shape changes to the child tabs.

### 4. Access Controls table (`src/pages/admin/AccessControlsTab.tsx`)

The user wants the Access Controls grid to reflect what the BOPM persona actually gets in the new world. Update the BOPM (`user`) defaults in `DEFAULT_SUMMARY` and the option lists so the grid mirrors the runtime behaviour:

- `clients` → view: `["Own deals only", "Financial summary"]`, edit: `["Edit own deals"]`
- `rgy-health` → view: `["Own deals RGY", "Issue history"]`, edit: `["Mark RGY (own deals)", "Log issues & action plans"]` — **add a new view option** `"Table view only (no insights)"` and pre-select it for BOPM.
- `mbr-tracker` → view: `["Own deals MBRs", "Notes & transcripts"]`, edit: `["Schedule MBRs", "Upload notes", "Mark done"]` — add view option `"Table view only (no MoM / Trend)"` and pre-select it for BOPM.
- `staffing` → view: `["Own deals staffing", "Own allocations only"]`, edit: `["Assign people (own deals)", "Edit allocations"]` — add view option `"People & Matrix only (no Deal view)"` and pre-select it for BOPM.
- `dashboard` → leave hidden by default for BOPM (already the case).

These edits are persisted by writing the new defaults via the existing `route_access_summaries` table on first load if no row exists for `(user, route)` — handled by the existing `getSelected` fallback, so we only have to update the in-file constants.

### 5. Role detection & QA

- "BOPM" = `useUserRole().role === "user"` (this matches the `BOPMs/Creative` persona button; admins can preview by clicking the BOPM pill in the header switcher).
- Determining "her deals": rely on `useDealAccess` which already covers `principal_bopm` / `senior_bopm` / `bopm` name-match plus `staffing_assignments`. No DB changes.
- Empty state: if `visibleDealIds.size === 0` for a BOPM, each page renders a friendly empty card ("No deals are tagged to you yet — ask an admin to map your profile in Users & Roles").

### Files to edit

- `src/pages/RGYHealth.tsx`
- `src/pages/MBRTracker.tsx`
- `src/pages/Staffing.tsx`
- `src/pages/admin/AccessControlsTab.tsx`

No DB migrations and no new hooks needed.
