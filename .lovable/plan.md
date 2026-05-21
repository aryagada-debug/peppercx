# Plan

## Part 1 — Refresh deals from the master Google Sheet

Trigger the existing `sheets-sync-deals` edge function (no code changes). It pulls the published deal-master CSV and upserts:
- `staffing_deals` (id = `pc_code_dealId`) — names, VSD, BOPMs, MRR, deal values, dates
- `deal_financials` — monthly invoiced / received / contracted / consumption per deal
- `clients` — auto-creates any missing `pc_code`

After it runs, verify counts (deals upserted, financials upserted, errors). Report the run summary back.

Note: the current sync does **not** populate `deal_type` (Retainer / Non-Retainer / Pilot) because the source column for it isn't mapped. If the master sheet has a Type column you want pulled, tell me the column letter and I'll add it; otherwise existing `dealType` values in the DB are left as-is.

## Part 2 — Global Retainer / Non-Retainer / Pilot filter

A `dealType` filter (All / Retainer / Non-Retainer / Pilot) already exists on **Staffing → Deal view**. Add the same control everywhere deals are listed:

### Staffing page
- `BopmStaffingFlatTable` (Staffing & Capacity flat table) — add filter in toolbar
- `CapacityTab` — add to header
- `MatrixTab` — add to filter row
- `AccountsTab` — add to header
- `PeopleViewTab` / `DealLevelView` — add to header
- `RevenueCapacityTab` — add to header

### Other pages
- **Clients & Deals** (`Clients.tsx`) — the column-header filter currently exposes only Retainer / Non-Retainer; extend to include Pilot.
- **Dashboard** (`pages/Home.tsx` / scorecard) — add a top-level Deal Type filter that flows through KPI tiles, scorecard, drilldowns.
- **RGY Health** (`pages/RGYHealth.tsx`) — add to filter bar.
- **MBR Tracker** (`pages/MBRTracker.tsx`) — add to filter bar.
- **Targets** (`pages/Targets.tsx`) — add to deal-table filter row.
- **Revenue** (`pages/Revenue.tsx`) — add to filter row.

### Implementation details
- New shared component `src/components/filters/DealTypeFilter.tsx` — a small Select with options: `All`, `Retainer`, `Non-Retainer`, `Pilot`. Controlled (`value`, `onChange`).
- Each consumer keeps the filter state local (`useState<"All"|Deal["dealType"]>`) and applies `dealType === filter || filter === "All"` to its `deals` array before rendering / aggregation.
- No DB or schema changes.
- Empty / unknown `dealType` rows are shown only when filter = `All`.

## Out of scope
- Persisting filter selection across navigation (can add later via URL param if you want).
- Adding a Pilot variant to badge styling — Pilot will use the same neutral chip as Non-Retainer unless you want a distinct color.
