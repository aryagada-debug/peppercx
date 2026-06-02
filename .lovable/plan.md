
## Goal

On `/clients`, non-admin users (VSD, Capability Lead, BOPM, Capability Member) should see a single combined view — a small 4-KPI strip and a curated, filterable deals table below it (no tabs, no in-depth analytics). Admin (Central CX) keeps the existing Analytics/Table tabs and the full customizable table.

Scope already in place: `useDealAccess` already returns only the deals a non-admin should see (self + reportees for Cap Leads; explicit BOPM/VSD cell match for others; assigned deals for Capability Members). No changes to access logic.

## What changes

### 1. `src/pages/Clients.tsx` — branch the view by role

- Detect `!access.isAdmin` once (call it `isCentralCx = access.isAdmin`).
- Admin path: unchanged. Keep the `Analytics ▸ Table` tab toggle, the existing 5 hero KPI tiles, full column set, Columns picker, all filters.
- Non-admin path: render **one section** instead of the tab toggle.
  - Top: 4 compact KPI tiles (see below).
  - Below: the **same `<table>` element** that exists today, but locked to a curated column set and a curated filter strip (so we reuse all existing row rendering, sort, RGY pill, inline navigation — no new table component).

The branch only changes:
- which buttons render in the header (hide "Add Client" / "Add Deal" for non-admin — already gated by `access.isAdmin` in current code, keep that),
- the view-switcher (skip rendering `Analytics | Table` tabs; just render the table block),
- `visibleCols` initialization and the Columns dropdown,
- the KPI strip above the table.

### 2. KPI strip for non-admin (above the table)

Compute over the already-scoped `deals` list (active statuses only, matching today's KPI filter):

1. **My Deals** — count of `deals` (active statuses).
2. **Total MRR** — sum of `mrr`, formatted via `useCurrency().format`.
3. **Total Deal Value** — sum of `totalDealValue`.
4. **Renewals < 90d** — reuse the existing renewal computation already in the page (`renewalCount`).

Use the same tile component style as the current admin KPIs but only 4 across; make MRR and Total Value the visually emphasized tiles (slightly larger numeric, primary-toned border/background accent) — that satisfies "highlight revenue figures in a better table structure".

### 3. Curated table for non-admin

Locked column order (no Columns picker, no drag reorder for non-admin):

```text
Client | Deal Name | Type | Status | Pepper BU | VSD | Sr/Principal BOPM | Content Lead | SEO Lead | MRR | Total Value | RGY
```

Mapping to existing column keys already defined in `ALL_COLS`:
`account, dealName, dealType, dealStatus, pepperBusinessUnit, vsd, bopm, contentLead, seoLead, mrr, totalDealValue, rag`.

- For non-admin, set `visibleCols` to this fixed list and skip persisting to `localStorage` (or use a separate key `clients-visible-cols-nonadmin-v1` so it can't bleed into admin's preference).
- Hide the Columns / Reset buttons.
- Keep all column headers' existing **sort + per-column filter** behavior (`ColHeader`, `colFilters`, `openFilter`) — every listed column already supports it, which satisfies "all of these should be filters".
- Keep the top filter strip (search box, VSD pills, BOPM dropdown, Type/Status/BU selects, Closed toggle) — these are already there and useful.
- Visual emphasis on revenue cells: in the table body, when rendering `mrr` and `totalDealValue` cells for non-admin, add a subtle `bg-primary/5 text-foreground font-medium` class to make the two money columns pop relative to the rest. (Pure CSS, no logic change.)

### 4. Cleanup

- The existing `BopmClientsHeader` block (already removed per a prior request) stays removed.
- No changes to data hooks, mutations, or access control.
- No changes to the deal detail page or any other route.

## Files touched

- `src/pages/Clients.tsx` — branch UI by `access.isAdmin`, add small `NonAdminKpiStrip` block inline (or as a sibling component file if it gets long), apply the locked column list and the revenue-cell highlight class.

No new dependencies. No DB / edge function changes.

## Out of scope

- Building a separate analytics dashboard for non-admins — the 4 KPIs replace that.
- Changing what counts as a "visible deal" — `useDealAccess` already handles team scoping for Capability Leads (direct + indirect reportees) and BOPM/VSD cell matching.
- Customizable columns for non-admin (explicitly requested as a Central CX–only capability).
