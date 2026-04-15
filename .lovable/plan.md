

# MBR Tracker — RGY Health-Style UI with Filters, Search, and VSD Insights Table

## What Changes

Redesign the MBR Tracker page to match the RGY Health page layout:
- Replace the current tab-based layout with a single unified view
- Add Pod filter tabs (All, Integrated, India B2B, US B2B, FMCG, BFSI, Unassigned)
- Add search bar for filtering by client/deal name
- Add "Show closed/completed" checkbox
- Add Expand All / Collapse All toggle
- Group deals by client (same accordion pattern as RGY Health)
- Add KPI strip at the top (Retainer Accounts, Done, Not Done, Pending, Portfolio Compliance)
- Add a consolidated **VSD Insights table** below the main deal table showing per-VSD metrics (accounts, done/not done/pending counts, sentiment breakdown, scheduling compliance)

The week selector stays in the header. The Deal Tracker tab content becomes the main view but restructured as a client-grouped accordion. The VSD Summary and History tabs are removed as separate tabs — the VSD data becomes the insights table below.

## Implementation

### `src/pages/MBRTracker.tsx` — Full Rewrite

1. **Remove Tabs** — single-page layout like RGY Health
2. **Add filter state**: `activePod`, `search`, `showClosed`, `expandedClients` (same as RGY Health)
3. **Pod filter bar** — reuse the same Pod list and `getPodForDeal()` logic from RGY Health
4. **Search input** — filter by account or deal name
5. **Client-grouped accordion table** — group deals by account, show MBR status, sentiment, scheduled date per deal row. Click to open MBRDetailDialog.
6. **KPI strip** — Done, Not Done, Pending, Retainer Accounts, Compliance %
7. **VSD Insights table** — below the main table, show per-VSD row with: VSD name, # accounts, # done, # not done, # pending, green/yellow/red sentiment counts, scheduling compliance ratio

### Files Modified

| File | Change |
|------|--------|
| `src/pages/MBRTracker.tsx` | Rewrite to match RGY Health layout with filters, search, client grouping, and VSD insights table below |

No database changes needed — all data already exists in `mbr_entries` and `staffing_deals`.

