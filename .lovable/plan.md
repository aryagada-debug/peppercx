# Clients & Deals — Portfolio Analytics

Goal: turn the Clients page into a true portfolio-analytics surface. Slice every active deal across every meaningful dimension (VSD, Senior BOPM/GAM, Pepper BU, Capability Line, Geo, Retainer vs Non-Retainer), with US/India geo as a first-class filter that also influences other modules' P&L numbers.

All data is already on the `Deal` model — no schema changes:
`vsd`, `principalBopm`, `seniorBopm`, `bopm`, `pepperBusinessUnit`/`businessUnit`, `capabilityLine`, `dealType` (Retainer / Non-Retainer / Pilot), `mrr`, `retainerDealValue`, `nonRetainerDealValue`, `totalDealValue`, `geo`.

## 1. New "Analytics" tab on Clients & Deals

Add a tab switcher at the top of `src/pages/Clients.tsx`:
`Clients & Deals` (current table) | `Analytics` (new, default for admin/VSD personas).

The Analytics tab is one scrollable page composed of bands. Each band uses the flat-UI design system (off-white bg, thin borders, purple primary, semantic colors). Every aggregate row is click-through and drills into the Clients table filtered to those deals.

### Band A — KPI strip (8 tiles)
Active deals · Retainer deals · Non-Retainer deals · Total MRR · Total Retainer Value · Total Non-Retainer Value · Total Deal Value · Avg MRR per deal.
Currency-aware via `useCurrencyVersion` + `formatINR` / `formatMoney`. Tiles tinted with semantic tones (positive / warning / muted).

### Band B — Portfolio by VSD
Table: VSD · # Deals · Retainer # · Non-Retainer # · MRR · Retainer Value · Non-Retainer Value · Total Value · % of portfolio.
Sortable; Grand Total row pinned. Mirrors the screenshot's "VSD" pivot. Click a VSD row → table tab filtered to that VSD.

### Band C — Portfolio by Senior BOPM / GAM
Same column shape as Band B but rows are Senior BOPM (falls back to Principal BOPM / GAM where Senior is empty, matching how Staffing groups today). Adds an "Unassigned" bucket.

### Band D — Pepper BU + Capability split
Two side-by-side tables:
- **By Pepper Business Unit** (`pepperBusinessUnit`, fallback `businessUnit`): # Deals, MRR, Retainer Value, Non-Retainer Value, Total, GM% placeholder slot.
- **By Capability Line** (`capabilityLine`, e.g., Content, SEO, Creative, Video): same columns.

Both mirror the "Service Line Tagging" pivot from the uploaded sheet.

### Band E — Retainer vs Non-Retainer mix
Compact 2-row table + a horizontal stacked bar (Recharts) showing Retainer vs Non-Retainer share of total deal value, repeated three ways: overall, by Pepper BU, by VSD. Helps answer "where is the retainer concentration?".

### Band F — Geo split (US vs India)
Table with rows = `geo` (US, India, Other/Unspecified) × columns = # Deals, MRR, Retainer Value, Non-Retainer Value, Total Value, % share. Includes a small donut for # deals and another for MRR. This is the canonical US/India split.

### Band G — MRR distribution
Histogram-style table bucketed by MRR tier (<5L, 5–15L, 15–30L, 30–60L, 60L+ in INR) crossed with Retainer vs Non-Retainer. Click a bucket → drill to table.

## 2. Geo (US / India) as a global filter

Add a Geo selector to the Clients page header (All / US / India / Other). It scopes:
- All Analytics bands above.
- The existing Clients & Deals table.

To make Geo influence "P&L across modules", add a lightweight `GeoFilterContext` (`src/contexts/GeoFilterContext.tsx`) holding `geo: "all" | "US" | "India" | "Other"`. Persist in `localStorage`. Consume it (read-only for this phase) in:
- `src/pages/Staffing.tsx` Overview KPIs (MRR, deal counts).
- `src/pages/Targets.tsx` / `FinanceTargetsCard` totals.
- `src/pages/MBRTracker.tsx` deal list.
- `src/pages/RGYHealth.tsx` deal list.
- Home dashboard portfolio tiles.

Each consumer simply filters its `deals` array by `geo` before computing. No backend, no business-logic rewrite — purely a presentation filter on top of existing computations. Header in `AppLayout` gets a small Geo pill next to the currency toggle so the filter is discoverable from any page.

## 3. Files

New:
- `src/components/clients/analytics/AnalyticsKpiStrip.tsx`
- `src/components/clients/analytics/PortfolioByVsdTable.tsx`
- `src/components/clients/analytics/PortfolioByBopmTable.tsx`
- `src/components/clients/analytics/PortfolioByBuCapability.tsx`
- `src/components/clients/analytics/RetainerMixCard.tsx`
- `src/components/clients/analytics/GeoSplitCard.tsx`
- `src/components/clients/analytics/MrrDistributionTable.tsx`
- `src/components/clients/analytics/ClientsAnalyticsTab.tsx` (composes all bands)
- `src/contexts/GeoFilterContext.tsx`
- `src/components/layout/GeoFilter.tsx` (header pill)
- `src/lib/dealAnalytics.ts` (pure aggregation helpers: `groupBy`, `sumByDimension`, retainer/NR splits, geo bucketization)

Edited:
- `src/pages/Clients.tsx` — tab switcher, geo selector wired to context, render `ClientsAnalyticsTab`.
- `src/App.tsx` — wrap with `GeoFilterProvider`.
- `src/components/layout/AppLayout.tsx` — render `<GeoFilter />` next to currency toggle.
- `src/pages/Staffing.tsx`, `src/pages/Targets.tsx`, `src/pages/MBRTracker.tsx`, `src/pages/RGYHealth.tsx`, `src/pages/Home.tsx` — apply `useGeoFilter()` to their deal arrays.

## 4. Out of scope (call out)
- No new database fields. Deals already carry `geo`; rows where it's blank fall into "Other/Unspecified".
- No edit flows in Analytics — it's a read-only pivot surface. Editing stays in the existing Clients table tab.
- BOPM/Capability Leader persona view of Clients is unchanged (they already see a scoped subset; Analytics tab will respect `useDealAccess` and only aggregate visible deals).
- GM%/profitability columns will render as "—" until a margin source is wired in a later pass; the layout reserves the slot.
