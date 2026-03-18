

# Staffing & Capacity Module Overhaul

This is a large restructuring of the Staffing page into 6 sub-tabs (matching the Kindred Companion project structure) plus several data/filter enhancements.

## What Changes

### 1. Restructure Staffing page into 6 sub-tabs
Replace the current 2-view toggle ("Deal-Level Staffing" / "People by Role") with a tabbed layout matching the reference image:

**Summary** | **Accounts** | **People** | **BW Rules** | **Capacity** | **Hiring Gap** + **Revenue Capacity**

Each tab becomes its own component section within `Staffing.tsx` (or extracted to separate files to manage size).

### 2. Filters for Designation, Band, Reporting Manager (Points 1)
- **People tab**: Add 3 dropdown filters above the people table — Designation, Band, Reporting Manager — that filter the displayed list
- **Accounts tab (Deal-Level Staffing)**: Add the same 3 filters that filter deals based on the assigned people matching those criteria

### 3. Remove VSD column from Accounts tab (Point 2)
Remove the standalone "VSD" text column from the deal-level staffing table (it's already a staffable role slot via the Operations > VSD column in ROLE_SLOTS).

### 4. Add financial columns to Accounts tab (Point 3)
Add new fields to the `Deal` interface and populate from existing data:
- `mrr` (number)
- `duration` (string, e.g. "12 months")
- `retainerDealValue` (number)
- `nonRetainerDealValue` (number)
- `totalDealValue` (number)

Display these as new columns in the Accounts table after the Account column.

### 5. Deal Analytics View (Point 4)
New **Summary** tab content that shows a "Staffing & Validation" analysis:
- Segments deals by VSD, showing which deals are missing updates (unstaffed roles, missing allocation %, missing financial data)
- Clicking a VSD expands to show their deals with red/yellow/green indicators for completeness
- A person-level search/filter lets the user see analytics for any individual person — which deals they're on, what's missing, and what needs updating
- Highlights: "X deals have no BOPM assigned", "Y deals have 0% allocation", "Z deals missing MRR data"

### 6. Full tab structure mirroring Kindred Companion (Point 5)

**Summary tab**: KPI cards (Total MRR, Team Size, Active Deals, Staffing Gaps, Leaving Impact), VSD breakdown cards, team utilization heatmap, staffing gaps list — all adapted from Kindred Companion's `SummaryTab`

**Accounts tab**: Current deal-level staffing table with the VSD column removed, financial columns added, and the existing role-slot assignment grid

**People tab**: Current "People by Role" view with added Designation/Band/Reporting Manager filters

**BW Rules tab**: Editable bandwidth guideline rules table (by region × MRR tier), showing recommended allocation % per role type. Adapted from Kindred Companion's `BWRulesTab`

**Capacity tab**: Per-person utilization table with BW Used bars, # Deals, MRR capacity, MRR fill %. Expandable rows showing account-level splits. Pod-level capacity summary grid. Adapted from Kindred Companion's `CapacityTab`

**Hiring Gap tab**: Priority-ranked hiring plan table (Critical/High/Medium) with role, pod, target date, rationale. Editable rows for adding new hiring needs

**Revenue Capacity tab** (new, Point 5 last part): Input fields per role type for "how much revenue capacity (deal value) each person by role type should own". Shows:
- A table of role types with an editable "Target Deal Value per Person" input
- Current actual: total deal value assigned ÷ number of people in that role
- Delta: target vs actual, color-coded (green if within range, red if over/under)
- Drill-down per person showing their actual deal value load vs the target

### Files to modify/create
- `src/data/staffingData.ts` — Extend `Deal` interface with financial fields, add default financial data, add BW rules defaults, add hiring plan defaults
- `src/pages/Staffing.tsx` — Major restructure: 7 sub-tabs, new filter dropdowns, Summary/BW Rules/Capacity/Hiring Gap/Revenue Capacity sections
- Potentially extract tab components into `src/components/staffing/` folder if file gets too large

### UI Style
Follow the existing project's dark theme with Tailwind classes (not inline styles like Kindred Companion). Use the existing `data-card`, `text-ui`, `text-caption`, badge patterns already established in the codebase.

