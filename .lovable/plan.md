## 4 fixes

### 1. Home tab — assigned tasks not appearing

**Root cause** (verified against the DB): The filter in `src/pages/Home.tsx` builds a PostgREST `.or()` string like `assignee.ilike.sneha iyer,assignee.ilike.shashwat sood`. Names contain **spaces** (and assignees can contain commas), which break PostgREST's `or()` parser — so the query returns nothing for users like "Sneha Iyer". Their `staffing_person_id` is also null in `profiles`, so the email/staffing-name aliases add nothing.

**Fix** in `src/pages/Home.tsx`:

- Replace the fragile `.or(orFilter)` with a robust client-side match: fetch `deal_tasks` / `cx_tasks` filtered with `.in("assignee", aliasesWithOriginalCasing)` using all known name variants (display_name + staffing_people.name + email), then additionally filter in JS using the case-insensitive `matchesMe()` helper (which already exists). This avoids PostgREST `or()` quoting pitfalls.
- Also fetch `staffing_people` row by `email = user.email` as a fallback when `profiles.staffing_person_id` is null, so the alias set is populated even for users (like Sneha Iyer) who haven't been linked yet.

### 2. MBR Tracker — remove `%` above each dot in Month-on-Month

In `src/pages/MBRTracker.tsx` (around line 529–543), the **client header row** in the MoM table renders `{pct}%` above each month. Remove that `<td>` content (render an empty cell, or just the dot summary without the percentage). The per-deal `<StatusDot />` rows below stay as-is.

### 3. Hide Onboarding from the side panel

In `src/components/layout/AppSidebar.tsx`, remove the `onboarding` item from the `Health & Reviews` section (line 37). The `/onboarding` route in `App.tsx` and its route-visibility entry stay intact so direct URLs still work — just hidden from the sidebar. Delete it entirely

### 4. Sync Dashboard with live data

`src/pages/Index.tsx` is currently 100% mocks (`@/data/dashboardMocks`). Rewrite it to compute everything from Supabase tables already in use elsewhere:

- **KPIs** (Active Deals, Total MRR, Total Deal Value, Attainment): query `staffing_deals` filtered to active statuses (`Active Deal`, `New Deal in SLA/PO`, `Deal Disputed`); sum `mrr` and `total_deal_value`. Attainment = sum(`actuals`) / sum(`mrr`) for current month from `deal_revenue_monthly`.
- **Alerts** (replace static list):
  - Red RGY count → `deal_rgy_weekly` rows where any dimension = 'R' for current week.
  - MBRs overdue → `mbr_entries` with `status='Pending'` & `week_start` older than 35 days, joined to active deals.
  - Slack inactive channels → `slack_inactivity_nudges` from the last 7 days.
  - Unstaffed deals → active `staffing_deals` with no `staffing_assignments` rows.
- **Pod Utilization**: aggregate `staffing_weekly_allocations` by `person_id` for the current week → join `staffing_people` for name/role; "deals" = distinct `deal_id` count for that person; utilization = sum of `allocation_pct`.
- **RGY Heatmap**: latest `deal_rgy_weekly` per active deal, mapped onto the existing `RGYRow` shape so `RGYHeatmap` renders unchanged.
- Add a small loading skeleton (`DashboardSkeleton` already exists). `DealDrawer` keeps working since it consumes the same `RGYRow` shape.
- Delete `src/data/dashboardMocks.ts` only after verifying no other importers via `rg`.

### Files to edit

- `src/pages/Home.tsx` — robust assignee matching (no PostgREST `or` on names).
- `src/pages/MBRTracker.tsx` — remove `{pct}%` cell in MoM client header row.
- `src/components/layout/AppSidebar.tsx` — drop the Onboarding nav item.
- `src/pages/Index.tsx` — rewrite to use live Supabase queries; reuse `DashboardSkeleton`, `MetricCard`, `RGYHeatmap`, `UtilizationBar`, `DealDrawer`.
- (cleanup) `src/data/dashboardMocks.ts` — remove if no longer referenced.

No DB migrations required.