## Problem

The Staffing & Capacity table (`BopmStaffingFlatTable`) currently shows two kinds of rows in the BOPM columns (Principal BOPM / Senior BOPM / BOPM):

1. **Real staffing assignments** — rows actually added via "Add Staffing Member" with an allocation %.
2. **Virtual chips** — read-only entries synthesized from the deal sheet's `principal_bopm` / `senior_bopm` / `bopm` text fields (e.g. `Risha Sinha`, `Ritu Shinde`). These come from the legacy Google Sheets sync and have no real assignment, no %, no start/end.

The user wants the virtual chips gone from Staffing & Capacity. They should not appear in Clients & Deals either (already correct, since Clients & Deals only mirrors real assignments via the trigger we added last turn).

## Change

In `src/components/staffing/BopmStaffingFlatTable.tsx`, **remove the virtual-chip synthesis block** (lines ~840–895) so only real `staffing_assignments` rows render. Also drop the now-unused `isVirtual` / `rawText` branches:

- Delete the `virtualBopmFields` loop that injects synthetic entries into `byRole`.
- Remove the `isVirtual` rendering branch (the muted chip + "clear virtual" X button).
- Remove the `onUpdateDeal`-based `clearVirtual` handler (no longer needed) and the `onUpdateDeal` prop wiring in `Staffing.tsx` if nothing else uses it.
- Keep `resolveCellToken` only if still used elsewhere; otherwise prune.

Result: the BOPM columns show **only** people with explicit allocations, matching what's shown in Clients & Deals.

## Notes

- This is purely a display change. No DB migration. Deal sheet text fields (`principal_bopm` etc.) are left untouched — the trigger from the previous turn still keeps them in sync going forward whenever real assignments change.
- If the user later wants to backfill assignments from those legacy text fields, that's a separate one-time data task.