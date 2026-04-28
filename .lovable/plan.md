## Goal

Restructure the **MBR Tracker** and **RGY Health** pages so the existing summary view (KPIs + insights) and the deal table live in **separate tabs**, with redesigned KPI cards.

---

## RGY Health (`src/pages/RGYHealth.tsx`)

Currently has tabs `Health Board` (full table) and `Insights`. We will:

1. **Restructure tabs**: `Health Board` → `Insights` → `Table`.
  - **Health Board (1st tab)**: Keep redesigned KPIs + VSD filter only + the VSD/BOPM RGY summary table.
  - **Insights (3rd tab)**: unchanged contents, but uses redesigned KPIs (KPIs render above tabs so they stay shared).
  - **Table (2nd tab — NEW)**: contains the flat deal table that currently lives in `Health Board`. Inside this tab move:
    - VSD filter chips
    - Search box (clients/deals)
    - RGY status filter (Red / Yellow / Green / All)
    - "Show closed/completed" checkbox
    - Columns picker (same `Settings2` popover, kept inline next to filters — same alignment style as Health Board / Insights)
    - "Clear filters" button
2. **Column picker alignment**: Move the `Columns` button so it appears in the **same row as the tab triggers** (right-aligned beside `TabsList`), only shown when the `Table` tab is active. This keeps it consistent with where it lives across Health Board / Insights / Table tab switching.
3. **VSD filter on Tab 1 (Health Board)**: kept as today (single chip strip above the summary).

---

## MBR Tracker (`src/pages/MBRTracker.tsx`)

Currently has a top-level `Current` / `Month-on-Month` view toggle (not Radix tabs) and a single page. We will introduce real tabs:

1. **New top-level tabs**: `Insights` and `Table`. The existing `Current` / `Month-on-Month` toggle remains, but moves into the `Table` tab (it only affects the table view).
  - **Insights (1st tab)**: KPIs (redesigned) + VSD filter + VSD/BOPM Insights summary table. No search / month picker / table.
  - **Table (2nd tab)**: VSD filter + Search + Month picker (Current view) + Current / MoM toggle + "Show closed" + Clear filters + the existing deal table (Current or MoM).
2. **VSD filter on Tab 1 (Insights)**: kept as today.
3. KPIs render above tabs so both tabs share them.

---

## KPI Card Redesign (shared change)

Update the KPI strips on **both** pages so each card has:

- A soft tinted background (semantic color: positive/warning/destructive/primary/muted) — flat, no gradients/shadows (matches design-system memory).
- A leading **lucide icon** in a small rounded square.
- A slightly **larger value font** and a shorter label (e.g. "Retainer Accounts" → "Retainers", "Yellow Warnings" → "Yellow", "Green (Healthy)" → "Green", "Portfolio Score" → "Score") — short but still readable.
- Tighter padding, two font weights only (Regular + Medium), in line with project memory.

Implementation: introduce a small local component (e.g. `KpiTile`) inside each page (or a shared `src/components/dashboard/KpiTile.tsx`) so we don't disturb the existing `MetricCard` used elsewhere. Mapping:

**MBR KPIs**: Retainers (Users), Done (CheckCircle2, positive bg), Not Done (XCircle, destructive bg), Pending (Clock, warning bg), Compliance (Gauge, primary bg).

**RGY KPIs**: Red (AlertTriangle, destructive bg), Yellow (AlertCircle, warning bg), Green (CheckCircle2, positive bg), Score (Activity, primary bg).

---

## Files to edit

- `src/pages/RGYHealth.tsx` — restructure tabs (add `Table` tab), move table + table-scoped filters + columns picker into it, keep VSD filter on Health Board, swap `MetricCard` for new KPI tile.
- `src/pages/MBRTracker.tsx` — wrap content in `Tabs` (`Insights` / `Table`), move search/month/MoM toggle/table into `Table` tab, keep VSD filter + insights table on `Insights` tab, swap `MetricCard` for new KPI tile.
- (Optional) `src/components/dashboard/KpiTile.tsx` — shared redesigned KPI card.

No data, hook, or routing changes. No DB changes.