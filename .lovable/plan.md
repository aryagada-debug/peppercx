## 1. Staffing cards — show MRR & Total Deal Value

In `src/components/staffing/DealStaffingCard.tsx` and the equivalent staffing block in `src/pages/DealDetail.tsx` (Staffing tab), extend the KPI strip from 2 tiles to 4:

- Team Size
- Total Hrs/Week
- **MRR** (from `deal.mrr`, formatted via existing `fmtCurrency` so global ₹/$ toggle still applies)
- **Total Deal Value** (from `deal.totalDealValue`)

Show `—` when the value is missing. Grid becomes `grid-cols-2 md:grid-cols-4`.

## 2. Clients & Deals — make Analytics / Table toggle prominent

In `src/pages/Clients.tsx` (around lines 906–940):

- Replace the small inline segmented control with a larger, top-level **tab bar** sitting on its own row directly under the KPI strip — full-width, bigger labels, icon + count badge (e.g. "Analytics" / "Table · 158").
- Move `Add Client` / `Add Deal` to the right edge of the same row so the tabs are the visual focal point.
- Keep current state machine (`view: "analytics" | "table"`), just restyle.

## 3. Top-level table filters: Deal Type, Status, Pepper BU

These already exist as column-header dropdowns. Add them as **always-visible quick filters** in the table toolbar (the row at line 957) so users don't need to discover the column menu:

- 3 compact `<Select>` (or chip-popover) controls labelled **Type**, **Status**, **Pepper BU**, populated from the existing constants `["Retainer","Non-Retainer","Pilot"]`, `DEAL_STATUSES`, `PEPPER_BUSINESS_UNITS`.
- Each writes into the same `colFilters` state used by the column headers (keys: `dealType`, `dealStatus`, `pepperBusinessUnit`) so filtering logic, "Clear filters" pill, and column-header indicators all stay in sync — no duplicate filtering code.
- Place them right after the existing VSD / BOPM pill rows, before the search box.

## Technical notes

- No schema changes; `mrr` and `totalDealValue` already live on the deal record and are used elsewhere in the table.
- Currency formatting reuses `fmtCurrency` from `dealCurrency.ts` (already converts to the active global currency).
- Filter wiring uses existing `setFilter(colKey, value)` / `clearFilter(colKey)` helpers — selecting "All" calls `clearFilter`.
- No changes to data hooks, RLS, or business logic.

## Out of scope

- Editing MRR / Total Deal Value inline from the staffing card (kept read-only here; still editable in Deal Detail → Financials).
- Adding more filter dimensions beyond the three requested.
