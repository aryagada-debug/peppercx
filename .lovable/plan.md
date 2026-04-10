

# Make Financials Tab Fully Editable + Propagate Add Month Data

## Changes

### 1. Inline editing in the Monthly Financials table (`FinancialsTab.tsx`)

Add click-to-edit on every data cell in the table (Contracted, Consumption, Planned GM%, Actual GM%, Invoiced, Received). Clicking a cell turns it into a small input; on blur/Enter it calls `onUpdate(row.id, { field: newValue })` and shows a brief green checkmark. Outstanding recomputes automatically. The Month column stays read-only.

All derived sections (Deal Snapshot cards, Pipeline Health cards, Charts, Consumption Bucket) already use `useMemo` on `rows`, so they update instantly when a row is edited.

### 2. Propagate Add Month data to Overview tab (`DealDetail.tsx`)

The YTD Financial Summary section (lines 249-289) already computes totals from the `financials` array, so new months auto-propagate there. No change needed for that.

However, the **Financial Snapshot metric cards** in the Overview (lines 215-247 area — MRR, Total Value, GM%) are deal-level fields, not derived from monthly data. We should add the monthly-derived totals (consumed, invoiced, received, outstanding) into those cards so the Overview fully reflects added months. This is already done per the previous implementation.

### 3. Implementation details

**`FinancialsTab.tsx`** — Single file edit:
- Add an `EditableTableCell` inline component: renders value as text normally, on click switches to `<input>`, on blur/Enter calls `onUpdate` and flashes a green checkmark icon for 1 second
- Replace each static `<td>` in the data rows (Contracted through Received — 6 columns) with `<EditableTableCell>`
- Outstanding column stays computed (invoiced - received), not directly editable
- Att% stays computed, not editable
- Month stays read-only

**`DealDetail.tsx`** — No changes needed. The Overview YTD cards already derive from `financials` array and update reactively.

## Files

| File | Change |
|------|--------|
| `src/components/deals/FinancialsTab.tsx` | Add inline cell editing to table rows |

