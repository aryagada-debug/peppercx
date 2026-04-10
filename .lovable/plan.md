

# Propagate "Add Month" Data Across All Sections

## Problem
When a new financial month is added via the modal, the data correctly appends to the financials table and the Financials tab sections re-compute. However:
1. **No toast confirmation** — the modal closes silently with no feedback
2. **Overview tab's Financial Snapshot** shows only deal-level fields (MRR, Total Value) — it doesn't reflect aggregated data from monthly financials (total consumed, total invoiced, total received, outstanding)
3. The Overview tab could show a "latest month" summary card to surface recent financial activity

## Changes

### File: `src/components/deals/FinancialsTab.tsx`
- Add a `toast.success("Month added")` call in `AddMonthDialog.handleSave` after the `onAdd` callback
- Import `toast` from `sonner`

### File: `src/pages/DealDetail.tsx`
- In the **Overview tab's Financial Snapshot** section, compute aggregated values from the `financials` array (total consumed, total invoiced, total received, outstanding) and display them alongside the existing deal-level metric cards
- Add a row of 4 derived metric cards below the existing 4 editable ones:
  - **Total consumed** — sum of all consumption entries
  - **Total invoiced** — sum of all invoiced entries  
  - **Total received** — sum of all received entries
  - **Outstanding** — total invoiced minus total received (red if > 0)
- These cards are read-only (not editable) since they're computed from monthly data
- Show "No financial data yet" placeholder text if no financials rows exist

### No database changes needed
All data already persists correctly via `useDealDetail.addFinancial`. The `financials` state array is shared across tabs, so adding a month automatically recomputes all `useMemo` values in `FinancialsTab`.

