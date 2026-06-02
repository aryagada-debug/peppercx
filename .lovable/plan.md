
## Goal

Now that the Google Sheets sync is being stopped, remove the historical baggage that forced us to maintain three ID formats for the same deal. End state: every reference to a staffing deal uses the single prefixed key (`d_100472`) stored in `staffing_deals.id`.

## What changes

### 1. Database (single migration)

- **`staffing_deals`**: drop the `deal_id` column (the bare numeric form). `id` becomes the only deal identifier.
- **`staffing_assignments`**: rename `deal_id` → `staffing_deal_id` to reflect that it's an FK to `staffing_deals.id`, not the raw sheet ID. Add a proper FK constraint with `ON DELETE CASCADE`.
- **Database functions** that reference these columns get updated in the same migration:
  - `_recompute_deal_bopm_field` — uses `sa.deal_id`
  - `sync_bopm_fields_from_assignment` — trigger on `staffing_assignments` referencing `NEW.deal_id` / `OLD.deal_id`
  - `reset_staffing_on_inactive_deal` — `DELETE FROM staffing_assignments WHERE deal_id = …`
  - `visible_deal_ids_for_user` — `sa.deal_id = d.id`
- Drop / disable the `sheets-sync-deals` edge function path (file removal handled in step 3).

### 2. Frontend code

Every read/write to `staffing_assignments.deal_id` becomes `staffing_deal_id`. Every read of `staffing_deals.deal_id` is removed. The triple-key fallback in `AddStaffingMemberDialog` collapses to a single lookup by `id`.

Files touched:

- `src/lib/dbMappers.ts` — drop `dealId` field from `Deal`/`dealToDb`; rename in assignment mappers.
- `src/types/dashboard.ts` (or wherever `Deal` / `StaffingAssignment` types live) — drop `dealId` from `Deal`, rename `dealId`→`staffingDealId` on assignment type.
- `src/hooks/queries/useDealsLiteQuery.ts` — remove `deal_id` from select & interface.
- `src/hooks/queries/useAssignmentsQuery.ts`, `useStaffingMutations.ts`, `useStaffingQueries.ts`, `useDealApplicabilityQuery.ts`, `useVsdHierarchyQuery.ts` — column rename.
- `src/components/staffing/AddStaffingMemberDialog.tsx` — remove the 3-key map, index by `id` only.
- All other staffing components that filter assignments by `deal_id` (DealStaffingCard, WeeklyStaffingGrid, MatrixTab, etc.).
- `src/test/integration/sheets-sync-and-triggers.test.ts` — remove or skip; sync is gone.

### 3. Edge functions & sync

- Delete `supabase/functions/sheets-sync-deals/`.
- Remove its config block from `supabase/config.toml` if present.
- Other edge functions (`weekly-summary-*`, `mbr-reminders`, `staffing-capacity-reminders`, `slack-events`) get the column rename only.

### 4. Regenerated types

`src/integrations/supabase/types.ts` regenerates automatically after the migration runs.

## Order of execution

1. Submit the migration (schema + function updates) — wait for approval.
2. After migration runs, push all code changes in one batch so the build never sees a stale column reference.
3. Delete the sheets-sync edge function.
4. Smoke test: Staffing page loads, AddStaffingMemberDialog shows deal names, assignments can be created/deleted, BOPM fields recompute.

## Risk / rollback

- The rename is a single `ALTER TABLE … RENAME COLUMN`, fast and reversible.
- Dropping `staffing_deals.deal_id` is destructive — once gone, the raw sheet IDs are not recoverable from this DB. Since sync is being stopped, that's intended; if you ever need to reconnect a sheet you'd re-import.
- If anything in production depends on the bare numeric ID (e.g. external links, Slack channel names), flag it now before I run the migration.

## Question before I start

Do you want me to **fully delete** the `sheets-sync-deals` edge function, or just stop scheduling it and leave the code in place as a safety net for a few weeks? Same question for `staffing_deals.deal_id` — drop the column outright, or keep it for one release as nullable + unused?
