## Goal
On the RGY Health → Insights tab, when viewed as BOPM persona:
1. Remove the "VSD Portfolio Health Comparison" chart entirely.
2. "Active Issues & Action Plans" must only show issues from the BOPM's own deals AND only those in active status (`Active Deal`, `New Deal in SLA/PO`, `Deal Disputed`).
3. "Team Health Breakdown" must reflect only the BOPM's own deals.

## Changes

### `src/pages/RGYHealth.tsx`
- Pass a new `isBopm` prop to `<RGYInsightsTab>` based on the existing `isBopmPersona` flag.
  ```tsx
  <RGYInsightsTab
    deals={deals}
    filteredDeals={filteredDeals}
    issues={rgyIssues}
    activeVsd={activeVsd}
    isBopm={isBopmPersona}
  />
  ```
- `filteredDeals` is already scoped to BOPM's `visibleDealIds` and to active statuses when `showClosed` is off — so passing it through is sufficient for Team Health.

### `src/components/rgy/RGYInsightsTab.tsx`
- Add `isBopm?: boolean` to `Props`.
- **VSD comparison removal**: wrap the entire `VSD Portfolio Health Comparison` card (lines 376–404) in `{!isBopm && (...)}`.
- **Active Issues scoping** (when `isBopm`):
  - Build a set of allowed deal ids from `filteredDeals` (already BOPM + active scoped).
  - In the `activeIssues` `useMemo`, additionally filter:
    ```ts
    const allowedIds = new Set(filteredDeals
      .filter(d => ACTIVE_STATUSES.has(d.deal_status))
      .map(d => d.id));
    // when isBopm: only keep issues whose deal_id is in allowedIds
    ```
  - Update the dependency array to include `filteredDeals` and `isBopm`.
- **Team Health**: already derived from `filteredDeals`, no change required — but explicitly ensure it filters to active statuses when `isBopm` is true (mirrors the user's intent of "their own deals" being active deals). Add an active-status filter inside `teamHealth` `useMemo` guarded by `isBopm`.
- The "AI Movement Summary" snapshot already includes `vsdComparison`; when `isBopm`, omit `vsdComparison` from the payload to keep the summary consistent with the hidden chart.

## Out of scope
- No DB / RLS changes.
- Non-BOPM (admin / VSD) view is unchanged.
