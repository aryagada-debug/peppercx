## Fix Financials targets in Deal Detail

In `src/components/deals/FinancialsTab.tsx`, separate the MRR-based target from the contraction/delivery target so they no longer collide.

### Current bug

The `targetOverride` parameter passed to `computePipeline` for YTD and Lifetime currently equals `dealMrr × months`. That value overrides BOTH contraction/delivery targets AND invoicing/receivables targets, so contraction/delivery attainment is wrong on retainer deals.

### Changes

1. **YTD invoicing/receivables target** = `MRR × months elapsed since contract start` (through current month, capped at contract end).
2. **Lifetime invoicing/receivables target** = `MRR × total contract months` (= total deal value).
3. **Current month invoicing/receivables target** = `MRR` (unchanged).
4. **Contraction & Delivery targets (all periods)** = sum of per-row `contractionTarget` / `deliveryTarget` from sheet rows in the period. No MRR override. Totals (consumption, deliveryActual) continue to come from the same row subset.
5. Drop the `targetOverride` argument for the YTD / Lifetime calls — pass `undefined` for it so contraction/delivery fall back to per-row sums, and pass the MRR-based number only as `mrrTarget`.
6. Non-retainer deals (MRR = 0 or empty) keep falling back to per-row `invoicingTarget` / `receivablesTarget` sums, as today.

### Files

- `src/components/deals/FinancialsTab.tsx` — update the `periods` useMemo only. No schema, no other component, no backend changes.
