## Goal

Revamp the **Month-on-Month** view in MBR Tracker so it reads like the Current table (one row per deal — no nested client/deal grouping), replace the colored status dots with explicit "Done / Pending" labels (with a sentiment dot next to "Done"), and add a **Trend Insights** view that summarizes signals across all MBRs over time.

## Changes

### 1. Flatten the Month-on-Month table (src/pages/MBRTracker.tsx)

Replace the current grouped client → deal block (lines ~700–778) with a single flat table mirroring the Current view's column structure:

- Columns: **Account**, **Deal**, **VSD**, **Sr. BOPM**, **MRR** (sticky-left identity columns), then one column per month in `availableMonths`.
- One row per deal (use `tableRows` / filtered deals — same filter pipeline as Current view, so VSD/BOPM/search/showClosed all apply).
- Remove the "Client header" aggregate row and the indented deal rows.
- Keep month-cell click → opens `MBRDetailDialog` for that deal/entry.

### 2. Replace dots with Done / Pending pills + sentiment dot

In each month cell, render based on `entry.status`:

- **Done** → small green "Done" pill + a sentiment dot to its right (Green/Yellow/Red from `entry.sentiment`, grey if missing).
- **Not Done** → red "Not Done" pill (no sentiment dot).
- **Not Required** → muted "N/R" pill.
- **Pending / no entry** → amber "Pending" pill.

Update the legend strip at the bottom to show the new pill styles + an explanation that the dot beside "Done" is the client sentiment.

### 3. Add Trend (Insights) view

Add a third toggle button next to `Current` / `Month-on-Month` called **Trend** (icon: `TrendingUp` from lucide). New `viewMode` value `"trend"`.

The Trend panel shows insights computed from `allEntries` (all months, respecting the active VSD/BOPM/search filters) in a single scrollable card grid:

- **Compliance over time**: small line/area chart of % MBRs Done per month (last 12 months) using Recharts (already a project dep per memory).
- **Sentiment mix over time**: stacked bar per month (Green / Yellow / Red counts) from `entry.sentiment` on Done MBRs.
- **Top decliners**: deals whose sentiment shifted Green→Yellow or Yellow→Red across the last 2 recorded months (table: Deal, VSD, Prev → Now).
- **Most consistent (Green streaks)**: deals with ≥3 consecutive Green-sentiment Done MBRs.
- **Chronic skippers**: deals with the most "Not Done" or missing-entry months in the last 6 months.
- **Action items pulse**: total open vs done action items across all entries (`action_items` jsonb already on `MBREntry`), plus top 5 oldest open items with deal + owner + deadline.

All sections honor the existing VSD + BOPM + search filters so the user can scope insights.

### 4. Plumbing

- Reuse existing `entriesByMonth`, `availableMonths`, `allEntries` from `useMBRData`.
- Compute the trend aggregates inside `MBRTracker.tsx` with `useMemo` (no new hook needed) — keeps changes scoped to one file.
- No DB schema changes.

## Files Edited

- `src/pages/MBRTracker.tsx` — flatten MoM table, swap dots → pills + sentiment dot, add `Trend` toggle + new view section.

## Files NOT Touched

- `src/hooks/useMBRData.ts` — already exposes everything needed.
- No migrations.