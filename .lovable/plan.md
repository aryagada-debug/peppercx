

# Dashboard Overhaul: Bug Fixes, New Features & Code Quality

Implementing all 8 feature requests plus bug fixes and accessibility improvements from the master prompt.

---

## Phase 1: Types, Mock Data & Code Restructure

### New file: `src/types/dashboard.ts`
- Define `RGYStatus = "R" | "Y" | "G" | "NA"`
- Interfaces: `KPI` (with `isPositiveGood` boolean), `Alert` (with `id`, `actionLabel`, `actionHref`, icon as LucideIcon), `PodMember` (with `id`), `RGYRow` (with `id`, `bopm` field), `RGYDimension`

### New file: `src/data/dashboardMocks.ts`
- Move all static arrays (`kpis`, `alerts`, `podMembers`, `rgyData`, `rgyDimensions`) here
- Add stable `id` fields to every object
- Remove all `as const` casts — use typed `RGYStatus` values
- Add `actionLabel`/`actionHref` to alerts, `bopm` to RGY rows
- Add mock MBR history and Slack activity data for the drill-down panel

### New file: `src/components/dashboard/UtilizationBar.tsx`
- Extract from Index.tsx
- Fix color logic: `<60%` → red, `60-85%` → green, `>85%` → yellow
- Add legend below the pod table: `< 60% Under · 60-85% Optimal · > 85% Over`

---

## Phase 2: Bug Fixes in Existing Components

### `src/components/dashboard/MetricCard.tsx`
- Add `isPositiveGood?: boolean` prop (default `true`)
- Flip color logic when `isPositiveGood` is false (positive change → red, negative → green)

### `src/components/dashboard/RGYHeatmap.tsx`
- Update types to use `RGYStatus` from shared types
- Accept `onRowClick` callback prop for drill-down
- Make rows clickable (cursor-pointer, highlight on hover)
- Add `aria-label="RGY Deal Health Heatmap"` to table
- Wrap each cell in a shadcn `Tooltip` showing "Dimension · Status · Last updated: [date]"
- Add empty state: if data is empty, show centered "No deals to display for this period"
- Use stable `row.id` as key instead of array index

---

## Phase 3: New Features

### Feature 1 — Responsive Layout
- KPI row: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Alerts + Pod: `grid-cols-1 lg:grid-cols-3`
- Outer padding: `p-4 md:p-8`
- Utilization column: `min-w-[100px] max-w-[160px]`

### Feature 2 — Deal Drill-Down Side Panel
New file: `src/components/dashboard/DealDrawer.tsx`
- Uses shadcn `Sheet` (right side)
- Shows: Deal ID, client, BOPM, 4 RGY badges, mock MBR History (3 entries), mock Slack Activity (2 messages)
- Close button + "Open Full Deal →" link
- Triggered by `onRowClick` from RGYHeatmap

### Feature 3 — Actionable Alerts
- Each alert gets a "View →" link on the right
- Badge in page header showing total alert count with red dot

### Feature 4 — Date Range Selector
New file: `src/components/dashboard/DateRangeSelector.tsx`
- shadcn `Select` with last 6 months + current month
- Replaces hardcoded "March 2026" subtitle

### Feature 5 — Loading & Empty States
New file: `src/components/dashboard/DashboardSkeleton.tsx`
- Skeleton variants for KPI cards, alerts, pod table, heatmap
- `isLoading` state in page component

### Feature 6 — RGY Accessibility & Tooltips
- Already covered in RGYHeatmap changes above

### Feature 7 — Global Search (CMD+K)
New file: `src/components/dashboard/GlobalSearch.tsx`
- shadcn `CommandDialog` triggered by CMD+K
- Searches deal IDs, client names, BOPM names
- Results grouped: Deals, People
- Selecting a deal opens the drill-down panel
- Integrated into `AppLayout.tsx` header

### Feature 8 — Dark Mode Toggle
New file: `src/components/dashboard/ThemeToggle.tsx`
- Sun/moon icon button
- Persists to `localStorage`
- Toggles `dark` class on `<html>`
- Added to `AppLayout.tsx` header

---

## Phase 4: Page Rewrite

### `src/pages/Index.tsx` (under 80 lines)
- Import mock data from `dashboardMocks.ts`
- Import all extracted components
- Wire up state: `isLoading`, `selectedDeal`, `selectedMonth`
- Render: DateRangeSelector, alert badge, skeleton wrappers, DealDrawer

### `src/components/layout/AppLayout.tsx`
- Add header bar with GlobalSearch and ThemeToggle

---

## Accessibility (applied everywhere)
- `aria-label` on all icon-only buttons
- `aria-label="Pod Utilization"` on pod table
- `focus-visible` outlines on interactive elements
- Text labels always alongside color indicators

## Files Summary

| File | Action |
|------|--------|
| `src/types/dashboard.ts` | Create |
| `src/data/dashboardMocks.ts` | Create |
| `src/components/dashboard/UtilizationBar.tsx` | Create |
| `src/components/dashboard/DealDrawer.tsx` | Create |
| `src/components/dashboard/DateRangeSelector.tsx` | Create |
| `src/components/dashboard/DashboardSkeleton.tsx` | Create |
| `src/components/dashboard/GlobalSearch.tsx` | Create |
| `src/components/dashboard/ThemeToggle.tsx` | Create |
| `src/components/dashboard/MetricCard.tsx` | Modify |
| `src/components/dashboard/RGYHeatmap.tsx` | Modify |
| `src/components/layout/AppLayout.tsx` | Modify |
| `src/pages/Index.tsx` | Rewrite |

