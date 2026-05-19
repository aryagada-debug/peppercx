# Phase 2 — Parallel React Query Hooks

Build new query hooks alongside existing ones. No consumers change in this phase, no deletions. This lets us sanity-check each hook before Phase 3 cuts call sites over.

## What gets created

All under `src/hooks/queries/`:

1. **`usePeopleQuery.ts`** — `staffing_people` list + `usePersonMutations` (create/update/delete/bulkUpdate). Realtime via `useTableSubscription('staffing_people', defaultListPatcher)`. Uses `STAFFING_PEOPLE_SELECT` + `dbToPerson`.
2. **`useDealsQuery.ts`** — `staffing_deals` list + mutations. Realtime patcher. `dbToDeal`.
3. **`useAssignmentsQuery.ts`** — `staffing_assignments` + mutations. `dbToAssignment`.
4. **`useHiringQuery.ts`** — `staffing_hiring` + mutations.
5. **`useRevTargetsQuery.ts`** — `staffing_rev_targets` + mutations.
6. **`useBWRulesQuery.ts`** — `staffing_bw_rules` + mutations.
7. **`useAppUsersQuery.ts`** — combined `admin-user-mgmt` edge function + `profiles` read in a single `queryFn`. Realtime on `profiles` invalidates the combined key. Exposes same shape as today's `useAppUsers` (users array, refresh, loading).
8. **`useVsdUsersQuery.ts`** — derived from `useAppUsersQuery` via `select` (VSD-filtered).
9. **`useBopmDirectoryQuery.ts`** — derived from `useAppUsersQuery` via `select` (BOPM-filtered).
10. **`useClientsQuery.ts`** — clients list (composed from deals view or table per current logic). Realtime patcher.
11. **`useDealDetailQuery.ts`** — split into per-tab query factories (`useDealCore`, `useDealSow`, `useDealTeam`, `useDealRgy`, `useDealTasks`, `useDealApprovals`). Each `enabled` flag drives lazy fetching. Stub only — wired in Phase 5.
12. **`useHomeDashboardQuery.ts`** — placeholder set of scoped queries (my tasks, my deals). Stub only — wired in Phase 4.

## Conventions

- Every query uses `qk.*` from `src/lib/queryKeys.ts`.
- Every realtime subscription uses `useTableSubscription` from `src/lib/realtime.ts` with `defaultListPatcher` (cache patch, no refetch) unless mutation logic requires invalidation.
- Mutations use `useMutation` with `onMutate` optimistic update + `onError` rollback + `onSettled` invalidate.
- Bulk mutations return the affected rows (`.select()`) so the mutation hook patches the cache instead of waiting for realtime.
- `select()` lists use the `STAFFING_*_SELECT` constants — no `select("*")`.
- Each hook file exports `useXQuery()` (read) and `useXMutations()` (write) as separate hooks so consumers can subscribe to one without the other.

## Validation per hook

After each hook file, run:
- `tsc --noEmit` (clean)
- `vitest run` if a related test exists

No behavioral tests added in this phase — Phase 6 owns the Playwright assertions.

## Out of scope for Phase 2

- Touching any consumer page
- Deleting `useStaffingData.ts`, `useAppUsers.ts`, or `StaffingDataProvider`
- Home/DealDetail surgery (Phases 4 & 5)
- `deals_unified` adoption + new RPCs (Phase 6)

## Deliverable

12 new files under `src/hooks/queries/`, type-clean, with no consumer wired up. Ready for Phase 3 cutover.
