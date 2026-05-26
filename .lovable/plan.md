## Goal

Replace the People & Reporting (Tree / Org chart / Email mapping) and the Revenue Capacity tabs in **Settings** with a single, inline‑editable table containing exactly the 80 people you listed. Drop the other 180 people and their staffing assignments.

## Final table

One tab in Settings (`People & Reporting`) — Revenue Capacity tab and the Tree / Org / Email sub‑views are removed.


| Column              | Editable                                    | Notes                                                           |
| ------------------- | ------------------------------------------- | --------------------------------------------------------------- |
| Name                | Inline text                                 | &nbsp;                                                          |
| Designation         | Inline text                                 | Stored verbatim (e.g. `Content Lead (2026) / Managing Editor*`) |
| Email               | Inline text                                 | &nbsp;                                                          |
| Reports to          | Inline combobox of other people in the list | Preserves existing `reporting_manager` where present            |
| Rev type (₹/person) | Inline number, INR formatted                | Per‑person revenue target -> Here give option to add in $ or ₹  |


Header row gets a search box and an "Add person" button. Each row gets a delete (trash) action with the existing confirm dialog.

## Data changes

1. **Schema migration** — add `revenue_target_per_person numeric NOT NULL DEFAULT 0` to `staffing_people` (per‑person, replacing the per‑designation `revenue_targets` model for this view).
2. **Data seed/clean** (separate insert step, run after migration approval):
  - Upsert the 80 listed people by name. If a row with the same name already exists, keep its `id`, `email`, `reporting_manager`, and other fields; only set `designation` from the list and clear `leaving`/`tbh`.
  - Hard‑delete every `staffing_people` row not in the 80‑name list. `staffing_assignments.person_id` rows pointing at deleted people are removed (unlinks staffing on those deals — your confirmation).
3. Existing `revenue_targets` table is left in place but no longer surfaced in the UI (kept to avoid breaking other reports).

## UI changes

- `src/pages/Settings.tsx`
  - Remove `Revenue Capacity` from the `tabs` array and delete `RevenueCapacityPanel` along with its drag‑drop helpers and imports (`@dnd-kit/*`, `formatINR`, `GripVertical`, `peopleByGroup`, `draggingPerson`, `handleDragStart/End`).
  - Remove the Tree / Org chart / Email mapping switcher and the `PeopleTreeView`, `OrgChartView`, `EmailMappingTable` imports/usages.
  - Render the new unified table directly in the `People & Reporting` tab.
- New component `src/components/settings/PeopleReportingTable.tsx`
  - 5 inline‑editable columns above, sticky header, search, Add Person, delete confirm.
  - Uses existing `useStaffingMutations.updatePerson` / `addPerson` / `deletePerson`.
  - `revenueTargetPerPerson` wired through a new mutation helper.
- Delete now‑unused files: `PeopleTreeView.tsx`, `OrgChartView.tsx`, `EmailMappingTable.tsx`, `RevenueCapacityTab.tsx` (and any other components only referenced by them).

## Out of scope

- Other Staffing pages (Deal view, People view, Capacity, BW rules, Hiring) keep using `staffing_people` as‑is; they'll simply show fewer people.
- Existing per‑designation `revenue_targets` data and any dashboards reading it stay untouched.

Proceed?