

# Major App Redesign: Design Language + Unified Client-Deal View + Staffing Revamp

## Overview

Three major workstreams:
1. **Design language overhaul** — switch from current dark-primary palette to the Pepper Marketplace design system (purple primary, DM Sans + JetBrains Mono, off-white backgrounds, pill badges)
2. **Unified Client → Deal view** — merge Clients and Deals pages into a single Pod-based collapsible view with 7-tab deal detail
3. **Staffing & Capacity simplification** — replace current 7-tab staffing with a clean 2-view system (Deal-level + People-level)

---

## Part 1: Design Language Migration

Update CSS variables, fonts, and Tailwind config to match the Pepper Marketplace Design Language document.

### Changes
- **`src/index.css`**: Replace all `:root` CSS variables:
  - `--background: 240 7% 98%` (#F8F8FA)
  - `--foreground: 240 10% 16%` (#252530)
  - `--primary: 238 40% 57%` (#5B57A8 — Indigo-Violet)
  - `--secondary: 240 5% 96%`
  - `--muted: 240 5% 96%`, `--muted-foreground: 240 5% 46%`
  - `--accent: 238 40% 96%` (#EDEDF8)
  - `--border: 240 6% 94%`
  - `--destructive: 0 72% 51%`
  - `--positive` → `--success: 142 60% 40%` + add `--success-bg`, `--warning-bg`, `--danger-bg`
  - `--radius: 0.875rem` (14px)
  - Sidebar: white bg, purple active state
  - Add `--info: 210 80% 55%`
- **Fonts**: Replace Geist with `DM Sans` (primary) and `JetBrains Mono` (mono). Update `@import` and `body` font-family.
- **`tailwind.config.ts`**: Add `success`, `info` color tokens. Update font sizes to match doc (base 13px, caption 11-12px, heading 18-24px). Add `fade-in` and `slide-in` keyframes.
- **Component updates**: Status badges become `rounded-full` (pill). Buttons get `rounded-[7px]`. Cards get `rounded-[14px]` with subtle shadow.
- **Sidebar**: White background, purple active item (`--sidebar-primary: 238 40% 57%`), purple accent hover.

### Files
| File | Change |
|------|--------|
| `src/index.css` | Replace all CSS variables, font imports |
| `tailwind.config.ts` | New color tokens, font sizes, keyframes |
| `src/components/layout/AppSidebar.tsx` | Purple active state styling |

---

## Part 2: Unified Client → Deal View

Merge `/clients` and `/deals` into a single `/clients` route. Remove separate `/deals` page. The view is: **Pod tabs → Collapsible client rows → Deal rows within each client**.

### Structure
```text
[KPI Strip: Total Clients | Total Deals | Total Creators | Active Clients | Active Deals | Active Creators]
[Checkbox: Show closed clients]
[Pod Tabs: All | Integrated | India B2B | US B2B | FMCG | BFSI | ⚠ Unassigned]
[+ Add Client to {Pod}]

▼ Air India Express                               REVENUE  COST  MARGIN
  BOPM: P: Tushar Walia · S: Ayushi Das           ₹128.9L  ₹0.5L  99.6%
  Principal BOPM: ...  Senior BOPM: ...  Junior BOPM: —
  [☐ Show completed] [☐ Show all creators]         [+ Add Deal]
  
  > Air India_Jan-2025 (D-0050) Non-Retainer  Aamir Khan  Rev ₹104.0L  Cost ₹0.0L  100%  Active  CS
  > Contestant + Influencer (D-0051) Non-Retainer  ...
```

### Data source
- Use `staffing_deals` table (already has ~550 deals with `account`, `vsd`, `business_unit`, `mrr`, etc.)
- Group by `account` (client name) to create collapsible client sections
- Pod assignment: derive from `business_unit` or add a `pod` column to `staffing_deals`

### Deal Detail Page — 7 Tabs (remove Timesheets)
Rewrite `/deals/:dealId` with these tabs:

1. **Overview** — Deal metadata grid + **SoW Criteria section** (scope items with mapped revenue and team assignments). Add editable SoW rows: Scope, Revenue Share, Team/Capability.
2. **Staffing** — Team-level hierarchy view. VSD org → Capability org (Content, SEO, Creative). Senior → Junior tree with allocation %.
3. **Revenue** — Monthly table: Month, MRR, Contraction, Delivered, Invoiced, Actuals, Attainment %.
4. **Targets** — Month-on-month targets for Contraction, Delivery, Invoicing + YTD Target + YTD Attainment.
5. **RGY Health** — **Weekly** instead of monthly. Week-start dates as rows, same 4 dimensions (Internal/Customer/Delivery/Consumption).
6. **MBR Tracking** — Embed same format as MBR Tracker (reuse `MBRInputDrawer` and `MBRDetailDialog`), filtered to this deal.
7. **Onboarding** — Checklist with completion progress bar. Steps derived from Creative Process Decomposition for Creative Retainers; adapted versions for SEO/Content deals. Checklist items with checkbox + owner + due date.

### Database changes
- Add `pod` column to `staffing_deals` (text, default '')  — or derive from business_unit mapping
- New table `deal_sow_items` for SoW criteria:
  ```
  id (uuid), deal_id (text), scope (text), revenue_share (numeric),
  team_capability (text), created_at, updated_at
  ```
- New table `deal_revenue_monthly`:
  ```
  id (uuid), deal_id (text), month (date), mrr (numeric), contraction (numeric),
  delivered (numeric), invoiced (numeric), actuals (numeric), created_at, updated_at
  ```
- New table `deal_targets_monthly`:
  ```
  id (uuid), deal_id (text), month (date), contraction_target (numeric),
  delivery_target (numeric), invoicing_target (numeric), created_at, updated_at
  ```
- Alter `rgy_health` tracking to weekly (or new table `deal_rgy_weekly`):
  ```
  id (uuid), deal_id (text), week_start (date), internal (text), customer (text),
  delivery (text), consumption (text), created_at
  ```
- New table `deal_onboarding_steps`:
  ```
  id (uuid), deal_id (text), step_name (text), category (text), owner (text),
  due_date (date), completed (boolean), completed_at (timestamptz), sort_order (int)
  ```

### Routing changes
- Remove `/deals` route (redirect to `/clients`)
- Keep `/deals/:dealId` for deal detail page
- Update sidebar: remove "Deals" nav item, keep "Clients" (rename concept to "Clients & Deals")

### Files
| File | Change |
|------|--------|
| Migration SQL | Create 5 new tables, add `pod` to staffing_deals |
| `src/pages/Clients.tsx` | Complete rewrite: Pod tabs, collapsible clients, nested deals, KPIs |
| `src/pages/DealDetail.tsx` | Complete rewrite: 7 tabs with SoW, weekly RGY, onboarding checklist |
| `src/components/layout/AppSidebar.tsx` | Remove Deals nav, update Clients label |
| `src/App.tsx` | Remove `/deals` list route, keep detail route |
| `src/hooks/useClientDeals.ts` | New hook for grouped client-deal data |
| `src/hooks/useDealDetail.ts` | New hook for deal-level data (revenue, targets, RGY, onboarding, SoW) |
| `src/components/deals/SoWSection.tsx` | New: SoW criteria editor |
| `src/components/deals/OnboardingTab.tsx` | New: checklist with progress bar |
| `src/components/deals/WeeklyRGYTab.tsx` | New: weekly health grid |
| `src/components/deals/RevenueTab.tsx` | New: monthly revenue table |
| `src/components/deals/TargetsTab.tsx` | New: targets with YTD |
| `src/components/deals/DealStaffingTab.tsx` | New: team hierarchy for single deal |
| `src/components/deals/DealMBRTab.tsx` | New: MBR tracking filtered to deal |

---

## Part 3: Staffing & Capacity Simplification

Replace the current 7-tab Staffing module with a cleaner 2-view system.

### Two Views

**Tab 1: Deal-Level View**
- Table of all deals showing: Account, Deal Name, Deal Type, MRR, RAG, Status
- Expandable: shows all team members assigned from each capability team (SEO team, Content team, Creative team, Ops team) with their allocation % and the revenue they manage on that deal
- Filters: Pod, Capability, Status, RAG

**Tab 2: People-Level View**  
- Hierarchical tree: Leader → Manager → Junior
- Each person row shows: Name, Role, Pod, Region, # Deals, Total BW Used (bar + %), Status (Active/Leaving/TBH)
- Expandable: shows all deals they're tagged to with allocation per deal and deal revenue
- Summary cards at top: Overloaded / Near Full / Healthy / Under-utilised
- Keep the existing tree-building logic from `CapacityTab.tsx`
- Bring in pod-level capacity cards from Kindred Companion (per-pod average utilization with team breakdown)

### Retain from current system
- Edit/Publish mode toggle
- KPI strip header
- Capability switcher (All / SEO / Content / Creative / Ops)
- BW Rules as a sub-section or settings panel (not a main tab)

### Files
| File | Change |
|------|--------|
| `src/pages/Staffing.tsx` | Simplify to 2-tab layout + KPI strip + capability switcher |
| `src/components/staffing/DealLevelView.tsx` | New: deal-centric staffing table with expandable team breakdown |
| `src/components/staffing/PeopleLevelView.tsx` | New: person-centric tree with capacity cards and expandable deal splits |
| Remove/archive | `SummaryTab`, `AccountsTab`, `HiringGapTab`, `RevenueCapacityTab` (functionality absorbed into the two views) |
| `src/components/staffing/BWRulesPanel.tsx` | BW Rules as a slide-out panel or collapsible section |

---

## Implementation Order

1. **Design language** (foundation — affects all pages)
2. **Unified Client-Deal view** (core navigation change)
3. **Deal Detail 7 tabs** (new tables + UI)
4. **Staffing simplification** (restructure to 2 views)

This is a large effort spanning ~20+ files and 6 new database tables. I recommend implementing it in phases across multiple messages, starting with the design language migration.

