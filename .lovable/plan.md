## Goals

Three independent improvements:

1. **BOPM staffing pivot** — make the inline "change person" dropdown look intentional instead of a bare native `<select>`.
2. **Clients & Deals KPI strip** — replace the *Total Deals* tile with *Renewals < 60 days*, and add a one-line insight under each KPI value (mirroring the screenshot reference).
3. **Staffing & Capacity page** — hard-delete the "Grouped view", make the "Table view" the single staffing surface for **all** personas (BOPM, VSD, Admin), and remove the "Staffing — pivot view" header + subtitle inside the table component.

---

## 1. Better dropdown UI in BOPM staffing pivot

File: `src/components/staffing/BopmStaffingFlatTable.tsx` → `renderEntry`.

Currently the person name is rendered as plain text with a transparent `<select>` overlaid. Replace it with a styled `Popover` + scrollable command-list trigger:

- Keep the name as the visible label, but wrap it in a `<button>` with a tiny chevron-down icon on the right that appears on hover. On hover the row also gets a subtle ring (`ring-1 ring-border/60 hover:ring-primary/40`) so it reads as clickable.
- On click, open a small popover (use existing `Popover` from `@/components/ui/popover`) containing:
  - a scrollable list (max-h ~240px) of the already-filtered `colMatches` (designation + manager-scoped — keep the existing logic untouched),
  - each row shows `name`, role title in muted text, and a small "(TBH)" pill if applicable; current selection has a check icon.
- Keep all staging logic identical (`stageUpdate(deal.id, e.assignmentId, { personId: val })`).
- Remove the hidden `<select>` element.
- Apply the same styled picker to the "+ Add person to a deal…" header dropdown so both controls feel consistent.

This is a presentation-only refactor; existing filtering (designation + senior-manager scoping) is preserved.

---

## 2. Clients & Deals KPI strip

File: `src/pages/Clients.tsx` (around lines 336–345 and 551–583).

**Replace tile**: Drop "Total Deals". Add **Renewals < 60 days** — count of active deals where `endDate` is within the next 60 days (use `endDate` from the deal model; ignore deals with no end date).

**New KPI list (5 tiles)**:

1. Clients
2. Active Deals
3. Renewals < 60d
4. Total MRR
5. Total Value

**Insight line under each value** (small muted text, ~11px):


| KPI            | Insight                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Clients        | `N new this quarter` (deals with `startDate` in current quarter, distinct accounts)                     |
| Renewals < 60d | next renewal account + days, e.g. `Acceldata in 18d`                                                    |
| Active Deals   | `M at risk` (count of active deals with `rag === "red"`)                                                |
| Total MRR      | `↑ X% vs last month` if month-over-month series exists, else `K accounts below ₹Y` (count below median) |
| Total Value    | top deal contribution, e.g. `Top: <Account> ₹<v>`                                                       |


Compute these inside the existing `kpis = useMemo(...)` block and render under the value as `<p className="text-[10px] text-muted-foreground mt-0.5 truncate">…</p>` (color-code red for "at risk" / amber for "renewals" using `text-destructive` / `text-warning`).

The visual style of the cards (gradient tints + chip icons) stays as is — only the data + extra line change.

---

## 3. Staffing & Capacity simplification

### 3a. Delete "Grouped view" entirely

- File `src/pages/Staffing.tsx`:
  - Remove `tables` from the `Tab` union and from `TABS`.
  - Remove the `BopmStaffingTables` import and its render block.
  - Remove the `if (isBopmPersona && tab !== "tables" && ...)` guard's `tables` reference.
- File `src/components/staffing/BopmStaffingTables.tsx`: delete the file.
- Search for any other imports of `BopmStaffingTables` and remove them. (None expected.)
- No DB / persisted state references it, so nothing to drop server-side.

### 3b. Make "Table view" the single staffing surface for everyone

Currently:

- BOPM persona → tabs: Table view / Grouped view / Change requests, renders `BopmStaffingFlatTable`.
- Admin / VSD → tabs: Deal view / People view / Staffing (matrix), renders `MatrixTab` for "Staffing".

Change in `src/pages/Staffing.tsx`:

- Replace the **Admin/VSD "Staffing" tab (`matrix`)** with the same `BopmStaffingFlatTable`. Rename the tab label to **Staffing** (keeping `matrix` key is fine, or rename to `table` for both — see technical notes).
- Pass the unscoped `deals` / `people` / `assignments` for admin/VSD (no BOPM scoping).
- The table needs to support edit-on-submit for admins (no approval flow). Since `BopmStaffingFlatTable` currently always routes through `submitStaffingBatch`, add a `readOnly?: boolean` and `directEdit?: boolean` prop:
  - When `directEdit` is true (admin / VSD), the "Send for review" button becomes "Save changes" and calls the supplied `onUpdateAssignment` / `addAssignment` / `deleteAssignment` callbacks directly instead of `submitStaffingBatch`.
  - For BOPM persona, keep current behaviour (submit to Central Cx).
- Remove "Deal view" and "People view" tabs from Admin/VSD as well? **No** — user only asked to remove the pivot view inside the Staffing tab. We keep "Deal view" and "People view" tabs, and the third tab becomes the new flat table. (Confirm in note below.)

If the user actually wants Deal view / People view also gone, that's a separate ask — current plan keeps them.

### 3c. Remove "Staffing — pivot view" header + subtitle

File `src/components/staffing/BopmStaffingFlatTable.tsx` (around line 650):

- Delete the `<div>` that contains `<h3>Staffing — pivot view</h3>` and the subtitle paragraph below it.
- Keep the right-side controls (search, columns picker, add-person dropdown) — move them up so they sit on a single header row flush with the top of the card.

### Technical notes

- `MatrixTab` stays in the codebase but is no longer rendered. We'll remove its import + render in `Staffing.tsx` only. (Leaving the file lets us revert easily; deleting it is also fine — confirm preference.)
- The `tab` URL param: existing `?tab=table` already works. For admin/VSD we'll switch the third tab key from `matrix` to `table`. Old links with `?tab=matrix` redirect to `?tab=table`.
- No DB migration required.

---

## Files Touched

- `src/pages/Clients.tsx` — KPI tile swap + insights line
- `src/pages/Staffing.tsx` — remove `tables` tab, replace `matrix` tab with flat table for all personas
- `src/components/staffing/BopmStaffingFlatTable.tsx` — styled person picker popover, remove pivot-view header, add `directEdit` mode
- `src/components/staffing/BopmStaffingTables.tsx` — **deleted**

## Open question

Confirm: keep "Deal view" and "People view" tabs for admin/VSD as-is, replacing only the third "Staffing" tab with the flat table? (The request "the table view should replace the staffing view" reads as yes — I'll proceed with that interpretation unless told otherwise.)  
Yes