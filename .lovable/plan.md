

# Block Green Until Tasks Done + Full RGY Change History

## Summary
Two changes: (1) When a dimension is moved back to Green, show a dialog listing all open `[RGY Health]` tasks for that dimension — user must mark them Done before Green is accepted. (2) Every RGY save creates a new row (never updates the current week's row), building a full change log. History table groups entries by week with a collapsible dropdown when multiple changes exist in the same week.

## Changes

### 1. Green-gate dialog (`src/pages/DealDetail.tsx`)

In `handleRGYSave`, before persisting, compare old vs new values per dimension. If any dimension changed **to Green**, find all `[RGY Health] {dimension}` tasks that are NOT "Done"/"Dropped". If any exist:
- Block the save
- Show an `AlertDialog` listing the pending tasks with checkboxes
- User can mark tasks as Done directly from the dialog (calls `updateTask`)
- Once all tasks for that dimension are Done, allow the Green transition
- Add a "Force close" option that marks remaining tasks as Done automatically

State: `pendingGreenDims` (array of `{dimension, label, tasks}`) controls dialog visibility.

### 2. Always insert new RGY row for history (`src/pages/DealDetail.tsx`)

Change `handleRGYSave`: remove the `if (currentRGY && currentRGY.weekStart === weekStart) { updateRGYWeek(...) }` branch. Always call `addRGYWeek(...)` so every save creates a new row. The `currentRGY` (index 0 of sorted array) still reflects the latest state.

### 3. Grouped history table (`src/pages/DealDetail.tsx`)

Replace the flat history table with a grouped view:
- Group `rgyWeekly` by `weekStart`
- If a week has 1 entry → show it as a normal row
- If a week has multiple entries → show the latest as the main row with a small expand/collapse chevron. Clicking expands to show all changes within that week as indented sub-rows with timestamps (using `created_at` from the DB)
- Add `created_at` to the `RGYWeekly` interface to support ordering within a week

### 4. Add `createdAt` to RGYWeekly interface (`src/hooks/useDealDetail.ts`)

Add `createdAt?: string` to the interface and map `created_at` from DB rows in the load query. Sort `rgyWeekly` by `created_at` descending.

## Files Modified

| File | Change |
|------|--------|
| `src/hooks/useDealDetail.ts` | Add `createdAt` to `RGYWeekly`, map from DB, sort by `created_at desc` |
| `src/pages/DealDetail.tsx` | Green-gate dialog, always-insert logic, grouped history with week dropdown |

