I’ll fix this at the shared access/filter layer so it applies consistently across Clients & Deals, Staffing, Capacity/People view, and the BOPM read-only table.

Plan:

1. Tighten BOPM deal visibility
  - Update the shared deal-access logic so a BOPM user only sees deals where their mapped Settings/People record is actually present in the deal’s BOPM fields.
  - Stop stale staffing assignment rows from granting BOPM visibility.
  - Treat Principal/Senior BOPM matching as strict enough to avoid unrelated people/deals leaking in, while still handling real known aliases like abbreviated last names where appropriate.
2. Fix Shreshtha’s incorrect visibility
  - Specifically account for Shreshtha Pathak’s account issue by removing the current source of leakage: stale/ghost staffing assignment rows and overly broad name matching.
  - Her BOPM view will only show active deals where the deal sheet BOPM fields map to her person record.
  - Deals where she is only present in legacy staffing_assignments but not marked as Principal/Senior/BOPM on the deal will be excluded from her BOPM view.
3. Add a single shared helper for people/user-backed BOPM identity
  - Create reusable utilities to normalize names and match deal BOPM fields against actual active Settings → People records.
  - Use Settings → People / Users mapping as the source of truth for valid Principal and Senior BOPM users.
  - Exclude role placeholders like “Principal SEO Lead - Mumbai” or other non-user labels from BOPM filters.
4. Fix VSD BOPM filters in Clients & Deals and Staffing
  - For VSD view, the BOPM filter options will only include actual Principal BOPM and Senior BOPM people under that VSD from Settings → People reporting hierarchy.
  - A BOPM will be included only if:
    &nbsp;
    - their role title is Principal BOPM or Senior BOPM,
    - their reporting chain rolls up to that VSD,
      &nbsp;
  - This will apply in:
    - Clients & Deals VSD filter chips
    - Staffing table BOPM filter
    - Staffing People/Capacity BOPM filter
5. Keep VSD deal scope intact but remove incorrect filter options
  - VSDs will continue seeing their scoped deals.
  - The BOPM filter will no longer show non-user placeholders or BOPMs from outside that VSD’s reporting hierarchy.
  - If a person is not under that VSD in Settings → People, they will not appear in that VSD’s BOPM filter even if bad deal-sheet data references them.
6. Update affected files
  - `src/hooks/useDealAccess.ts`: stricter BOPM visibility and user-backed matching.
  - `src/hooks/useAppUsers.ts` or a new shared helper: reusable person/name/reporting helpers.
  - `src/components/access/BopmFilter.tsx`: options from Settings users/people hierarchy, not only raw deal text.
  - `src/pages/Clients.tsx`: use the corrected VSD-specific BOPM options.
  - `src/pages/Staffing.tsx`: pass the VSD scope into Staffing/Capacity filters.
  - `src/components/staffing/PeopleViewTab.tsx` and `src/components/staffing/BopmStaffingFlatTable.tsx`: consume the corrected filter options/scope.

Validation:

- Check Shreshtha Pathak’s mapped person record and visible deals after the fix.
- Confirm BOPM view no longer shows deals where the BOPM is not marked in the deal fields.
- Confirm VSD filter options only show Principal/Senior BOPM users under that VSD from Settings → People.
- Confirm Staffing table and People/Capacity view both filter by the selected VSD/BOPM consistently.
- Ensure no function is removed and admin/capability views continue to work as before.