## Goal

1. Make **Pepper BU** and **Capability Line** inline-editable dropdowns on Clients & Deals **for admins only**; everyone else sees read-only text (current behavior).
2. Add 5 new columns to the table — **PC Code**, **Month of Closed Won**, **Retainer Deal Value**, **Non-Retainer Deal Value**, **Total Deal Value** (skipping duplicates already present: Total Deal Value is already shown as "Total Revenue" so we'll keep it but rename clarification: see below).
3. Backfill those 5 fields + Pepper BU + Capability Line on `staffing_deals` from the uploaded CSV (171 rows), matched by `new_deal_id_formulated` or `new_deal_id_temp`.

## Changes

### 1. Inline edit for Pepper BU & Capability Line (admin-only)

`src/pages/Clients.tsx`

- The current `<td>` cells render plain text. Replace with conditional rendering:
  - If `access.isAdmin` → render a compact shadcn `<Select>` (using `PEPPER_BUSINESS_UNITS` / `CAPABILITY_LINES` from `@/data/staffingData`) wired to `updateDeal(deal.id, { pepperBusinessUnit: v })` / `{ capabilityLine: v }`.
  - Else → keep the existing read-only `<span>` with em-dash fallback.
- Reuses the existing `updateDeal` mutation (already used for `dealType`, `dealStatus`, `vsd`, etc. in the same table). The DB mapper already writes `pepper_business_unit` and `capability_line`.
- Visual style matches the existing inline `<Select>` cells already in this table (compact, ghost trigger, `text-xs`).

### 2. New columns in Clients & Deals

`src/pages/Clients.tsx` — extend `ALL_COLS`, `DEFAULT_VISIBLE`, `DEFAULT_WIDTHS`, the `<thead>` `<ColHeader>` list, the `<tbody>` row cells, and the filter logic:


| Column key             | Label                                 | Default visible | Width | Filter type | Notes                                         |
| ---------------------- | ------------------------------------- | --------------- | ----- | ----------- | --------------------------------------------- |
| `pcCode`               | PC Code                               | Yes             | 110   | text input  | Read-only                                     |
| `monthClosedWon`       | Month of Closed Won                   | Yes             | 130   | text input  | Read-only, shows raw string like "Jul-26"     |
| `retainerDealValue`    | Retainer Deal Value                   | No              | 130   | numeric     | Currency-formatted via existing `fmtCurrency` |
| `nonRetainerDealValue` | Non-Retainer Deal Value               | No              | 140   | numeric     | Currency-formatted                            |
| `totalDealValue`       | already exists as **"Total Revenue"** | —               | —     | —           | Skip — duplicate. Keep its current behavior.  |


Sorting handlers extended to handle the new keys (string sort for pcCode/monthClosedWon, numeric sort for the two money columns). Per-column filter dropdowns built from the existing pattern.

### 3. CSV backfill (one-time)

- Parse `Untitled spreadsheet - Sheet1 (1).csv` (171 rows) locally with a script.
- For each row, strip whitespace/commas from numbers and IDs.
- Build one `UPDATE public.staffing_deals SET pepper_business_unit=$1, capability_line=$2, pc_code=$3, month_closed_won=$4, retainer_deal_value=$5, non_retainer_deal_value=$6, total_deal_value=$7 WHERE TRIM(new_deal_id_formulated)=$id_formulated OR TRIM(new_deal_id_temp)=$id_temp` per row.
- Execute via the `supabase--insert` tool as one batched SQL statement (CASE-expression bulk update keyed on the union of formulated/temp IDs) to keep it to a single round-trip.
- Empty values in the CSV → `NULL` (so we don't overwrite existing data with blanks for the money columns).  
Not applicable should be an option in staffing i.e mapping of a user to a deal

## Out of scope

- No DB schema changes (all 7 columns already exist on `staffing_deals`).
- No changes to Deal Detail page (Pepper BU / Capability Line are already editable there for all roles — we'll leave that alone unless you want it gated too).
- No changes to RGY Health, Staffing, or Dashboard tables.

## Verification

- Log in as admin → Pepper BU / Capability Line cells render as dropdowns; selecting a value persists (refresh and re-check).
- Log in as non-admin → same cells render as plain text.
- Open the column-visibility menu → 4 new columns (PC Code, Month of Closed Won, Retainer Deal Value, Non-Retainer Deal Value) appear; sorting + filtering work on each.
- After backfill: spot-check ITC Nepal (deal `100853`) shows PC Code `PC3889`, Month `Jul-26`, Retainer ₹15,039,996. Spot-check Eltropy (deal `100598`) and Liberate Innovations (temp `TT12031`).