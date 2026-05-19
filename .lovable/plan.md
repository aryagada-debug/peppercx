## Performance & Architecture Refactor — Execution Plan

Following your 6-phase spec exactly. Two pieces of the spec are already shipped from the previous session:

- ✅ `**vite.config.ts` `manualChunks**` — react-vendor / radix / charts / motion / forms / dnd / date-fns / icons / supabase / tanstack split (Phase 6-ish bundle win, done early).
- ✅ **5 of the 9 required indexes** — `idx_staffing_deals_status`, `idx_cx_tasks_space_status`, `idx_deal_rgy_weekly_issue_open` (partial-index version), `idx_deal_tasks_deal_sort`, `idx_staffing_people_active`. The Phase 6 migration will add the remaining 4 (`_status_active` composite, `_deal_financials`, `_slack_inactivity_nudges`, `_user_notifications`) plus the RPC.
- ✅ `**useApprovals` / `useOpenApprovalForDeal` / `useAccountActivity**` already migrated to React Query (smaller hooks, kept for reference but Phase 2 will formalize their query keys via `qk`).

The rest of the work below follows your spec verbatim. Hard rules acknowledged: no feature changes, no schema-breaking changes, preserve RLS / approval gating / Slack side effects / optimistic UI, no new `any`, single new migration file, commit per phase.

---

### Phase 1 — Foundation primitives (no behavior change)

Files to create:

- `src/lib/queryKeys.ts` — `qk` factory exactly as specified. Backfill the already-migrated hooks (`useApprovals`, `useAccountActivity`) to use it.
- `src/lib/realtime.ts` — `useTableSubscription({ table, filter?, queryKey, patcher })`. Module-level refcounted channel map keyed by `${table}|${filter ?? ''}`. `defaultListPatcher<T>` exported. Visibility-aware (skip while `document.hidden`, replay on `visibilitychange`).
- `src/lib/dbMappers.ts` — extract every `dbToX` / `xToDb` currently inline in `useStaffingData.ts`, `useDealDetail.ts`, `Home.tsx`, `Clients.tsx`. Identical output (verified by eye, no "cleanup" of default values).

Tests: `npm run test` — unchanged.
Commit: `refactor: add query keys, realtime helper, and shared mappers`.

---

### Phase 2 — New hooks parallel to old (nothing rewired)

Create under `src/hooks/queries/`:


| Hook file                   | Backing table / view                                                                                                                                                                                                 | Mutations?                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `usePeopleQuery.ts`         | `staffing_people`                                                                                                                                                                                                    | yes — incl. approval-gated branching from current `useStaffingData` |
| `useDealsQuery.ts`          | `staffing_deals`                                                                                                                                                                                                     | yes                                                                 |
| `useDealsUnifiedQuery.ts`   | `deals_unified` view                                                                                                                                                                                                 | read-only                                                           |
| `useAssignmentsQuery.ts`    | `staffing_assignments`                                                                                                                                                                                               | yes — incl. `notify-assignment` invoke                              |
| `useHiringNeedsQuery.ts`    | `staffing_hiring_needs`                                                                                                                                                                                              | yes                                                                 |
| `useRevenueTargetsQuery.ts` | `staffing_revenue_targets`                                                                                                                                                                                           | yes                                                                 |
| `useBwRulesQuery.ts`        | `staffing_bw_rules`                                                                                                                                                                                                  | yes                                                                 |
| `useClientsQuery.ts`        | `clients`                                                                                                                                                                                                            | yes                                                                 |
| `useAppUsersQuery.ts`       | `admin-user-mgmt` invoke + `profiles`                                                                                                                                                                                | yes — preserve `admin-user-mgmt` calls                              |
| `useVsdHierarchyQuery.ts`   | same source as `useVsdUsers` today                                                                                                                                                                                   | read                                                                |
| `useBopmDirectoryQuery.ts`  | same as `useBopmDirectory` today                                                                                                                                                                                     | read                                                                |
| `useDealDetailQueries.ts`   | 9 per-slice hooks: `useDealSowItems`, `useDealRevenueMonthly`, `useDealTargetsMonthly`, `useDealRgyWeekly`, `useDealOnboarding`, `useDealFinancials`, `useDealTasks`, `useDealMbrEntries`, `useDealFinancialTargets` | yes, per slice                                                      |


Each query:

- Uses the existing column lists (`STAFFING_*_SELECT` constants in `useStaffingData.ts`) — no `select("*")` regressions, no dropped columns.
- Applies the `dbToX` mapper from `src/lib/dbMappers.ts`.
- `staleTime: 5 * 60_000` (or `30_000` for nudges / notifications / mentions).
- Realtime via `useTableSubscription`, filtered where possible (`deal_id=eq.${dealId}` for per-deal hooks).

Each mutation (`add`, `update`, `delete`, `bulkUpdate`):

- `onMutate` snapshot + optimistic `setQueryData`.
- `onError` rollback to snapshot.
- `onSettled` `invalidateQueries(qk.x())`.
- Preserves current `canEditAll` branching → `submitApprovalRequest` when false.
- Preserves `supabase.functions.invoke("notify-assignment", ...)` / `"admin-user-mgmt"` at the same lifecycle points (use `onSuccess` for fire-and-forget side effects).

Tests: add unit tests for rollback behavior (one per mutation hook, using a React Query test wrapper). Existing tests still pass.
Commit: `feat: add React Query hooks parallel to legacy data layer`.

---

### Phase 3 — Migrate call sites; delete old hooks

Pages/components to rewire (one diff each, kept minimal):

1. `src/pages/Clients.tsx` — `useStaffingData` + `useClients` → `usePeopleQuery` + `useDealsQuery` (or `useDealsUnifiedQuery` if it covers the columns Clients renders) + `useAssignmentsQuery` + `useClientsQuery` + mutation hooks.
2. `src/pages/Staffing.tsx` — same.
3. `src/pages/DealDetail.tsx` — `useDealDetail` → per-slice `useDealDetailQueries` hooks. Tab components only call the hooks for data they render (Phase 5 sharpens this; Phase 3 is a 1:1 swap that already drops cross-tab refetches).
4. `src/pages/Settings.tsx` — `useAppUsers` family → `useAppUsersQuery` family.
5. `src/components/deals/WeeklyStaffingGrid.tsx` — staffing hooks → query versions.
6. `src/components/cx/StaffingApprovalEditor.tsx` — same.
7. Every other consumer of `useAppUsers` / `useVsdUsers` / `useBopmDirectory` → `Query` variants.

Rules during migration:

- Keep destructuring API identical at call sites (`const { data: people = [], isLoading: loading } = usePeopleQuery();`).
- No new loading skeletons; whatever the page showed for `loading === true` shows for `isLoading === true`.
- Preserve error UI (silent `console.error` stays silent; `toast` stays `toast`).

Delete after all consumers are migrated:

- `src/hooks/useStaffingData.ts` (incl. `StaffingDataProvider`)
- `src/hooks/useAppUsers.ts`
- `<StaffingDataProvider>` wrapper in `App.tsx`

Tests: `npm run test`. Read-through diff of every page that used `useStaffingData().loading`.
Commit: `refactor: migrate all pages to React Query data hooks`.

---

### Phase 4 — Fix Home.tsx

a) Replace `.range(0, 49999)` (deal_tasks) and `.range(0, 9999)` (cx_tasks) with scoped queries. Behind feature flag `USE_HOME_RPC = false` until Phase 6 lands. Non-admin path uses existing `.in("deal_id", myDealIdsForScope)`. Admin/VSD path keeps a temporary range query (or `.contains('assignees', [alias])` if cheap) until the RPC swap.
b) All 11 `loadX` functions become `useQuery` calls keyed via `qk.homeX(userId)`. The cascading `setTimeout(100, …)` chain is removed — React Query parallelizes naturally.
c) Realtime: replace the four `.on("postgres_changes", …, () => loadX())` calls with `useTableSubscription` + `defaultListPatcher`. The unfiltered `deal_tasks` subscription gets scoped to `deal_id=in.(…)` (non-admin) or `assignees=cs.{userKey}` (admin/VSD).
d) `loadActiveDeals` and `loadMyDeals` → single `useDealsUnifiedQuery()` with alias filter applied client-side (RPC handles it server-side in Phase 6).
e) `staffing_deals` is now pulled once via `useDealsQuery` / `useDealsUnifiedQuery` and consumed by all four cards (Tasks / Flags / MyDeals / ActiveDeals). React Query dedupes automatically.

Tests: `npm run test`. Read-through every Home card vs. before.
Commit: `perf: rewrite Home data loading with React Query and patched realtime`.

---

### Phase 5 — Fix DealDetail.tsx

- Document slice→tab mapping in a comment block at the top of `DealDetail.tsx`. Confirm by reading each tab child.
- Each tab calls only its own `useDeal<Slice>` hooks. Tabs that aren't rendered don't fetch.
- Cross-tab shared data (the deal row, headcount summary) stays in `DealDetail.tsx` and is passed via props/context (no new Provider — just props).
- Tighten `select(...)` lists per slice based on actual column usage. Where the consumer set is unclear (or wide), keep `select("*")` with a `// TODO: trim` comment — not a regression.
- The realtime resubscription pattern from `useDealDetail.ts` for `mbr_entries` and `deal_tasks` → `useTableSubscription` with `deal_id=eq.${dealId}` filter and payload patching (no full re-select).

Delete `src/hooks/useDealDetail.ts`. Move its type exports (`FinancialRow`, `RGYWeekly`, etc.) to `src/types/dealDetail.ts`.

Tests: `npm run test`.
Commit: `perf: split DealDetail into per-tab queries with payload-patched realtime`.

---

### Phase 6 — Migration: remaining indexes, RPCs, `deals_unified` rollout

One new file: `supabase/migrations/<ts>_perf_indexes_and_rpcs.sql`.

Contents (the 5 already-applied indexes are guarded by `IF NOT EXISTS` so re-running is safe):

```sql
CREATE INDEX IF NOT EXISTS idx_staffing_deals_status ON public.staffing_deals(deal_status);

CREATE INDEX IF NOT EXISTS idx_staffing_deals_status_active
  ON public.staffing_deals(deal_status, end_date)
  WHERE deal_status IN ('Active Deal', 'New Deal in SLA/PO', 'Deal Disputed');

CREATE INDEX IF NOT EXISTS idx_cx_tasks_space_status ON public.cx_tasks(space_id, status);
CREATE INDEX IF NOT EXISTS idx_deal_tasks_deal_sort ON public.deal_tasks(deal_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_staffing_people_active
  ON public.staffing_people(leaving, tbh)
  WHERE leaving = false AND tbh = false;

CREATE INDEX IF NOT EXISTS idx_deal_rgy_weekly_issue_open
  ON public.deal_rgy_weekly(deal_id, week_start DESC)
  WHERE issue_status = 'Open';

CREATE INDEX IF NOT EXISTS idx_deal_financials_deal_month_desc
  ON public.deal_financials(deal_id, month DESC);

CREATE INDEX IF NOT EXISTS idx_slack_inactivity_nudges_deal_week
  ON public.slack_inactivity_nudges(deal_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
  ON public.user_notifications(user_id, created_at DESC)
  WHERE read = false;

CREATE OR REPLACE FUNCTION public.home_my_tasks(p_user_id uuid)
RETURNS TABLE (...)  -- exactly as in spec
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$ ... $$;

REVOKE ALL ON FUNCTION public.home_my_tasks(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.home_my_tasks(uuid) TO authenticated;
```

App-side after migration applies:

- Flip `USE_HOME_RPC = true` and swap the Home tasks query to `supabase.rpc('home_my_tasks', { p_user_id: user.id })`.
- Ensure `deals_unified` reads are wired in at ≥3 call sites: `Clients.tsx`, `Home.tsx` (my deals + active deals = 2 cards but 1 hook), any dashboard widget currently doing the `staffing_deals` + `clients` two-step (`Index.tsx`).

⚠ Note on `user_notifications`: the schema dump in context didn't surface this table; before writing the migration I'll verify it exists (it's referenced in the spec) and drop that index line if it doesn't. Same defensive check for `slack_inactivity_nudges.week_start` ordering compatibility — column is present per schema.

Tests: `npm run test`. Add Playwright test asserting < 15 Supabase requests on Home cold load (uses existing `playwright.config.ts` + `playwright-fixture.ts`).
Commit: `perf: add indexes, home_my_tasks RPC, and route reads through deals_unified`.

---

### Post-phase checks (definition of done)

- `npm run lint` — no new warnings attributable to this work.
- `npm run build` — clean.
- `npm run test` — green.
- `useStaffingData.ts`, `useAppUsers.ts`, `useDealDetail.ts` — deleted.
- `range(0, 49999)` and `range(0, 9999)` — absent from codebase.
- `StaffingDataProvider` — absent from `App.tsx`.
- `deals_unified` — used in ≥3 call sites.
- New migration file exists and is valid SQL.

### Out of scope (will not touch)

Renaming PKs, missing FKs, denormalized `_name` columns, `deal_rgy_weekly` pivot, `CHECK`/enum constraints, money column precision, `supabase/functions/*`, any new feature/page/column/UI.

### Two clarifications before I start (won't block — assumed defaults below if no answer)

1. `**useAppUsersQuery` realtime source of truth**: current `useAppUsers` blends `admin-user-mgmt` edge-function output with `profiles` table reads. I'll keep that exact composition — single `queryFn` that does both, then realtime on `profiles` invalidates the combined query. Acceptable? 
2. **Playwright network-count assertion (Phase 6)**: I'll assert `< 15` as you specified, scoped to `**/rest/v1/**` + `**/rpc/**` requests (excluding auth, edge-function invokes, realtime websocket frames). OK?

If both are fine I proceed straight through Phase 1 → 6 on approval.