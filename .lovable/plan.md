

# RGY Health — Show All Deal Statuses in Tabular View

## What Changes

Currently the RGY Health page only fetches active deals (Active Deal, Deal Disputed, New Deal in SLA/PO). The request is to show RGY status for **all** deal statuses — active and closed — in a tabular view, alongside the existing metrics and heatmap.

Total deals: ~791 (317 Active, 394 Completed, 64 Churned, 12 New in SLA/PO, 3 Disputed).

## Implementation

### 1. Update `src/pages/RGYHealth.tsx`

- **Remove the active-only filter** — fetch all deals from `staffing_deals` (no `.in("deal_status", ...)` filter)
- **Add a status filter dropdown** at the top (default: "All Statuses") with options for each status: Active Deal, Deal Disputed, New Deal in SLA/PO, Deal Completed Successfully, Deal Churned / Lost
- **Add a status column** to the heatmap table showing deal status with color-coded badges
- Keep existing metric cards but compute them based on the filtered view
- Handle the larger dataset (791 rows) — paginate or use virtual scroll if needed, otherwise just render all since it's a manageable size

### 2. Update `src/components/dashboard/RGYHeatmap.tsx`

- Add a `Status` column between `BOPM` and the dimension columns
- Render deal status as a small color-coded badge (green for Active, gray for Completed, red for Churned, yellow for Disputed, blue for New in SLA/PO)
- Add the status field to the `RGYRow` type

### 3. Update `src/types/dashboard.ts`

- Add optional `status` field to `RGYRow` interface

### Files Modified
| File | Change |
|------|--------|
| `src/pages/RGYHealth.tsx` | Fetch all deals, add status filter dropdown |
| `src/components/dashboard/RGYHeatmap.tsx` | Add Status column with badges |
| `src/types/dashboard.ts` | Add `status` to `RGYRow` |

