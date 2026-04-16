

# RGY Health — Enhanced UI + Insights Sub-Tab

## What Changes

### Main Table Enhancements
1. **Blank option in RGY dropdown** — clicking an already-selected RGY value clears it back to "NA"/blank
2. **Green-gate validation** — changing from Y/R to G requires confirming all open deal_tasks tagged with `[RGY Health]` for that dimension are marked Done. A popup lists pending tasks with option to mark them done before allowing green.
3. **"All Green" in green font** — when a client has no R/Y, display "All Green" in `text-emerald-600`. If no RGY data exists at all, show blank/dash.
4. **RGY status filter** — add Red / Yellow / Green filter buttons alongside Pod filters to show only accounts matching that worst-case status
5. **Overall RGY dot per deal row** — a colored dot before the deal name showing the worst RGY across all dimensions (R > Y > G > NA)

### Insights Sub-Tab (new tab below main table)
Two tabs: **"Health Board"** (main table, current view) and **"Insights"**

The Insights tab contains:
1. **KPI row** — Total deals, Red/Hot-Red count, Yellow, Green, Churned (live from data)
2. **Critical Issues + Watch List** — actual issue text from `deal_rgy_weekly` (issue_details, issue_status = Open/In Progress) and related `deal_tasks` with `[RGY Health]` prefix
3. **Health Donut** — Recharts PieChart showing worst-RGY breakdown (R/Y/G) across deals with exact numbers
4. **Red count per dimension** — horizontal BarChart with absolute red counts per dimension
5. **Full Heatmap** — every account × every dimension, sorted by most red signals at top
6. **Top Risk Ranking** — pip dots showing red/yellow spread per account
7. **Service Line Health** — stacked bars showing R/Y/G mix per service line (SEO, Content, Copy, Design, Video, Supply)
8. **VSD Comparison** — grouped bar chart comparing red/yellow/green counts per VSD

## Implementation

### Files Modified/Created

| File | Change |
|------|--------|
| `src/pages/RGYHealth.tsx` | (1) Add blank/"NA" option when clicking already-selected value. (2) Green-gate dialog for Y/R→G transitions. (3) Green font for "All Green", blank when no data. (4) RGY status filter state + filter buttons. (5) Overall worst-RGY dot per row. (6) Tab switcher between "Health Board" and "Insights". |
| `src/components/rgy/RGYInsightsTab.tsx` | **New** — All 8 insight panels: KPI row, critical issues, health donut, red-per-dimension bar, full heatmap, risk ranking, service line health, VSD comparison. Uses Recharts for charts. |

### Key Details

- **Blank on re-click**: In `RGYCell`, if user clicks the option matching current value, set to `"NA"` instead
- **Green-gate**: When `handleRGYUpdate` is called with `newValue === "G"` and old value was R/Y, query `deal_tasks` for that deal with title starting `[RGY Health]` and `stage != "Done"`. If any exist, show a confirmation dialog listing them. User must mark them done or confirm override.
- **Worst RGY dot**: `const worstRGY = DIMENSIONS.map(d => deal[d.key]).includes("R") ? "R" : ... includes("Y") ? "Y" : allNA ? null : "G"`
- **Status filter**: New state `rgyFilter: "All" | "Red" | "Yellow" | "Green"`. Filter deals by their worst-RGY matching the selected filter.
- **Insights tab** receives `filteredDeals` and `deals` as props, computes all metrics client-side using `useMemo`
- **VSD comparison**: Group deals by VSD, compute worst-RGY per deal, tally R/Y/G per VSD

No database changes needed.

