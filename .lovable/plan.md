## Performance Overhaul Plan

Goal: eliminate the "patchy/slow" feel by routing all data through React Query, removing the global staffing provider, leveraging `deals_unified`, trimming Home/DealDetail fetches, adding missing indexes, and splitting bundles.

Work is grouped into 5 phases. Each phase is independently shippable and measurable. We can stop after any phase.

---

### Phase 1 — React Query foundation (highest impact, lowest risk)

Migrate the heaviest, most-shared hooks first. These cause the most duplicate fetches.

1. `useAppUsers.ts` (649 lines): replace the hand-rolled cache + pubsub + realtime layer with three `useQuery` hooks (`useAppUsers`, `useVsdUsers`, `useBopmDirectory`), keyed `['app-users']` / `['vsd-users']` / `['bopm-directory']`. Delete `cache`, `subscribers`, `realtimeBound`, `bindRealtime`.
2. `useStaffingData.ts`: split into per-table hooks — `usePeople`, `useDeals`, `useAssignments`, `useHiringNeeds`, `useRevenueTargets`, `useBwRules`. Delete `StaffingDataProvider` from `App.tsx`. Each consumer page imports only what it needs.
3. `useApprovals`, `useDealDetail`, `useAccountActivity`, `useMBRData`, `useGoogleCalendar`: convert to `useQuery` / `useMutation`. Mutations call `qc.invalidateQueries` instead of local `setState`.
4. Add a single `usePeople()` hook used everywhere names are resolved from IDs (Home, Tasks, DealDetail, etc.) — one fetch per session.

Acceptance: Network tab on cold `/home` load shows each table fetched at most once; back-navigation to a deal does not refetch unchanged tabs.

---

### Phase 2 — Home.tsx + DealDetail.tsx surgical fixes

1. **Home.tsx**
   - Remove `.range(0, 49999)` / `.range(0, 9999)`. Filter server-side: `.contains('assignees', [myAlias])` (uses existing GIN index) or new RPC `home_tasks_for_user(user_id)`.
   - Replace "pull all active deals → filter in JS" with an RPC `deals_for_user(user_id)` that uses the alias set server-side.
   - Convert all 11 loaders to parallel `useQuery` calls so duplicate `staffing_deals` fetches dedupe automatically.
   - Realtime: patch cache via `qc.setQueryData` using the payload row; do not refetch the table.

2. **DealDetail.tsx**
   - Split the 9-fetch `Promise.all` into 9 `useQuery` hooks keyed `['deal', dealId, '<slice>']`.
   - Lazy-load tabs (Financials, Tasks, MBR, RGY, SoW, Onboarding) as separate chunks; each tab's query only runs when mounted.
   - Replace `select("*")` with explicit column lists for each slice.
   - Realtime patches cache instead of re-selecting.

---

### Phase 3 — Use `deals_unified` view

Replace JS-side deal+client+headcount+financials joins in `Home.tsx`, `Clients.tsx`, and the new `useDeals` hook with a single `from('deals_unified').select(...)` call. Removes 3 round-trips per affected page.

---

### Phase 4 — Database indexes + RPCs (migration)

Single migration adding:

```sql
CREATE INDEX idx_staffing_deals_status ON staffing_deals(deal_status);
CREATE INDEX idx_cx_tasks_space_status ON cx_tasks(space_id, status);
CREATE INDEX idx_deal_rgy_weekly_issue_open ON deal_rgy_weekly(issue_status)
  WHERE issue_status = 'Open';
CREATE INDEX idx_deal_tasks_deal_sort ON deal_tasks(deal_id, sort_order);
CREATE INDEX idx_staffing_people_active ON staffing_people(leaving, tbh)
  WHERE leaving = false AND tbh = false;
```

Plus two SECURITY DEFINER RPCs:
- `home_tasks_for_user(user_id uuid)` — server-side assignee filter
- `deals_for_user(user_id uuid)` — server-side alias filter

---

### Phase 5 — Realtime coordination + bundle splitting

1. Central realtime layer: `useRealtimeTable(table, queryKey)` opens one channel per table when ≥1 observer is mounted, closes on last unmount, patches cache from payload (no blanket refetch). Migrate the 35 scattered `.channel(...)` calls to use it.
2. `vite.config.ts` `manualChunks`: split `react-vendor`, `radix`, `charts` (recharts), `motion` (framer-motion), `forms`, `dnd`.
3. Audit `date-fns` imports — confirm no `import *`.
4. Split `DealDetail.tsx` tabs into separately lazy-loaded subcomponents (cut points already obvious: Financials / Tasks / MBR / RGY / SoW).

---

### Smaller cleanups (folded into the phase where the file is touched)

- Optimistic mutations use `onMutate` / `onError` rollback (Phase 1).
- Remove `useStaffingData`'s `visibilitychange` listener (Phase 1, when provider is deleted).
- Cache user's Slack ID with React Query (Phase 2).
- `bulkUpdatePeople`: invalidate `['staffing-people']` after success instead of relying on realtime (Phase 1).
- `task_templates` select: project only `id, name` (Phase 1).

---

### Technical details

- React Query defaults already correct (`staleTime: 5m`, `gcTime: 30m`, `refetchOnWindowFocus: true`) — no config changes needed.
- All mutations follow pattern: `useMutation({ mutationFn, onMutate: optimistic, onError: rollback, onSettled: invalidate })`.
- Realtime payload shape: use `payload.new` / `payload.old` to patch `qc.setQueryData(key, old => …)`.
- Keep RLS unchanged; new RPCs are `SECURITY DEFINER` with `auth.uid()` checks inside.
- `deals_unified` already exists — no migration needed for Phase 3.

### Suggested order to ship

Phase 1 → Phase 2 (Home) → Phase 4 (indexes) → Phase 2 (DealDetail) → Phase 3 → Phase 5.

Phase 1 alone should resolve most of the perceived slowness. Want me to start there, or pick a different entry point?
