## Goal

Two related changes to the RGY system:

### 1. Validation on RGY Health page

When **Overall Customer** is set to **R** or **Y**, **Internal** must be **R**. If Internal is G or Y, show a small inline error/alert near the Internal cell on that row.

> Note: weights below sum to 90% (50 + 10 + 6×5), not 100%. I'll keep raw weights as you specified and normalize over the dimensions that have a value (skipping NA/blank) so a partial row still produces a score.

### 2. Replace "worst RGY" with a computed Overall Customer RGY everywhere

Today, the rollup uses worst-of-all-dimensions. We'll switch to a weighted score:

```
weights:
  customer (Overall Customer) = 50
  internal                    = 10
  content                     = 5
  seo                         = 5
  supply                      = 5
  copy                        = 5
  design                      = 5
  video                       = 5

per-dimension numeric: R = 0, Y = 50, G = 100, NA/blank = excluded

score = sum(weight_i * value_i) / sum(weight_i over dims that have a value)
band:  score < 40 → R,  40–75 → Y,  > 75 → G   (final thresholds TBC)
```

Replace every existing "worst" rollup call site with this computed band. New helper: `getOverallCustomerRGY(deal)` in `src/pages/RGYHealth.tsx` (and re-exported from a shared location if needed) — old `getWorstRGY` becomes a thin wrapper around it (or is removed).

## Files to change

- `**src/pages/RGYHealth.tsx**`
  - Add `getOverallCustomerRGY(deal)` helper using the weighted formula.
  - Replace all `getWorstRGY(...)` call sites (lines ~1038, 1104, 1123, 1413, 1569) with the new helper.
  - In the row edit/save flow (and the `RGYCell` onChange for the `customer` and `internal` dimensions), validate: if `customer ∈ {R,Y}` and `internal ∈ {G,Y}`, render a small inline `Alert` / red helper text under the Internal cell on that row saying e.g. *"Internal must be R when Overall Customer is R/Y."* Non-blocking (still saves), just a visible warning. Confirm whether you want it blocking instead.
  - Update sorting / bucket counts (Red/Yellow/Green deal counts in the summary tiles) to use the new band.
- `**src/components/rgy/RGYInsightsTab.tsx**`
  - Switch `worst: getWorstRGY(d)` calls to the new helper; keep the `"R" | "Y" | "G" | null` type. Field stays named `worst` internally to minimize churn, but represents the weighted band.
- `**src/components/rgy/VSDDrillDialog.tsx**`
  - No code change needed (consumes `worst` from parent) — just verify counts still look right after parent change.
- `**src/pages/Index.tsx**` (Home/Dashboard)
  - Replace local `worstStatus(dims)` with the weighted version using the same weights. Used in:
    - `dealStatusById` map (line 219)
    - `allStatuses` / `prevStatuses` for portfolio score (lines 291, 318, 351)
  - This means `portfolioScore` and the dashboard "worst → best" sort now reflect the weighted Overall Customer band.
- `**src/lib/portfolioScore.ts**`
  - Comment updates only (`worst-status per deal` → `weighted Overall Customer band`).
- `**src/components/dashboard/DealScorecardTable.tsx**`
  - Comment update only (the "asc = worst first" sort comment).
- `**src/pages/MBRTracker.tsx**`
  - `worst` here refers to MBR flag severity, not RGY — **leave alone**.

## Open questions

1. **Thresholds for R / Y / G bands** — proposed `<40 → R`, `40–75 → Y`, `>75 → G`. OK, or different cutoffs? OK
2. **Weights sum to 90, not 100.** Confirm you want the literal weights (I'll normalize over present dimensions), or should "others" be 6.667% each so totals hit 100? normalize it over present dimensions
3. **Validation behavior** — non-blocking inline alert (proposed) or hard block on save? hard block on save

I'll proceed with the proposals above unless you say otherwise.  
  
the current aging does not show the days since marked R. It shows 0. Calculate it in aging in insights tab of RGY