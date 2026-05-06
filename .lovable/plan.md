## Restore strict role filter in Staffing & Capacity

The user confirms today's tiered candidate resolution (Tier 1 exact + Tier 2 family + Tier 3 other) over-matched and broke the picker. Revert the filter to the strict pre-change behavior while keeping the recently added functionality (date pickers, single-source-of-truth sync, realtime approval refetch).

### Changes — `src/components/staffing/BopmStaffingFlatTable.tsx`

1. **Restore strict candidate matching**
   - `resolvePeopleForRole(rk, allPeople)` returns only people whose `roleTitle` (lowercased) is in `ROLE_TO_PEOPLE_FILTER[rk]`.
   - Keep the `PersonGroups` shape for compatibility, but populate only `exact`; leave `family` and `other` as empty arrays.
   - Remove the `ROLE_DESIGNATION_KEYWORDS` map and the same-category fallback logic added today.
   - Continue excluding `p.leaving`.

2. **Simplify `PersonPickerPopover`**
   - When `candidateGroups` is supplied, render a single flat list from `exact` (no "Best match / Same role family / Other team members" sections, no "Show all" toggle).
   - Keep manager soft-sort: if `managerName` is provided, that manager's direct reports float to the top of the list (sorting only — no hard filter).
   - Keep richer row metadata (designation, pod) and the existing search/empty-state behavior.

3. **Preserve unrelated improvements**
   - Start/end date pickers per assignment row — unchanged.
   - `useStaffingData` single-source-of-truth wiring — unchanged.
   - Realtime listener on `approval_requests` that clears staged drafts and refetches — unchanged.
   - `supabase/functions/approval-execute` date persistence — unchanged.

### Files edited
- `src/components/staffing/BopmStaffingFlatTable.tsx` (revert resolver + picker UI to strict mode)

No DB migrations or edge function changes required.
