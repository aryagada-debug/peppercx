I audited the current Staffing & Capacity implementation and the live data for Shreshtha. The core issue is that some Staffing/Capacity calculations still use assignment rows and local component filters in ways that can drift from the canonical deal access rules. I will make the Staffing page use one shared, strict scoped dataset across deal view, people/capacity view, and table view.

Findings from the audit:

- Shreshtha Pathak is mapped to staffing person `P543` and has exactly 7 active tagged deals in the deal sheet.
- There are legacy `staffing_assignments` rows for Shreshtha on completed deals where the VSD/BOPM fields do not match her; these rows must never grant BOPM visibility.
- `useDealAccess` is already mostly strict, but Staffing components still apply BOPM filters with incomplete identity context and some table/capacity summary calculations are not fully synced to the filtered deal set.
- The VSD BOPM filter exists in some Staffing components, but it is not consistently rendered in the same way as Clients & Deals, especially for the Capacity/People view and the Staffing table header.

Plan:

1. Create one shared strict BOPM matching path
  - Update `dealMatchesBopm` so it can use the full Settings -> People name registry instead of passing an empty registry.
  - This will keep exact matches working, allow unambiguous initials like `Shreshtha P`, and block ambiguous/blank matches.
  - Use the same helper everywhere: Clients & Deals, Staffing deal view, Capacity/People view, and Staffing table.
2. Make BOPM view in Staffing rely only on tagged active deals
  - In `Staffing.tsx`, keep BOPM visibility strictly based on `visibleDealIds` from `useDealAccess` plus active deal statuses.
  - Filter assignments only after the final active visible deal set is created.
  - Ensure Shreshtha’s Staffing table uses the same final active deal list as the header count, so it should show 7 active deals and no deals with blank/mismatched VSD/Principal/Senior BOPM fields.
3. Sync Staffing and Capacity filtering
  - In `PeopleViewTab` (Capacity), apply the BOPM-selected deal set before deriving:
    - assignments
    - visible people
    - person utilisation
    - active deal counts
    - bucket counts
  - In `BopmStaffingFlatTable` (Staffing), make the top stats and “add person to deal” list use the BOPM-filtered deal universe, not the unfiltered input deals.
  - In `DealViewTab`, apply the same strict BOPM matcher and include all relevant dependencies so filter state updates correctly.
4. Add the VSD BOPM filter consistently
  - For VSD view, render the BOPM filter in:
    - Deal view
    - Capacity / People view
    - Staffing table view
  - Source options only from Settings -> Users / People hierarchy through `useBopmDirectory`, scoped to the logged-in VSD’s reporting chain.
  - Keep role-placeholder labels out of the dropdown, e.g. “Principal SEO Lead - Mumbai” must not appear.
5. Fix admin “view as VSD” edge case
  - If an admin uses the role switcher to view as VSD but there is no real VSD person mapped to that login, show the BOPM filter with all real Principal/Senior BOPMs instead of hiding it.
  - If a real VSD is logged in, scope the dropdown to that VSD only.
6. Verification/audit after implementation
  - Re-run data checks for Shreshtha:
    - active tagged deal count = 7
    - no active visible deals with blank VSD and blank Principal/Senior BOPM fields
    - legacy assignment-only completed deals do not appear in BOPM Staffing view
  - Inspect/verify the `/staffing` UI paths:
    - BOPM view table count and rows align
    - VSD Deal view has BOPM filter
    - VSD Capacity/People view has BOPM filter
    - VSD Staffing table has BOPM filter
  - Search the code for any remaining Staffing/Capacity BOPM filtering paths that bypass the strict helper.

Files expected to change:

- `src/components/access/BopmFilter.tsx`
- `src/pages/Staffing.tsx`
- `src/components/staffing/DealViewTab.tsx`
- `src/components/staffing/PeopleViewTab.tsx`
- `src/components/staffing/BopmStaffingFlatTable.tsx`
- Possibly `src/hooks/useAppUsers.ts` only if a small exported helper is needed for the shared name registry.

No database migration is expected; this is an application logic/scoping fix.  
  
Do this so that all BOPMs accounts are accurate and there are no leaks