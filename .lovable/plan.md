# Pulse / NPS Analytics

Add a single analytics view that turns `survey_invites` + `survey_responses` data into one rollup table, controlled by a **Group By** filter at the top.

## Route & nav
- New route `/pulse-nps/analytics` (page `src/pages/PulseNPSAnalytics.tsx`), wrapped in `AppLayout`, gated by `rgy-health` route key like `PulseNPS`.
- Tab strip at the top of `PulseNPS` and the new page: **Send** | **Analytics** (no new sidebar item).

## Filters (top bar)
- **Group by** (single-select, drives the table dimension): VSD · BOPM · Deal · Capability. Default: VSD.
- Date range (presets: 30d / 90d / QTD / YTD / All; default 90d).
- VSD chips (All / specific / Other / Unassigned) — same component as `PulseSurveyTab`.
- BOPM filter scoped to selected VSDs.
- Capability multi-select (from `normalize_staffing_role_key`).
- Deal search + "Include closed" toggle.
- All filters apply before grouping.

## KPI strip
Invites Sent · Opened · Completed · Response % · **NPS** (9–10 promoter, 7–8 passive, 0–6 detractor) · **Avg CSAT** · **Avg CES** · Renewal intent mix · Churn-risk mix.

## Single results table (re-pivots by Group By)
Columns common to every grouping:
- Group label (VSD / BOPM name / Deal / Capability)
- Sent, Completed, Response %
- NPS, Avg CSAT, Avg CES
- Promoters / Passives / Detractors
- Churn-risk High count
- Last response date

Per-column sort + filter (same UX as Contacts → Insights). Row click → drawer with the underlying responses (recipient, deal, NPS, CSAT, CES, mood, churn risk, comments from `payload`, submitted_at).

Bar chart above the table showing NPS by current group (top 15).

## Data layer
- Single query: `survey_responses` joined to `survey_invites` (for VSD/BOPM/account/deal snapshots), filtered by date + `visible_deal_ids_for_user`.
- For Capability grouping, expand each response into one row per capability via `staffing_assignments` + `normalize_staffing_role_key` (a response with multiple capabilities counts for each).
- For BOPM grouping, split snapshot fields on `,` / `/` and normalize via `_norm_name`; a toggle picks tier (Principal / Senior / BOPM / Any).
- All aggregation done client-side with `useMemo`; React Query key `["pulse-analytics", filters]`.
- Lazy-load — only fetch when Analytics tab is active.

## Export
"Export CSV" button — flattens the current grouped table with applied filters.

## Empty / loading
Skeleton rows during fetch. Empty card: "No survey responses yet for these filters" + link back to Send tab.

## Technical details
- Files: `src/pages/PulseNPSAnalytics.tsx`, `src/components/pulse/AnalyticsKpis.tsx`, `src/components/pulse/AnalyticsTable.tsx`, `src/components/pulse/useAnalyticsData.ts`.
- Reuse `BopmFilter`, VSD chip filter, and column sort/filter primitives.
- Charts: Recharts.
- Route added in `src/App.tsx`; tab strip added in `PulseNPS.tsx`. No schema changes.
