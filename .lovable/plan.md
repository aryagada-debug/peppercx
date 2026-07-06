## Problem

In MBR Tracker, marking a deal as "Not Required" or "Not Done" writes to the database, but the table doesn't update until a manual refresh. `useMBRData.upsertEntry` writes to `mbr_entries` and then relies purely on Realtime (`postgres_changes`) to invalidate the `["mbr","entries"]` React Query cache. If Realtime isn't enabled for `public.mbr_entries` (or the event is dropped), the UI stays stale.

## Fix

Make the change reflect instantly by:

1. **Optimistic cache update** in `useMBRData.upsertEntry` — before/after the network call, patch the `["mbr","entries"]` cache directly so the affected row shows the new status immediately with zero refetch.
2. **Guaranteed invalidation** — call `qc.invalidateQueries({ queryKey: ["mbr","entries"] })` right after the upsert `select()` resolves, so the cache reconciles with the server without waiting for a Realtime broadcast.
3. Keep the existing Realtime subscription as a background sync for other users' changes (no behavior change there).

No schema changes, no new dependencies, no changes to the MBR Tracker page — the fix is isolated to `src/hooks/useMBRData.ts`.

## Technical notes

- Update path in `upsertEntry`:
  - Compute the new `MBREntry` shape from `params` (mirroring `mapEntry`).
  - `qc.setQueryData(["mbr","entries"], (prev) => ...)` — replace the existing row for that `dealId` + current-week `weekStart`, or prepend a new one.
  - Await the Supabase upsert. On error, roll back to the previous snapshot and rethrow.
  - After success, `qc.invalidateQueries({ queryKey: ["mbr","entries"] })` to fetch canonical row (with real `id`, timestamps).
- Same optimistic pattern applied to `toggleAnirudhJoining` for consistency (also currently relies solely on Realtime).
