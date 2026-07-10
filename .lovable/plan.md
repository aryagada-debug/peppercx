## Fix month selector on MBR Tracker + default MBR date

### 1. Restore the month dropdown
In `src/pages/MBRTracker.tsx` the selector is gated by `availableMonths.length > 0`. `availableMonths` is derived from months that already have entries (`useMBRData.ts`), so it collapses to empty (and disappears) whenever the filtered dataset has no entries yet.

Fix:
- Build a guaranteed month list in `MBRTracker` — the last 12 calendar months up to the current month — and merge it with `availableMonths` from the hook (dedupe + sort desc so newest is first).
- Use this merged list for the dropdown so the selector is always visible.
- Drop the `availableMonths.length > 0` guard on the `<Select>` (keep only `viewMode === "current"`).
- Keep the default-selection effect but point it at the merged list (default to current month).

### 2. Default MBR date to the selected month when the popup opens
`MBRInputDrawer` currently defaults `mbrDate` to `new Date(selectedWeek)` or today. When the user opens the MBR entry from a specific month, the picker should land inside that month.

Fix:
- Pass the currently `selectedMonth` (YYYY-MM) from `MBRTracker` to `MBRInputDrawer` as a new prop `selectedMonth`.
- In `MBRInputDrawer`, initialize `mbrDate` as:
  - if `selectedMonth` is the current calendar month → today,
  - else → the **last day of `selectedMonth`** (so it's clearly inside that month and the write lands in the right week).
- `MBRDetailDialog` (which wraps the drawer) gets the same prop forwarded.

### 3. Out of scope
No changes to hook logic, DB schema, or which month an MBR write is bucketed into — that already follows `mbrDate`.
