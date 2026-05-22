## Findings — why the page feels patchy

After a deep read of `src/pages/Staffing.tsx`, `src/components/staffing/BopmStaffingFlatTable.tsx`, `src/hooks/queries/useStaffingMutations.ts`, the per-table queries, and `src/lib/realtime.ts`, three independent bugs cause every symptom the user described.

### 1. Realtime cache poisoning (root cause of "user disappears after adding")
`useDealsQuery` and `useAssignmentsQuery` subscribe via `defaultListPatcher` (in `src/lib/realtime.ts`). The patcher writes the **raw snake_case Postgres row** (`person_id`, `deal_id`, `role_key`, `allocation_pct`, `start_date`, `end_date`, …) straight into the React Query cache. But every consumer reads the **mapped camelCase** shape produced by `dbToAssignment` / `dbToDeal` (`personId`, `dealId`, `roleKey`, …).

Consequences:
- After `addAssignment` we `invalidate` and also receive a realtime INSERT — the realtime payload appends a broken row that has no `dealId`/`personId`/`roleKey`. The new chip never appears in any cell; the deal often appears to "lose" the row entirely because the broken row fails `dealRoleMap` lookup.
- DB trigger `sync_bopm_fields_from_assignment` then UPDATEs `staffing_deals` (`vsd` / `bopm` columns). Realtime replaces the cached Deal with a snake_case row → `d.account`, `d.dealName`, `d.mrr`, `d.dealStatus` all become `undefined` → that deal disappears from every filter (status, search, VSD, BOPM) because the filter predicates all read camelCase fields.
- A page refresh repopulates via `fetchDeals` / `fetchAssignments` (which use the mapper), so everything "comes back" — exactly the bug the user describes.

### 2. Filters silently drop deals
- `ACTIVE_STATUSES` in `BopmStaffingFlatTable.tsx` (line 998) is `{Active Deal, Deal Disputed, New Deal in SLA/PO}` while `ACTIVE_DEAL_STATUSES` in `Staffing.tsx` is `{… + Deal in Renewal Process}`. Renewal deals show in the header count but vanish from the table.
- VSD pill row hardcodes `VSD_NAMES` (5 names). Any deal whose VSD isn't in that list collapses into "Unassigned" → the filter is incomplete and the "Unassigned" bucket is misleading.
- Picking a VSD pill auto-resets the BOPM filter to "All" (line 1294) without telling the user — feels like filters "lose" state.
- The status pill defaults to "Active" only; closed/churned deals are hidden by default and there's no count next to "All deals", so the user can't tell whether the empty result is filter-driven or data-driven.
- When `directEdit=true` (admin/VSD path) no `BopmEmptyState` is shown, just an empty table — looks broken.

### 3. Render & cost issues that make it "patchy"
- 1000 deals × ~30 visible role columns rendered through one `<table>` with row virtualization only on the Y axis. `renderEntry` recomputes `resolvePeopleForRole` (which walks `allPeople`, builds descendant sets, etc.) per cell per render. Every state change (search keystroke, hover, scroll) re-runs that work.
- `dealRoleMap` is rebuilt whenever `drafts`/`savingAlloc` change — typing in any allocation input invalidates the whole map for every deal.
- `setTableScrollTop` fires on every scroll event and re-renders the whole component (and therefore `filteredDeals.slice`).
- Realtime fires a payload per row; with the broken patcher it triggers a render storm.

---

## Plan

### A. Fix realtime cache poisoning (the single biggest win)
1. In `src/hooks/queries/useAssignmentsQuery.ts` and `src/hooks/queries/useDealsQuery.ts`, replace `defaultListPatcher` with a **mapping patcher** that runs `dbToAssignment` / `dbToDeal` on `payload.new` and `payload.old` before touching the cache.
2. Add a small generic helper in `src/lib/realtime.ts`: `mappedListPatcher<DbRow, T extends {id:string}>(queryKey, mapRow)` so other queries can adopt the same fix.
3. Apply the same fix to any other query that uses `defaultListPatcher` over snake/camel-mismatched tables (`usePeopleQuery`, `useHiringQuery`, `useRevTargetsQuery`, `useBWRulesQuery` — verify each and convert where needed).

### B. Make filters honest and complete
1. Extract a single `ACTIVE_DEAL_STATUSES` constant (re-export from `src/data/staffingData.ts`) and use it in both `Staffing.tsx` and `BopmStaffingFlatTable.tsx` so the "Active" toggle matches the header count and includes "Deal in Renewal Process".
2. Build the VSD pill list **from the data** (union of `VSD_NAMES` + every distinct `vsdForDeal(d)` value present in `deals`) instead of the hardcoded constant. Sort alphabetically, keep "All" / "Unassigned" anchors.
3. Show counts on each pill (e.g. `Active 842`, `All deals 1000`, `Aamir Khan 23`) so empty results are explainable.
4. Stop silently clearing the BOPM filter when a VSD pill is selected — keep both; if the combo yields zero, show an "Adjust filters" empty state with a single-click "Clear filters" button.
5. Render `BopmEmptyState`-equivalent ("No deals match these filters") in the `directEdit` branch too, with a Clear-filters action.

### C. Make "add staffing" reliably visible
1. Keep the existing optimistic insert in `useStaffingMutations.addAssignment`. With (A) fixed, the realtime INSERT for the row we just optimistically added will reconcile correctly instead of poisoning the row.
2. Guard `defaultListPatcher` (and the new mapped one) against duplicate INSERT events: if the id already exists in cache, treat as UPDATE.
3. After insert success, also `qc.invalidateQueries({ queryKey: qk.deals() })` (already done) — but switch from `invalidate` to `refetchQueries({ type: 'active' })` so the staffing table actually refreshes immediately even if a stale render is in flight.
4. Strengthen `recentlyTouched`: also pin the **assignment** for ~8 s in a `recentlyTouchedAssignments` set so the chip stays visible even across one refetch race.
5. Surface failures: if the Supabase insert returns an error, the existing toast + rollback already exists — add `console.error` with the full error so we can diagnose RLS/FK issues from the browser console.

### D. Performance pass on the table
1. Memoize per-cell `resolvePeopleForRole` results in a `useMemo` keyed by `(roleKey, dealId, seniorIdsSignature)` — currently recomputed per render per cell.
2. Pull `tableScrollTop` into a `useRef` + `requestAnimationFrame` updater so scrolling doesn't re-render the whole component; only the virtual-window slice changes.
3. Split `dealRoleMap` into two memos: the base (deal × role → assignments) keyed by `[deals, assignments]`, and a thin overlay that applies `drafts` + `savingAlloc`. Typing an allocation no longer rebuilds the base map for 1000 deals.
4. Wrap the row component (`<tr>` body for one deal) in `React.memo` keyed by `(deal.id, byRole identity, drafts[deal.id], savingAlloc relevant slice)`.

### E. Regression coverage
Extend `src/test/integration/sheets-sync-and-triggers.test.ts`:
- Simulate a realtime INSERT payload with snake_case columns and assert the cached assignment list contains a properly mapped camelCase row, not the raw payload.
- Simulate a realtime UPDATE on `staffing_deals` (BOPM-trigger output) and assert that `account`/`dealName`/`dealStatus` remain populated.
- After `addAssignment` resolves, assert the new chip is queryable via the same selector the table uses (deal still present in filtered list, person rendered in correct role column).

### Files to change
- `src/lib/realtime.ts` — add `mappedListPatcher`.
- `src/hooks/queries/useAssignmentsQuery.ts`, `useDealsQuery.ts`, `usePeopleQuery.ts`, `useHiringQuery.ts`, `useRevTargetsQuery.ts`, `useBWRulesQuery.ts` — adopt the mapped patcher.
- `src/data/staffingData.ts` — export shared `ACTIVE_DEAL_STATUSES`.
- `src/pages/Staffing.tsx` — use the shared constant; pass available VSD names down.
- `src/components/staffing/BopmStaffingFlatTable.tsx` — data-driven VSD pills + counts, persistent BOPM+VSD combo, friendlier empty state, split dealRoleMap, memoized row, scroll-ref, memoized candidate resolution, sticky-assignment set.
- `src/hooks/queries/useStaffingMutations.ts` — refetchQueries instead of invalidate; log+toast on error already present.
- `src/test/integration/sheets-sync-and-triggers.test.ts` — three new cases.

### Out of scope
- Any change to RLS, DB triggers, the sheets-sync edge function, currency, or the deal-detail page. The plan is strictly the Staffing & Capacity → "Staffing" tab and the realtime layer it depends on.
