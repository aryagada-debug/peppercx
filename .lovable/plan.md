

# Multi-Feature Build Plan

This covers 5 areas: **(1) Roles & Access Control**, **(2) RGY Health enhancements**, **(3) MBR Tracker tweaks**, **(4) Editable weekly Staffing**, **(5) AI-powered SoW Excel import**.

Given the scope, I recommend implementing in **3 phases** (each phase = one approval cycle) so each piece is testable before stacking the next.

---

## PHASE 1 — Roles, Access Control & RGY/MBR Improvements

### 1A. User Roles & Access Control

**Schema changes (migration):**
- Create `app_role` enum: `'admin' | 'vsd'`
- Create `user_roles` table (`id`, `user_id` → auth.users, `role`, `unique(user_id, role)`)
- Create `route_visibility` table (`role`, `route_key`, `visible bool`) — seeded with VSD = visible only for `clients`, `rgy-health`, `mbr-tracker`; admin = all visible
- Security definer function `has_role(_user_id, _role)` (avoids RLS recursion)
- RLS: users read own role; only admins write `user_roles` and `route_visibility`
- Trigger: on first signup, auto-assign `vsd` role (default)

**Frontend:**
- New hook `useUserRole()` — returns `{ role, visibleRoutes, isAdmin }`
- `AppSidebar.tsx` — filter nav items by `visibleRoutes`
- `ProtectedRoute.tsx` — block route render if `!visibleRoutes.includes(routeKey)` → redirect to `/clients`
- `Settings.tsx` — add two new tabs:
  - **Users & Roles**: list all users (display_name, email, role, signup date), buttons to: promote/demote admin, send password reset email (`supabase.auth.resetPasswordForEmail`), delete user (admin-only edge function calling `auth.admin.deleteUser`)
  - **Access Controls**: matrix of routes × roles with toggles; saves to `route_visibility`
- Edge function `admin-user-mgmt` for delete (uses service role key, verifies caller is admin)

### 1B. RGY Health enhancements

**`RGYInsightsTab.tsx` rewrite:**
1. **Active Issues**: filter to selected POD only; add timestamp (uses `issue_date` + `created_at`); compute days-open; flag badge if Red >10 days or Yellow >15 days (red `AlertTriangle` icon + "10+ days open")
2. **Per-team counts**: rename "Red Count per Dimension" → "Red Count per Team"; add a parallel "Yellow Count per Team" chart; bars clickable → opens dialog listing accounts/deals + summary (account name, deal name, deal_id, issue_details)
3. **Heatmap**: add columns Account, Deal Name, Deal ID before the dimension cells
4. **Remove** Top Risk Ranking section entirely
5. **Health Comparison (VSD)**: ignore the POD filter — always show all 5 VSDs; bars clickable → dialog with R/Y/G tabs listing deals
6. **New insights**: add (a) "Avg days to resolution" KPI, (b) "Aging Issues" panel (open issues sorted by days-open with flag indicators), (c) "Trend: Red dimensions this week vs last week" mini sparkline

**Issue Tracker form (`RGYIssueFormDialog`):**
- Remove "Discussed Action Plan" textarea; keep only "Action Plan"
- Update DB write to stop populating `discussed_action_plan` (column stays for legacy data)

### 1C. MBR Tracker tweaks

**`MBRTracker.tsx`:**
- Move `vsdInsights` block from bottom to immediately under KPI strip (above filters)
- In each row's action area, add split button: **"Schedule Only"** (opens lightweight dialog with just scheduled_date + next MBR fields) vs existing **"Record MBR"** (full dialog)

### Files (Phase 1)
- migration: roles, route_visibility, RLS, trigger
- new: `src/hooks/useUserRole.ts`, `src/pages/admin/UsersTab.tsx`, `src/pages/admin/AccessControlsTab.tsx`, `src/components/mbr/ScheduleOnlyDialog.tsx`, `src/components/rgy/TeamCountDrillDialog.tsx`, `src/components/rgy/VSDDrillDialog.tsx`, `supabase/functions/admin-user-mgmt/index.ts`
- edited: `AppSidebar.tsx`, `ProtectedRoute.tsx`, `Settings.tsx`, `RGYInsightsTab.tsx`, `RGYHealth.tsx` (RGYIssueFormDialog), `MBRTracker.tsx`

---

## PHASE 2 — Weekly Editable Staffing

**Schema:**
- New table `staffing_weekly_allocations` (`id`, `deal_id`, `person_id`, `week_start date`, `allocation_pct numeric`, `actual_hours numeric default 0`, unique on `(deal_id, person_id, week_start)`)
- Backfill: seed from current `staffing_assignments` × past N weeks at flat allocation

**UI:** New `WeeklyStaffingGrid.tsx` in Deal Detail → Staffing tab
- Rows = people, Columns = weeks (last 12 / next 12 toggle), Cells = editable allocation %
- Auto-computes: hours = (% / 100) × 40h/week per cell; monthly rollup row showing total person-hours per month
- "Add person" / remove row controls; bulk-paste support

### Files (Phase 2)
- migration + new component `src/components/deals/WeeklyStaffingGrid.tsx`, hook `useWeeklyStaffing.ts`
- edited: `DealDetail.tsx` Staffing tab

---

## PHASE 3 — AI-Powered SoW Excel Import

**Backend:**
- Edge function `parse-sow-excel` — receives uploaded .xlsx (base64), uses SheetJS to read all sheets to JSON, calls Lovable AI Gateway (`google/gemini-2.5-pro`) with tool-calling schema to extract line items: `[{ scope, team_capability, revenue_share, line_item_value, suggested_teams[] }]`

**Frontend:** New `SoWImportDialog.tsx` in Deal Detail → SoW tab
- Step 1: file dropzone (.xlsx)
- Step 2: AI-parsed preview table — user reviews, edits, assigns teams from existing capability options
- Step 3: confirm → bulk insert into `deal_sow_items`

### Files (Phase 3)
- new: `supabase/functions/parse-sow-excel/index.ts`, `src/components/deals/SoWImportDialog.tsx`
- edited: `DealDetail.tsx` SoW tab (add "Import from Excel" button)

---

## Phase rollout

After you approve, I'll implement **Phase 1 first**, you test, then we move to Phase 2, then Phase 3. This keeps each change reviewable. If you'd rather I do all three in one shot, say "do all phases" on approval.

