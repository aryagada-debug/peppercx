

# Comprehensive Staffing, Capacity & Data Overhaul

## Summary

This plan addresses 10 interconnected issues: fixing deal status display, active/closed filtering, pod assignment gaps, staffing data sync from Google Sheet, SOW team-revenue mapping, Settings-based MRR capacity editing, staffing capacity metrics (target vs actual revenue + time utilization), reporting structure from referenced projects, and a complete deal-level staffing view redesign.

---

## Phase 1 — Data Fixes (Database Migrations + SQL Updates)

### 1A. Fix Deal Status Display
**Problem**: The `deal_status_cx` field still shows old values like "Deal - Open and WIP" while `deal_status` has the correct values from the sheet. The Clients page status dropdown uses `deal_status_cx` with old options ("Active", "Paused", "Closed", etc.) instead of the 5 canonical statuses.

**Fix**:
- SQL migration to sync `deal_status_cx` FROM `deal_status` for all records
- Update `DEAL_STATUSES` constant in `Clients.tsx` to use the 5 canonical values: `Active Deal`, `Deal Completed Successfully`, `Deal Churned / Lost`, `Deal Disputed`, `New Deal in SLA/PO`
- Make the status dropdown use `deal_status` (the canonical field) consistently

### 1B. Active vs Closed Filtering
**Problem**: Current filter logic checks `dealStatusCx !== "Closed"` which doesn't match the canonical statuses.

**Fix**:
- "Active deals" (default view) = `Active Deal` + `Deal Disputed` + `New Deal in SLA/PO`
- "Closed deals" (shown when toggled) = `Deal Completed Successfully` + `Deal Churned / Lost`
- Update `showClosed` toggle label to "Show closed/completed"
- Update KPI "Active Deals" count to match this logic

### 1C. Fix Pod Assignments
**Problem**: 135 out of 333 Active Deals have empty `pod`. The VSD-to-pod mapping was applied with short names that didn't match all VSD values.

**Fix**:
- SQL update to map pods based on VSD name patterns — any deal where VSD contains "Sneha" → FMCG, "Aamir" → Integrated, "Neema" → US B2B, "Sumit" → India B2B, "Aditya Shaw" → BFSI
- Also map pods based on deals assigned to people who report to these VSDs (by checking `staffing_people.reporting_manager`)

---

## Phase 2 — Staffing Data Sync from Sheet

### 2A. Re-fetch Google Sheet & Update Team Assignments
- Re-access the Google Sheet "1.0 Deal Level Mapping" tab
- Extract ALL team columns (VSD, Principal BOPM, Senior BOPM, BOPM, Content Lead, SEO Manager, etc.) with their allocation percentages
- Create/update `staffing_assignments` records to match the sheet data
- Ensure every person referenced exists in `staffing_people`

### 2B. Connect Deal Staffing to Staffing & Capacity View
- The Staffing page already reads from the same `useStaffingData` hook, so assignments created/updated in Deal Detail already reflect in the Staffing view
- Verify this works end-to-end; if there's a caching issue, add a `refresh()` call after assignment changes in Deal Detail

---

## Phase 3 — SOW Team-Revenue Mapping

### 3A. Enhance `deal_sow_items` Table
- Add columns: `teams` (jsonb — array of team names: Account Management, Content, SEO, Creative), `line_item_value` (numeric — deal amount for this line item)
- Migration to alter the existing table

### 3B. Update SOW UI in Deal Detail
- When adding/creating a SOW line item, add:
  - Multi-select checkboxes for teams (Account Management, Content, SEO, Creative)
  - Numeric input for line item deal value (₹)
- Display team badges and value per line item in the SOW table
- This maps revenue to teams per deal, enabling team-level revenue reporting

---

## Phase 4 — Settings: MRR Capacity Configuration

### 4A. Make Settings Tab Functional
- Replace hardcoded users array with data from `staffing_people`
- Add a new sub-tab: **"Revenue Capacity"** under Settings
- This tab shows an editable table of `staffing_revenue_targets` — role/designation vs target MRR capacity per person
- Allow inline editing of target values
- Add a **"People & Reporting"** sub-tab that allows editing reporting manager for each person

### 4B. Reporting Manager Editor
- Show people grouped by department with editable reporting manager dropdowns
- Changes persist to `staffing_people.reporting_manager`
- The People-Level view hierarchy updates automatically since it already reads `reportingManager`

---

## Phase 5 — Staffing & Capacity View Overhaul

### 5A. Two Core Metrics
1. **Target vs Actual Revenue**: For each person, show target MRR capacity (from `staffing_revenue_targets` by their designation) vs actual MRR managed (sum of `deal.mrr × assignment.allocationPct` for active deals only)
2. **Time Utilization**: 160 hours/month base. Show hours allocated per deal and total utilization percentage

### 5B. Deal-Level View Redesign
The current deal-level view is a basic expandable table. Redesign to show:
- Card-based or enhanced table layout grouped by pod/VSD
- For each deal: status badge, MRR, team members with allocation bars
- Quick-add member capability
- Filter by active deals only by default
- Revenue mapped per team (from SOW team mapping)
- Visual indicators for staffing gaps (missing roles)

### 5C. People-Level View Enhancement
- Add revenue column: target vs actual with progress bar
- Add hours column: allocated hours vs 160 with progress bar
- Maintain the reporting hierarchy tree

### 5D. Only Map Capacity for Active Deals
- Filter assignments to only count deals with status `Active Deal`, `Deal Disputed`, or `New Deal in SLA/PO` when computing utilization and revenue metrics

---

## Phase 6 — Reporting Structure from Referenced Projects

### 6A. Reference Content Capability App
- The Content Capability App has a similar staffing model with VSD options, bandwidth rules by region/MRR tier, and content lead/editor hierarchy
- Port the BW rules logic pattern (leader/principal/manager percentages by MRR tier and region)

### 6B. Build Proper Hierarchy
- Use `reportingManager` field to build a multi-level tree: VSD → Principal BOPM → Senior BOPM → BOPM
- The People-Level view already does this partially — enhance to support full depth
- Settings tab allows editing reporting relationships

---

## Files to Create/Modify

| File | Change |
|------|--------|
| **Database** | Migration: sync `deal_status_cx`, fix pods, add SOW columns |
| `src/pages/Clients.tsx` | Fix status options, active/closed filter logic |
| `src/pages/Settings.tsx` | Full rebuild: People/Reporting tab, Revenue Capacity tab |
| `src/pages/Staffing.tsx` | Active-only filter default, pass revenue targets |
| `src/components/staffing/DealLevelView.tsx` | Complete redesign with pod grouping, capacity metrics |
| `src/components/staffing/PeopleLevelView.tsx` | Add revenue & hours columns |
| `src/components/staffing/CapacityTab.tsx` | Add target vs actual revenue, hours utilization |
| `src/pages/DealDetail.tsx` | SOW section: team checkboxes + line item value |
| `src/hooks/useStaffingData.ts` | Active-deal filtering helper, revenue target CRUD |

---

## Implementation Order

1. Database migrations (status sync, pod fix, SOW columns)
2. Clients page status/filter fixes
3. SOW team-revenue mapping UI
4. Settings page rebuild (people, reporting, revenue capacity)
5. Staffing view overhaul (deal + people views with new metrics)
6. Data re-sync from Google Sheet for team assignments

