## Goal

Make monthly MBRs compulsory only for **Retainer** accounts. Non-retainers should be included but never flagged. Add an Account Type filter (default: Retainer only) so KPIs/compliance/flags reflect retainers by default.

## Changes

### 1. `src/hooks/useMBRData.ts`

- Add `dealType: string` to `MBRDeal` interface.
- In `fetchMBRDeals`, stop dropping non-retainer rows. Keep excluding `churned` and `irrelevant` customer types. Map `deal_type` (already selected) onto the `dealType` field.
- Add a helper `isRetainer(deal)` exported from the hook module, treating `dealType` containing "retainer" and NOT "non" as retainer (falls back to `customer_type` when `deal_type` is empty).

### 2. `src/pages/MBRTracker.tsx`

- New state: `accountTypeFilter: "retainer" | "non-retainer" | "all"`, default `"retainer"`.
- Add a small segmented control next to the existing VSD/BOPM filters labeled **Account Type** with three pills: Retainer / Non-Retainer / All.
- Apply this filter inside the existing `filteredDeals` memo using `isRetainer`. Add to dependency array.
- Header subtitle: dynamic — "X retainer accounts", "X non-retainer accounts", or "X accounts" based on selected filter.
- KPI tile label: rename "Retainers" tile to "Accounts" and keep the rest. (KPIs already derive from `filteredDeals`, so numbers auto-adjust.)
- Compliance denominator: when filter is "all", only count retainers in the denominator (so non-retainers don't drag down compliance). For retainer-only filter, behavior unchanged.
- Flags (`flagInsights`): skip non-retainer deals entirely — only retainers can be flagged for missed/late MBRs and red signals. Wrap the per-deal flag generation in an `isRetainer` check.
- "MBR not held" rule: only applies to retainer deals.
- Row rendering in Table tab: for non-retainer deals, render the status cell as a muted "N/R — Not Required" pill instead of "Pending", so they're never visually flagged.

### 3. No DB / schema changes

Source of truth is the existing `staffing_deals.deal_type` / `customer_type` columns. Nothing to migrate.

## Out of scope

- Reminders edge function (`mbr-reminders`) — separate follow-up if you want retainers-only reminders too. Flag this for me if you want it included.  
Yes retainer only reminders