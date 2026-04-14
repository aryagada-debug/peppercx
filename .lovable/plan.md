

# RGY Health Tab — Live Data Sync + Deal Detail Dialog

## What Changes

Replace hardcoded mock data in `RGYHealth.tsx` with live data from `staffing_deals` joined with `deal_rgy_weekly`. Show all active deals (332 deals: Active Deal + Deal Disputed + New Deal in SLA/PO). Deals without RGY entries default to "NA" for all dimensions. Everything is read-only. Clicking a deal name opens a dialog with consolidated deal overview info.

## Implementation

### 1. Rewrite `src/pages/RGYHealth.tsx`
- Fetch all active deals from `staffing_deals` (where `deal_status` IN Active Deal, Deal Disputed, New Deal in SLA/PO)
- For each deal, fetch the latest `deal_rgy_weekly` entry (by `week_start DESC LIMIT 1`)
- Use a single query: left join `staffing_deals` with a subquery for latest RGY per deal
- Map to `RGYRow[]` format with the 5 RGY dimensions: Account Health, Delivery, Finance/Billing, Capability-SEO, Capability-Creative
- Compute summary metrics (red/yellow/green counts, portfolio score) from live data
- Add loading state with skeleton
- Add state for selected deal to open detail dialog
- Remove all hardcoded mock data

### 2. Create `src/components/rgy/DealDetailDialog.tsx`
- Dialog triggered when deal name is clicked in the heatmap
- Shows consolidated deal overview:
  - **Header**: Deal name, client/account, status badge, pod badge
  - **Key Metrics**: MRR, Total Deal Value, Duration (start → end date)
  - **Team**: VSD, Principal BOPM, Senior BOPM, BOPM
  - **Contract**: Start date, end date, payment terms
  - **RGY Status**: Current 5-dimension status displayed as colored badges
  - **Link**: Button to navigate to full Deal Detail page (`/deals/:id`)
- All read-only, no edit capabilities

### 3. Update `RGYHeatmap` component
- Make deal name column clickable (underlined, blue text) independent of full row click
- Pass an `onDealClick` callback that receives the deal ID
- Keep existing component mostly intact, just make deal name a button/link

### Files Modified
| File | Change |
|------|--------|
| `src/pages/RGYHealth.tsx` | Full rewrite — live Supabase query, dialog state |
| `src/components/rgy/DealDetailDialog.tsx` | New — consolidated deal overview dialog |
| `src/components/dashboard/RGYHeatmap.tsx` | Minor — make deal name clickable |

