I’ll fix this in the staffing access path, not just in display filters.

Planned changes:

1. Tighten BOPM visibility in `useDealAccess.ts`
   - For role `BOPM` (`user`), visible deals will be computed only from the deal sheet BOPM fields:
     - `principal_bopm`
     - `senior_bopm`
     - `bopm`
   - It will not use `staffing_assignments` for visibility, so stale/ghost staffed rows cannot leak deals.
   - I’ll add an active-deal guard for BOPM staffing scope so Shreshtha’s staffing/capacity surface reflects only active tagged deals.
   - I’ll strengthen matching to reject blank BOPM/VSD fields and avoid fuzzy matches that can accidentally include blank/incorrectly tagged deals.

2. Fix Shreshtha-specific mismatch behavior
   - I verified Shreshtha is mapped to person `P543` and has exactly 7 active deals where `principal_bopm = Shreshtha Pathak` in the current data.
   - There are also stale assignment rows for Shreshtha on completed deals where she is not marked as principal/senior/BOPM. Those must not drive BOPM visibility.
   - I’ll ensure the Staffing table, capacity/people view, and change-request list all consume the corrected active tagged deal set.

3. Add the VSD BOPM filter to Staffing & Capacity consistently
   - In `src/pages/Staffing.tsx`, resolve the current VSD’s canonical name, same as Clients & Deals.
   - Pass that VSD scope into:
     - `DealViewTab`
     - `PeopleViewTab` / Capacity view
     - `BopmStaffingFlatTable` / Staffing table
   - This makes the dropdown options come from Settings → People reporting hierarchy, showing only Principal/Senior BOPMs under that VSD.

4. Make BOPM filtering use strict identity matching
   - Update `dealMatchesBopm` so it uses the same strict registered-person matcher as access control, rather than simple normalized equality.
   - This will handle cases like `Shreshtha P` vs `Shreshtha Pathak` safely while still preventing ambiguous matches.

5. Clean up stale comments and data flow
   - Update misleading comments in `Staffing.tsx` that still describe older VSD/BOPM expansion behavior.
   - Ensure `scopedAssignments`, displayed counts, and capacity metrics are derived from the same scoped deal IDs.

Expected result:
- Shreshtha’s BOPM staffing view should show only her 7 active tagged deals.
- Deals with blank VSD + blank Principal/Senior BOPM will not appear in her BOPM staffing view.
- VSD Staffing and Capacity views will have the same hierarchy-based BOPM filter behavior as Clients & Deals.