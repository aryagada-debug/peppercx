## 1. Home calendar — "Join" button on today's meetings

**File:** `src/pages/Home.tsx` (today's calendar list, ~line 1340–1370) and `src/hooks/useGoogleCalendar.ts`.

- Extend `GCalEvent` to also expose `hangoutLink` and `conferenceData` (Meet link), and pass them through `normalizeEvents()`.
- Resolve a usable join URL with this priority per event:
  1. `hangoutLink` (Google Meet)
  2. `conferenceData.entryPoints[].uri` where `entryPointType === "video"` (covers Meet/Teams/Zoom added via conferenceData)
  3. First `https://*` URL parsed from `location` or `description` matching `meet.google.com | teams.microsoft.com | teams.live.com | zoom.us`.
- Render a small primary `Join` button (Video icon) inline with each meeting row in `Today's calendar` only when a join URL is found, and only when the meeting is current or upcoming-within-15-minutes (always-visible for live; hover-visible otherwise to keep the row clean). `target="_blank"`, stops click propagation so the row's edit drawer doesn't open.
- Same treatment in `FullCalendarDialog` event popovers (one-line addition there) so behaviour is consistent.

No backend changes — Meet/Teams/Zoom links are already returned by the create function (`google-calendar-create`) when conferencing is selected.

---

## 2. Targets page — per-deal monthly target setting (single source of truth)

Replace the current VSD/Deal split with the layout from the supplied HTML. The existing `deal_financial_targets` table already powers Financials, so edits here flow through automatically — no schema change.

### Header
- Title: `Set {Month} targets · {current user name}`.
- Sub-line: `{N} deals · {M} BOPMs · tracking measured as MRR × months since start` + `All saved` indicator (auto-save state).
- Right side: month picker (existing `DateRangeSelector`), `Copy {prevMonth} targets` and `Match MRR for empty fields` action buttons (admin/VSD only).

### Summary strip (5 tiles)
1. `Deals needing {Month} targets` — count of deals with no target row this month, plus "X behind expected pace" sub-stat.
2–5. Contraction / Delivery / Invoicing / Receivables — actual vs target totals with attainment %, 1‑line status (e.g. `₹4.1L gap · 6 deliveries pending`). Reuse `useDealTargets(month)` totals; "expected pace" uses MRR × months elapsed from `staffing_deals` (`mrr`, `start_date`).

### Filters bar
- All / per-VSD chips (derived from `staffing_deals.vsd`) + `Unassigned`.
- Quick toggles: `Needs targets` and `Behind pace`.

### Deal rows (accordion-style table)
Columns: Deal (name, sub-line, deal id · BOPM) · Size (₹ value, MRR) · Delivery vs expected pace (`₹MRR × N mo = ₹X` and a progress bar of actual delivery vs expected) · Four inline editable target inputs for the selected month (Contraction, Delivery, Invoiced, Received) with the previous month's value shown as muted hint (`Apr 4L`).
- Inline edit writes to `deal_financial_targets` (upsert on `deal_id+month`); auto-save with check-mark like `EditableTableCell`.
- Click row to expand: shows April / YTD / Lifetime breakdown for each metric (Expected vs Actual + %), and the editable May-target column repeated for clarity. Data sources: `deal_financials` rollup + `deal_financial_targets`.
- VSD subtotals row at the bottom of each VSD group (and a global subtotal in the table footer when filter = All).

### Sync to Financials
- No new code path needed — `useDealDetail.loadAll()` already merges `deal_financial_targets` into `FinancialRow` (lines 144 + 166–204). Verify by editing a target on the new page and confirming it appears in the deal's Financials tab.

### Files to add / change
- `src/pages/Targets.tsx` — rewrite to the new layout.
- `src/components/targets/TargetSummaryStrip.tsx` *(new)* — 5 tiles.
- `src/components/targets/TargetDealRow.tsx` *(new)* — collapsible row with 4 inline target editors and expanded breakdown.
- `src/components/targets/TargetActionsBar.tsx` *(new)* — "Copy previous month" / "Match MRR" bulk actions (upsert into `deal_financial_targets`).
- `src/hooks/useFinanceTargets.ts` — add `useDealTargetsWithMeta(month)` joining `staffing_deals` (deal_name, account, vsd, bopm, mrr, total_deal_value, start_date) and computing `expectedToDate` per metric.
- Keep `DealTargetsTable.tsx` (used by Home preview) untouched.

### Permissions
- Edit targets: VSD owner of the deal OR admin (reuse `useUserRole` + `staffing_deals.vsd` match against current profile). Read-only otherwise — disable the inputs and hide bulk actions.

---

## Verification

- Targets page: open `/targets`, change a target inline → toast/check confirms save → open the corresponding deal's Financials tab → number reflects in Target columns.
- Bulk "Copy April targets" sets May targets only for empty rows; "Match MRR" sets each empty target = `staffing_deals.mrr` for the month.
- Home: a meeting created with `Conferencing = Google Meet` shows a `Join` button that opens Meet in a new tab; one with no conferencing shows no button.
