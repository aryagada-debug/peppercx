## Goal
Remove the "Reviewed — No Change" concept entirely from the RGY Health surface.

## Changes

### `src/pages/RGYHealth.tsx`
- Remove the `Reviewed — No Change` column header and its per-row cell (the `Mark reviewed` button / `Reviewed this week` badge).
- Remove related state and logic:
  - `reviewedThisWeek` state + the `useEffect` that loads from `deal_rgy_notes` where `dimension = '__review__'`.
  - `handleMarkReviewedNoChange` callback.
  - Import of `logRGYReviewedNoChange` from `@/lib/rgyHistory`.
  - Import of `weekRange` from `@/lib/rgyCompliance` if no longer used elsewhere in the file.

### `src/lib/rgyHistory.ts`
- Delete the `logRGYReviewedNoChange` export (and any internal helpers only it uses).

### Other surfaces
- Search the rest of the app for any remaining references to `logRGYReviewedNoChange`, `__review__`, or "Reviewed — no change" copy and remove them. Expected zero hits outside the two files above, but will verify before editing.

## Out of scope
- No DB migration. Existing `deal_rgy_notes` rows with `dimension = '__review__'` are left in place (harmless; no longer read). Can be cleaned up later if desired.
- Weekly compliance tab, RGY history popover, and combined-issue flow are untouched.
