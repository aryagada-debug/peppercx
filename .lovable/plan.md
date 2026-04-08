

# Replace Staffing Page with Unified SEO + Content + Ops Staffing System

## Overview

Replace the current 6-tab Staffing page with a new unified system that merges the best features from:
- **Kindred Companion** (SEO staffing: pod-based with Leader/Principal/Manager hierarchy, BW rules, capacity heatmaps)
- **Content Capability App** (Content staffing: VSD-based with Content Lead/Editor Fixed/Editor Freelance, multi-VSD assignments)
- **Current project** (Database-backed with 10 role categories, 30+ role slots, 500+ deals from DB)

The new page adds: Edit/Publish mode toggle, pod/VSD-level capacity cards, BW rules configuration, per-capability utilization views, and a KPI strip header.

## Architecture

The current project already has the right data model (deals, people, assignments in DB). The two external apps use local state with hardcoded data. We will:

1. Keep the existing DB tables and hooks entirely
2. Rebuild the Staffing page UI to incorporate the best patterns from both apps
3. Add a **capability switcher** (All / SEO / Content / Creative / Ops) that filters the view
4. Add the missing UI features from both apps

## Key Features to Add

### 1. Edit/Publish Mode Toggle
- A lock/unlock button at the top (green = Published/read-only, amber = Edit mode)
- When published, all dropdowns/inputs become read-only text
- Matches the pattern from both external apps

### 2. KPI Strip Header
- Sticky top bar showing: Total MRR, ARR, Team size, TBH count, Staffing gaps, Replacement-needed count
- Filters dynamically based on active capability view

### 3. Enhanced Accounts Tab
- **RAG dot** per account (green/amber/red) with click-to-change
- **Staffing status** column showing "Staffed / Gap / Replace" with color coding
- **Team chips** in compact row, expandable drawer for full assignment management
- **BW guideline** shown in expanded view per account
- **Add Account form** inline (when in edit mode)
- VSD + Pod + Region + RAG + Staffing status filters

### 4. Enhanced Capacity Tab
- **Summary cards**: Overloaded (>100%), Near Full (85-100%), Healthy (30-85%), Under-utilised (<30%)
- **Utilization table** grouped by role level with expandable per-person account splits
- **Pod/VSD-level capacity cards** showing team breakdown with inline utilization bars
- **MRR capacity benchmarks** per role/region with fill % column

### 5. BW Rules Tab (New)
- Editable bandwidth allocation guidelines table
- Grouped by region (US/India) with MRR tier rows
- Columns per role type (varies by capability: Leader/Principal/Manager for SEO, Content Lead/Editor Fixed/Editor Freelance for Content)
- Click-to-edit percentage values
- Stored in a new `staffing_bw_rules` DB table

### 6. Enhanced Hiring Gap Tab
- Leaving people panel + TBH placeholders panel (side by side)
- Replacement-needed accounts with affected role badges
- FTE gap analysis cards per role level
- Unstaffed active accounts list

### 7. Enhanced People Tab
- TBH placeholder banner at top (collapsible)
- Add forms: team member + TBH placeholder (in edit mode)
- Leaving/Active toggle per person
- Multi-VSD assignment for Content Leads
- Cost-to-ARR ratio display

## Database Changes

### New table: `staffing_bw_rules`
```text
staffing_bw_rules
├── id (uuid, PK)
├── capability (text: SEO / Content / Creative)
├── region (text: US / India)
├── mrr_tier_label (text: "< 1.5L", "1.5-3L", etc.)
├── mrr_min (numeric)
├── mrr_max (numeric)
├── role_key (text: leader, principal, manager, etc.)
├── recommended_pct (numeric: 0-100)
└── created_at, updated_at
```

Seed with BW data from both apps (SEO tiers + Content tiers).

### Alter `staffing_deals`: add `rag` column
- `rag` (text, default 'green') -- green/amber/red health indicator

## Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | Create `staffing_bw_rules` table, add `rag` to `staffing_deals`, seed BW data |
| `src/pages/Staffing.tsx` | Major rewrite: add mode toggle, KPI strip, capability switcher, enhanced tabs |
| `src/components/staffing/SummaryTab.tsx` | Rewrite with StatCards, pod breakdown, utilization chips |
| `src/components/staffing/CapacityTab.tsx` | Rewrite with summary cards, expandable rows, pod-level capacity cards |
| `src/components/staffing/HiringGapTab.tsx` | Rewrite with leaving/TBH panels, FTE gap analysis |
| `src/components/staffing/BWRulesTab.tsx` | Rewrite to use DB-backed rules with capability grouping |
| `src/components/staffing/AccountsTab.tsx` | New: extracted accounts logic with RAG, BW guidelines, add form |
| `src/components/staffing/PeopleTab.tsx` | New: extracted people logic with TBH banner, add forms |
| `src/hooks/useStaffingData.ts` | Add BW rules CRUD, RAG update support |
| `src/data/staffingData.ts` | Add `rag` to Deal interface |

## Technical Details

- All styling uses existing Tailwind/shadcn patterns (no inline styles from external apps)
- Capability switcher filters `ROLE_SLOTS` and deals by `businessUnit` mapping (existing `BU_ROLE_CATEGORIES`)
- BW rules are capability-specific: SEO has leader/principal/manager, Content has content_lead/editor_fixed/editor_freelance
- Edit mode toggle is local state (no auth gating for now)
- KPI strip uses `useMemo` to compute totals from filtered data
- Pod-level capacity cards compute average utilization per pod/VSD with per-person breakdowns
- Existing `CapacityTab` tree view is kept but enhanced with the capacity cards and expandable account splits

