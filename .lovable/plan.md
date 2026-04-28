## 1. Weekly Capacity Tracker — input as hours

`src/components/deals/WeeklyStaffingGrid.tsx`

- Replace the % allocation cell with **hours per week** input (0–60h, default cap 40h).
- Internally still write `allocation_pct = round(hours / 40 * 100)` to `staffing_weekly_allocations.allocation_pct` so DB schema and downstream logic stay intact (no migration needed).
- Display value: show "Xh" (no %). Color coding: 0 muted, 1–19h normal, 20–39h amber, ≥40h red (over-allocated).
- Update header sub-text to: *"Log how many hours each person actually spent on this deal that week."*
- Footer "Total %" row → "Total Hrs" row (sum hours per week).
- Existing right-side "Total Hrs" column stays (already in hours).

## 2. RGY editor — auto-open issue form on each non-green change

Currently `EditableRGY` batches changes locally and only fires `onSave` when the user clicks the Save button — so toggling several dimensions opens the issue popup just once at the end.

Change to **immediate-save model**:

`src/components/deals/EditableRGY.tsx`
- Remove the local `dirty` state and the "Save" button.
- On every button click, call `onSave(updatedDimensions)` immediately for that single change.
- Keep the local mirror only for instant visual feedback.

`src/pages/DealDetail.tsx` (`handleRGYSave`)
- Already opens `RGYIssueForm` whenever a Y/R is present. Adjust so each individual dimension flip that introduces a new Y/R re-opens the form (reset `showIssueForm` to true on each non-green save, even if the dialog was just closed).
- Track `lastIssuedDimensionKey` so the popup focuses on the dimension just changed.

`src/pages/RGYHealth.tsx` (inline RGY editing in the table)
- Same pattern: each cell click immediately persists and triggers `RGYIssueFormDialog` for that dimension if value is Y/R. Re-trigger on subsequent flips.

Net behaviour: click Customer→Red → popup opens for Customer. Close/save it. Click Internal→Yellow → popup opens again for Internal. Etc.

## 3. RGY Insights — Aging + consolidated chart

`src/components/rgy/RGYInsightsTab.tsx`

**Aging sort & highlighting**
- Compute `daysSince(issue_date || created_at)` (already exists).
- Define threshold `RED_AGING_THRESHOLD = 10` days (configurable constant; reuse existing 10/15 flag logic).
- In **Active Issues** list and the **Aging Issues** card, sort: Red issues > threshold first (descending by days), then other Red, then Yellow.
- Add an "Aged Red" badge on rows where `worst === "R" && days > 10`, with a stronger red background pill.

**Replace 3 charts with 1 combined column chart**
Remove:
- "Red Count per Team" (BarChart)
- "Yellow Count per Team" (BarChart)
- "Service Line Health" (stacked BarChart)

Add a single **"Team Health Breakdown"** chart:
- Vertical (column) BarChart, x-axis = all 8 dimensions (Customer, Internal, Content, SEO, Supply, Copy, Design, Video).
- Three stacked bars per team: Red / Yellow / Green counts (use existing `COLORS`).
- Click a Red or Yellow segment → existing `setTeamDrill({ team, severity })` flow (preserved).
- Tooltip shows R/Y/G counts; legend at top.

Data shape:
```ts
const teamHealth = DIMENSIONS.map(dim => ({
  team: dim.label,
  key: dim.key,
  Red: filteredDeals.filter(d => d[dim.key] === "R").length,
  Yellow: filteredDeals.filter(d => d[dim.key] === "Y").length,
  Green: filteredDeals.filter(d => d[dim.key] === "G").length,
}));
```

Heatmap, VSD comparison, KPI row, donut: unchanged.

## Files to edit
- `src/components/deals/WeeklyStaffingGrid.tsx`
- `src/components/deals/EditableRGY.tsx`
- `src/pages/DealDetail.tsx` (RGY save flow, both Overview + RGY Health tab usages)
- `src/pages/RGYHealth.tsx` (inline cell save → re-open dialog per change)
- `src/components/rgy/RGYInsightsTab.tsx`

No DB migrations required.