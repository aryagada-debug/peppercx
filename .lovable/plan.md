# Flat Filterable Tables — Rollout Plan

## Goal
Replace collapsible/grouped list views across the app with **flat, fully-visible tables** featuring **Excel-style per-column header filters** and an **optional Group-by toggle**.

## 1. Build shared primitives (foundation)

**`src/components/data-table/DataTable.tsx`** — generic flat table with:
- Sticky header row, dense rows, horizontal scroll on overflow
- Sortable columns (click header)
- Excel-style filter icon on each filterable column header → popover with:
  - Search box, Select-all / Clear, multi-select checklist of unique values
  - Active filters show a filled icon + count badge
- Optional **Group-by** toggle in the toolbar (dropdown to pick a grouping column). When active, rows are grouped under sticky sub-headers; when off, fully flat.
- Optional row click handler (for drill-ins)

**`src/components/data-table/useTableFilters.ts`** — hook managing column filter state, sorting, and grouping; returns the filtered/sorted/grouped row set.

These two files become the standard for every list view.

## 2. Migrate list views (one-by-one)

### 2a. Clients & Deals (`src/pages/Clients.tsx`)
- Currently expandable client cards with deals inside.
- New: **one row per deal**. Columns: Account, Deal Name, Deal ID, PC Code, Deal Type, MRR, Total Value, Start, End, VSD, Pod, RAG, Status.
- Filterable: Account, Deal Type, VSD, Pod, RAG, Status, Pepper BU.
- Group-by: Account (default off). Row click → Deal Detail page.

### 2b. RGY Health (`src/pages/RGYHealth.tsx`)
- Flat weekly RGY rows. Columns: Account, Deal, Week, Internal, Customer, Delivery, Consumption, Account Health, Finance, SEO Cap, Creative Cap, Issue Status, VSD, Pod.
- Filterable: Account, VSD, Pod, all RGY dimensions, Issue Status, Week.
- Group-by: Account / VSD / Pod.

### 2c. MBR Tracker (`src/pages/MBRTracker.tsx`)
- Columns: Account, Deal, Week, Status, Mode, Scheduled, Sentiment, Anirudh Joining, Updated By, Updated At.
- Filterable: Account, Status, Mode, Sentiment, VSD, Pod, Week.
- Group-by: Account / VSD / Status.

### 2d. Staffing — Deal-Level (`src/components/staffing/DealLevelView.tsx`)
- Per-deal-per-role rows. Columns: Account, Deal, Role, Person, Allocation %, MRR, Pod, Region, Capability, Recommended %, Variance.
- Filterable: Account, Pod, Region, Capability, Role, Person.

### 2e. Staffing — People-Level (`src/components/staffing/PeopleLevelView.tsx`)
- Flatten the reporting tree into a flat people table.
- Columns: Name, Role Title, Department, Designation, Band, Pod, Region, Reporting Manager, Total Allocation %, TBH/Leaving.
- Filterable: Pod, Region, Department, Designation, Band, Reporting Manager, TBH, Leaving.

### 2f. Other list views (same pattern)
- Revenue, Targets, Onboarding, Slack Health, Central Cx list (`CxListView.tsx`), Settings → Users.

## 3. Conventions
- Preserve all existing row actions (drill-in dialogs, edit drawers, status pills, RGY dots).
- Keep current semantic colors and density.
- Numbers right-aligned; dates ISO-short; long text truncated with tooltip.
- Filter state in component state (no URL sync in v1).
- Group-by **off by default**.

## 4. Out of scope
- URL-persisted filter state, saved views, server-side pagination.

## 5. Execution order
1. Build `DataTable` + `useTableFilters`.
2. Migrate **Clients & Deals** first (validate the pattern).
3. Then RGY Health, MBR Tracker, Staffing Deal-Level, Staffing People-Level.
4. Finish with Revenue, Targets, Onboarding, Slack Health, Central Cx, Users.

After step 2 you can sanity-check before we sweep the remaining pages.
