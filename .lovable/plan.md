# Restrict app to deals listed in `Deal ID (2).xlsx`

## What's in the sheet
- 171 unique deal IDs across two formats:
  - Numeric (e.g. `100853`, `101104`) — match `staffing_deals.deal_id`
  - Temp deal IDs (e.g. `TT12031`, `TT04116`) — also stored in `staffing_deals.deal_id`
- Of these, **116 currently exist** in `staffing_deals`; the remaining 55 are not present yet (likely new/temp deals not yet synced — they will simply stay absent, no action needed).

## Current DB state
- `staffing_deals`: 936 rows
- Target after cleanup: **116 rows** (all rows whose `deal_id` is in the sheet)
- 820 deals will be removed, along with their child data via the existing `softDelete` cascade registry.

## What gets removed (cascading per `src/lib/trash.ts` TRASH_REGISTRY)
For every removed deal, child rows are also snapshotted to `trash_items` and deleted from:
- `staffing_assignments`
- `deal_financials`
- `deal_sow_items`
- `deal_tasks`
- `deal_onboarding_steps`
- `deal_rgy_weekly`
- `deal_revenue_monthly`
- `deal_targets_monthly`
- `mbr_entries`
- `deal_stakeholders`

This is the same path the Clients & Deals UI uses for deletion, so the Staffing, Capacity, MBR, Financials, and Dashboard views all stay consistent.

## Why soft-delete (trash) instead of hard-delete
The Google Sheet sync edge function (`sheets-sync-deals`) reads `trash_items` and **skips re-inserting** any deal whose id is in the trash. Hard-deleting would let the next sync re-create them. Trash-routing both prevents re-import and lets an admin restore from the Trash page within 7 days if needed.

## Execution

1. Build the keep-set of 171 `deal_id` values in SQL.
2. For each `staffing_deals` row whose `deal_id` is NOT in the keep-set:
   - Insert a row into `trash_items` with `entity_type='staffing_deal'`, a snapshot of the parent row and all child rows from the 10 child tables above, `deleted_by_name='System (Sheet trim)'`.
   - Delete child rows from all 10 child tables.
   - Delete the parent `staffing_deals` row.
3. Verify: `SELECT count(*) FROM staffing_deals` returns 116; same query restricted to the keep-set also returns 116.

Done entirely via `supabase--insert` SQL (CTE + insert-into-trash + deletes). No code or schema changes.

## Notes / out of scope
- `clients` rows are not touched (deals can drop without removing the client).
- The 55 sheet IDs that aren't in the DB are left as-is; if you want them auto-created as empty/placeholder deals, say the word and I'll add a creation step.
- After approval and execution, the React Query caches refresh automatically via the existing realtime subscriptions on `staffing_deals` / `staffing_assignments`.
