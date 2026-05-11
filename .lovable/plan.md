## Goal

On the **RGY Health → All Deals** tab, surface the mathematically computed **Overall Customer RGY** (already implemented in `src/lib/overallCustomerRGY.ts`) as:

1. The driver of each deal row's background tint.
2. A new read-only **"Overall RGY"** column with an info tooltip explaining the formula.

---

## Current state

- `getWorstRGY(deal)` in `src/pages/RGYHealth.tsx` already delegates to `computeOverallCustomerRGY` (weighted score → R/Y/G band). The row `rowTint` is already keyed off it, so background colors are already driven by the computed value — no logic change needed here, just verify and keep as is.
- The existing **"Overall Customer"** column (`customer` dim key) is the **manually-entered** Customer dimension, not the computed rollup. We will keep that column unchanged and add a separate **computed** column.

---

## Changes (UI only, single file: `src/pages/RGYHealth.tsx`)

### 1. New column definition
- In `ALL_COLS`, add `{ key: "overall_rgy", label: "Overall RGY", required: true }` right after the `deal_status` column so it sits prominently near the left.
- Add `"overall_rgy"` to `DEFAULT_VISIBLE`.
- Add a default width entry in `DEFAULT_WIDTHS` (~110px).

### 2. Header cell
- Render a `<th>` (not a sortable `ColHeader`, since it's derived/read-only) with:
  - Label "Overall RGY"
  - A small `Info` icon (lucide) wrapped in a `Tooltip` explaining the computation:
    > "Weighted rollup of all RGY dimensions. Weights: Overall Customer 50, Internal 10, Content/SEO/Supply/Copy/Design/Video 5 each. Each dim scores R=0, Y=50, G=100; NA/blank excluded. Bands: <40 = Red, 40–75 = Yellow, >75 = Green."
- Render only when `isColVisible("overall_rgy")`.

### 3. Body cell
- For each row, compute `band = getWorstRGY(deal)` (already done above the row).
- Render a non-interactive pill matching the existing RGY badge style (reuse the `cellColors` map: `rgy-red` / `rgy-yellow` / `rgy-green`, or `rgy-pending` when null) showing `R` / `Y` / `G` / `—`.
- Wrap the pill in a `Tooltip` showing the numeric weighted score (call `computeOverallCustomerScore` from the same lib) e.g. `"Score: 72 → Yellow"` plus the dim breakdown.

### 4. Column toggle menu
- Since the column is `required: true`, the existing toggle logic already disables hiding it. No code change.

### 5. Row tint (verify, no change)
- Confirm the `rowTint` block at line 1433 continues to use `getWorstRGY` → reflects computed Overall RGY background. Leave as is.

---

## Technical notes

- Export `computeOverallCustomerScore` from `src/lib/overallCustomerRGY.ts` is already exported — just import it.
- No DB / edge function / schema changes.
- No new components; tooltip uses the existing `Tooltip` primitive already imported.
- Sorting/filtering on the new column: skip for v1 (column is read-only & derived). Can add later if requested.

---

## Files touched

- `src/pages/RGYHealth.tsx` (only)