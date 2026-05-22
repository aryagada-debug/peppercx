## Findings
- The database is receiving the adds: Jishana has 28 `content_lead` assignment rows, including the exact recent attempts from the session.
- The UI can still miss them because the table fetches `staffing_assignments` without ordering or pagination. Lovable Cloud returns only the default first 1000 rows from a 1386-row table, so newer added rows often never reach the client cache.
- Duplicate rows exist for the same `(deal, role, person)` combination, including Jishana on the same deal multiple times. The current add path always creates a random ID, so repeated adds create duplicates instead of updating the existing assignment.
- `useDealAccess` caches deal visibility for 5 minutes and is not invalidated after assignment changes. This makes scoped views stale after adding people.
- The old trigger exists twice on `staffing_assignments`, causing duplicate deal recompute work after every staffing change.

## Plan
1. **Load all staffing data deterministically**
   - Update assignment fetching to page through all `staffing_assignments` rows, ordered by latest update/creation, so new assignments are always present in the table.
   - Add a safety helper reusable for large staffing tables instead of relying on the 1000-row default.

2. **Make add/update idempotent**
   - Change the direct add flow so adding the same person to the same deal + role updates the existing assignment instead of creating a duplicate.
   - Use a stable assignment identity format for new direct adds: `dealId__roleKey__personId`.
   - Merge allocation/date values into the existing row when one already exists.

3. **Keep the UI cache in sync immediately**
   - Patch the local assignment cache using `(dealId, roleKey, personId)` as a natural key, not only the random `id`.
   - After add/update/delete, actively refetch assignments, deals, and deal-access queries so scoped views do not stay stale.
   - Improve realtime mapped patching to dedupe optimistic rows against natural keys when available.

4. **Clean up backend recompute behavior**
   - Remove the duplicate staffing trigger so each insert/update/delete recomputes deal fields exactly once.
   - Keep the existing recompute function and one canonical trigger.

5. **Stress-test and verify**
   - Add regression tests for:
     - fetch-all assignments beyond 1000 rows,
     - adding Jishana-style repeated Content Lead assignments updates/merges instead of duplicating,
     - realtime payloads do not create duplicate rows in cache.
   - Run targeted tests and use database reads to verify Jishana’s recent assignments are visible after the fetch logic, not hidden by row limits.