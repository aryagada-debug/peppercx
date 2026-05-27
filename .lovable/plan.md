# Weekly Compliance — Insights-first redesign

Replace the current dense table-by-default view with an **insights dashboard** where Central CX sees headline numbers first, then drills into details on demand.

## New layout (top → bottom)

**1. Week selector + Export** (unchanged compact strip)

**2. Headline insight band** — 3 large cards, click-to-drill
- **Compliance rate**: `compliant / total` as % + ring/bar. Sub-line: "X of Y deals updated by both VSD and BOPM this week."
- **At-risk deals**: count of "Not updated" deals. Sub-line: "No VSD or BOPM activity yet."
- **Reviewed – no change**: count. Sub-line: "Intentionally left unchanged."

Clicking any card opens the drill-down panel (below) pre-filtered to that segment.

**3. Breakdown strip** — 4 small tiles, also clickable
- VSD updated · VSD pending · BOPM updated · BOPM pending
Each shows count + % of active deals. Clicking filters drill-down by that role+status.

**4. Top offenders** (only shown when there are misses)
- "VSDs with most pending deals" — top 5 list with count badge
- "Pods with lowest compliance" — top 5 list with % badge
Clicking a row filters drill-down to that VSD/pod.

**5. Drill-down panel** — collapsed by default
- Header shows the active filter chips (e.g. "Not updated · VSD: Aman") with a "Clear" button.
- Expands to the existing detailed table (deal, VSD/BOPM status, last activity, mark-reviewed action).
- Search box lives inside the panel.
- Empty state when no segment is selected: "Click a metric above to see the deals behind it."

## Interaction model

- Single source of truth: `activeSegment` state = `{ kind: "all" | "compliant" | "partial" | "missing" | "reviewed" | "vsd-pending" | "bopm-pending", vsd?: string, pod?: string }`.
- Setting a segment auto-expands the drill-down panel and scrolls it into view.
- Export CSV always reflects the current segment (so CX can export "all at-risk deals" in one click).

## Files

- **Rewrite** `src/components/rgy/WeeklyComplianceTab.tsx` with the new layout. Keeps existing hook `useRgyWeeklyCompliance` and helpers — no data-layer changes.
- New small subcomponents inside the same file: `InsightCard`, `BreakdownTile`, `OffenderList`, `DrillDownPanel`.
- No changes to `useRgyWeeklyCompliance`, `rgyCompliance.ts`, `rgyHistory.ts`, `RGYHealth.tsx`, or DB.

## Out of scope

- Trend over multiple weeks (can be added later as a sparkline on the headline card).
- Email/Slack nudges to offenders.
- Editing role assignments.
