

# RGY Insights — Heatmap Filter, Extended Dimensions, Issues Redesign

## What Changes

### 1. Full Heatmap — Active accounts only, no all-blank rows
Filter the heatmap to show only deals where `deal_status` is in the active set AND at least one dimension has a non-NA value. This removes noise from closed deals and unscored accounts.

### 2. Extend dimensions to 13
Add Delivery, Consumption, Invoicing, Receivables, Margins to the existing 8 (Internal, Customer, Content, SEO, Supply, Copy, Design, Video). The DB already has `delivery` and `consumption` columns. Need three new columns: `invoicing`, `receivables`, `margins`.

### 3. Issues section — match screenshot UI
Redesign the "Critical Issues & Watch List" to show:
- **Status badge** (Active, Completed, Churned) with colored pill
- **Deal name + PC code** in bold
- **Issue text** (from `issue_details`) as body copy
- **Action plan** (from `action_plan` / `discussed_action_plan`) in italic below
- **Affected dimension badges** — red-tinted pills showing which dimensions are Red for that deal, with a "+N" overflow count

This matches the uploaded reference screenshot layout.

## Database Migration

```sql
ALTER TABLE deal_rgy_weekly ADD COLUMN invoicing text NOT NULL DEFAULT 'G';
ALTER TABLE deal_rgy_weekly ADD COLUMN receivables text NOT NULL DEFAULT 'G';
ALTER TABLE deal_rgy_weekly ADD COLUMN margins text NOT NULL DEFAULT 'G';
```

## Files Modified

| File | Change |
|------|--------|
| `src/pages/RGYHealth.tsx` | (1) Extend `DIMENSIONS` array to 13. (2) Add `invoicing`, `receivables`, `margins` to `DealWithRGY` interface and `fetchData` select/merge. (3) Update main Health Board table columns to show all 13 dimensions. |
| `src/components/rgy/RGYInsightsTab.tsx` | (1) Extend local `DIMENSIONS` to 13. (2) Filter heatmap to active + non-all-blank deals only. (3) Redesign issues section with status badge, deal name, PC code, issue text, action plan, and red dimension badges matching screenshot layout. |

### Key Details

- **Heatmap filter logic**: `heatmapData` memo adds `.filter(d => ACTIVE_STATUSES.has(d.deal_status) && DIMENSIONS.some(dim => d[dim.key] !== "NA" && d[dim.key]))` before sorting
- **Issues redesign**: The `issues` prop will be enriched with `deal_status`, `pc_code`, `action_plan`, and `red_dimensions` (array of dimension labels that are Red for that deal). The parent `RGYHealth.tsx` will pass this enriched data.
- **Dimension badges**: Show up to 4 red dimension names as red-tinted badges, then "+N" for overflow, matching the screenshot pattern

