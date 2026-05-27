## Problem

Non-admin users see zero deals after login. `useDealAccess` resolves visibility from `profiles.staffing_person_id` → `staffing_people`, but that FK is stale: 0 of 251 mapped profiles point at a current `staffing_people.id` (People sheet was re-synced and IDs changed from `P###`/`id_*` to `p_<name>`).

## Fix

### 1. One-time backfill migration

New migration that, for every profile, finds the matching active `staffing_people` row by email (case-insensitive, `leaving=false`, `tbh=false`) and updates `profiles.staffing_person_id` when the current value is missing or no longer exists:

```sql
update public.profiles p
   set staffing_person_id = sp.id,
       updated_at = now()
  from auth.users u
  join public.staffing_people sp
    on lower(sp.email) = lower(u.email)
   and sp.leaving = false
   and sp.tbh = false
 where p.user_id = u.id
   and (
        p.staffing_person_id is null
        or p.staffing_person_id = ''
        or not exists (
            select 1 from public.staffing_people sp2
            where sp2.id = p.staffing_person_id
        )
   );
```

### 2. Keep it from drifting again

Add an `AFTER INSERT/UPDATE` trigger on `public.staffing_people` (SECURITY DEFINER) that, whenever a row is inserted or its email/id changes, relinks any `profiles` row whose email matches and whose current `staffing_person_id` is null or no longer valid. This makes future Sheets re-syncs self-healing.

### 3. Verification

- Re-run the diagnostic query: expect "relinkable" count to drop to ~0 and the "matches existing staffing_people" count to jump to ~all profiles with an email match.
- Log in as Aditya Shaw (or any affected user) and confirm Clients & Deals lists their tagged deals.

## Out of scope

- No changes to `useDealAccess.ts` — the logic is correct; only the underlying data is broken.
- No changes to the Google Sheets sync (it can keep generating new IDs; the trigger handles it).
- Profiles that have no email match in `staffing_people` (e.g. people not yet in the directory) will remain unmapped — that's the existing `BopmEmptyState` flow.
