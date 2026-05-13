# Fix: Staffing & Capacity blank screen for Admin

## What's happening

Admin users land on `/staffing` and see a blank screen (crash). The page mounts three heavy tabs at once for non-BOPM personas (`DealViewTab`, `PeopleViewTab`, `BopmStaffingFlatTable` with `directEdit`), all fed the full unscoped `deals` / `people` / `assignments` arrays. Any unhandled exception in any of those subtrees takes the whole route down to a blank screen because there is no error boundary between `<AppLayout>` and the tab panels.

There are also two latent issues likely contributing:

1. `useStaffingData` swallows load errors in `catch` (only `console.error`) and leaves the page rendering with empty arrays — fine — but if a *partial* response returns malformed rows (e.g. an assignment referencing a missing person/deal), downstream components that key on `people.find(...)!` crash inside React's render and propagate.
2. `Staffing.tsx` recently grew the `myVsdName` resolution effect that runs even for true admins. Admins don't need it, and a transient profile/staffing_people lookup failure can throw inside the async IIFE (no try/catch).

## Plan

### 1. Add an error boundary around the staffing tabs
Create `src/components/staffing/StaffingErrorBoundary.tsx` (small class component) and wrap the tab panel area in `Staffing.tsx` so a render crash surfaces a "Something went wrong" card with the error message + a Retry button instead of a blank route. This both fixes the symptom and gives us the real stack on screen.

### 2. Harden `Staffing.tsx`
- Wrap the `myVsdName` async IIFE in `try/catch` so a Supabase hiccup can't leak an unhandled rejection.
- Skip the whole VSD-name lookup when the user is an actual admin (use `isAdmin`/`isActuallyAdmin` from `useUserRole`) — admins don't need pod scoping for the BOPM filter.
- Memoize `scopedDeals`, `scopedAssignments`, `activeBopmDeals`, `bopmActiveAssignments`, `scopedPeople` so identity is stable across renders (avoids repeated re-mount of the heavy table on unrelated state changes).

### 3. Defensive guards in the heavy tables
- In `BopmStaffingFlatTable` (admin's `directEdit` mount): when looking up a person/deal by id from an assignment, fall back to a "missing" placeholder instead of dereferencing `undefined`. Same in `DealViewTab` / `PeopleViewTab` for any `.find(...)!` style access.
- Filter out assignments whose `personId`/`dealId` no longer exist in the current data set before rendering (the data is async — these can briefly point at deleted rows).

### 4. Verify
- Navigate the preview to `/staffing` as the admin user, screenshot, and read browser console logs to confirm there are no React errors and the three tabs render.
- Switch tabs (Deal view → People view → Staffing) and confirm no crash and no warnings.
- Toggle back to a BOPM persona via the Role Switcher and confirm the BOPM path still works.

## Files to touch

- `src/components/staffing/StaffingErrorBoundary.tsx` (new)
- `src/pages/Staffing.tsx` (wrap tabs, harden VSD effect, memoize derived arrays, skip lookup for admin)
- `src/components/staffing/BopmStaffingFlatTable.tsx` (defensive lookups, filter orphan assignments) — minimal touch
- `src/components/staffing/DealViewTab.tsx` and `PeopleViewTab.tsx` — only if step 4 surfaces a crash there

## Out of scope

- Any data-model or RLS changes.
- Visual/UX changes to the tabs themselves.
- Changes to the BOPM-only flow beyond making sure it still works.
