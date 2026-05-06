## Plan

Three changes scoped to Home, Staffing, and Clients & Deals.

---

### 1) Home — enable Add Task in Kanban + Financial Summary tile

**Add Task in Home Kanban**
- Currently `TaskKanban` on Home is rendered with `disableAdd` and a no-op `onAdd`. Wire it up so clicking the per-column "+ Add" inside the kanban opens the existing `AddTaskDialog` (already used by the "Add Task" header button).
- The dialog will reuse `addTaskDealId` flow so the user picks the deal + fills the form, and the new task is inserted into `deal_tasks` (already two-way synced with the deal's Kanban via existing `handleAddTaskSubmit`).
- Keep "My Deals" filtering as-is — deals shown are already restricted to the logged-in user via alias matching against `vsd / principal_bopm / senior_bopm / bopm` on `staffing_deals` (same source used by Clients & Deals page). No change needed here other than confirming the scoping.

**New "Financial Summary" card on Home (all roles)**
- Add a new card showing four totals across deals visible to the user (Admin: all deals; everyone else: their alias-matched deals — same scope as "My Deals"):
  - Total Contraction (sum of `consumption` across `deal_financials`)
  - Total Delivery (sum of `consumption` — currently used as delivered in `FinancialsTab`)
  - Total Invoicing (sum of `invoiced`)
  - Total Receivables Outstanding (sum of `invoiced - received`)
- Each tile is clickable and opens a drill-down dialog with a table of contributing deals: Account, Deal Name (link → `/deals/:id`), VSD/BOPM, value for that metric. Sortable by value. Reuses existing dialog/table primitives.
- Currency respects `useCurrencyVersion()` + `formatINR` already imported on Home.

---

### 2) Staffing & Capacity — start/end dates with auto-expiry + ghosted historical staffing

**Date inputs**
- `AddStaffingMemberDialog` already collects `startDate` / `endDate` and writes them to `staffing_assignments.start_date / end_date`. Surface and confirm both inputs in the dialog UI (already present at step 3 — verify and improve labels / validation: `endDate >= startDate`).
- Add inline editable Start / End date fields on the existing staffing tables (`BopmStaffingFlatTable`, `DealLevelView`, `PeopleLevelView`) so VSD/BOPM can adjust dates without re-creating the assignment.

**Auto-expiry + "no longer staffed" indicator**
- Add a derived helper `isAssignmentExpired(a)` = `a.end_date && a.end_date < today`.
- Treatment everywhere staffing is rendered (Deal staffing tab, People view, Capacity tab, Home Kanban assignee picker, `WeeklyStaffingGrid`):
  - Expired rows remain visible but are styled with `opacity-60`, lighter font weight, and a subtle "Past" badge so VSD/BOPMs can see who used to be staffed if a deal is later extended.
  - Capacity / utilization calculations exclude expired rows so a person isn't double-counted after their end_date passes.
  - Filters/aggregations (e.g., "currently staffed people on deal X") use only non-expired rows.
- No automatic DB delete — assignments stay in `staffing_assignments` so history is preserved. We hide them from "active" totals and ghost them in UI.

---

### 3) Clients & Deals — Duration column

- Add a new optional column `duration` to the `ALL_COLS` list in `src/pages/Clients.tsx`.
- Computed from `staffing_deals.start_date` and `staffing_deals.end_date`:
  - If both present: human-readable months (e.g. "12 mo", or "13 mo · ends 30 Jun 2026").
  - If only end_date: "ends DD MMM YYYY".
  - If neither: `—`.
- Column is included in default visible set, sortable by length in days, supports the existing per-column filter pattern (text match).

---

### Files to edit

- `src/pages/Home.tsx` — wire kanban `onAdd` to existing AddTaskDialog flow; add Financial Summary card + drill-down dialog; query `deal_financials` filtered to user's deal IDs.
- `src/components/staffing/AddStaffingMemberDialog.tsx` — explicit Start/End date inputs with validation.
- `src/components/staffing/BopmStaffingFlatTable.tsx`, `DealLevelView.tsx`, `PeopleLevelView.tsx`, `WeeklyStaffingGrid.tsx`, `CapacityTab.tsx` — render expired assignments ghosted; exclude from active totals; allow inline editing of start/end dates.
- `src/data/staffingData.ts` — add `isAssignmentExpired` helper; ensure utilization functions accept an "active only" flag.
- `src/pages/Clients.tsx` — add Duration column to ALL_COLS, default visible, header + cell rendering.

No DB schema changes — `start_date` / `end_date` already exist on `staffing_assignments` and `staffing_deals`.
