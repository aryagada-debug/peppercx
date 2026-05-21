## Redefine YTD & Lifetime periods in Financials tab

In `src/components/deals/FinancialsTab.tsx`, the YTD and Lifetime period roll-ups currently use the calendar fiscal year and all available rows. Redefine them to be anchored on the deal's contract dates.

### Changes (single file: `FinancialsTab.tsx`, `periods` useMemo)

**YTD ("Contract-to-date")**

- Rows: months where `r.month` is between `deal.startDate` and the current month (inclusive), instead of "months in current calendar year".
- Target (MRR-based): `MRR × months from deal.startDate to min(today, deal.endDate)`, dropping the current `yearStart` clamp.
- If `deal.startDate` is missing, fall back to the existing behavior so partial deals don't break.

**Lifetime ("Full contract")**

- Rows: months where `r.month` is between `deal.startDate` and `deal.endDate` (inclusive), instead of all rows. This excludes any stray rows outside the contract window.
- Target: unchanged — already `MRR × monthsBetween(startDate, endDate)`.

**Current Month**: unchanged.

### Notes

- Pure presentation/calculation change inside `FinancialsTab`. No schema, backend, or other component changes.
- Labels in `PipelineMatrix` may optionally be tweaked from "YTD" → "Contract YTD" for clarity (will confirm during implementation; default keeps "YTD" label). keep YTD