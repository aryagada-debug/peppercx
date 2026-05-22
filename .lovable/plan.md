# Fixes for date picker, team add, and staffing add

## 1. Date picker — month/year up/down arrows not working

**Where:** `src/pages/DealDetail.tsx` (`EditableCell`, used in Contract Details on Overview) and the start/end date columns in `src/pages/Clients.tsx`.

**Cause:** We use a native `<input type="date">`. The previous bug-fix made it auto-commit + close on every `onChange`. When the user clicks the spinner/calendar's up-arrow in the field-level picker, each tick fires `onChange` with a valid (but partial) date, the cell immediately saves and unmounts the input, so the next click does nothing.

**Fix:** Replace the inline date input with a Shadcn DatePicker (Popover + Calendar) for any cell where `type="date"`. The calendar has reliable prev/next month arrows (`ChevronLeft`/`ChevronRight`) and only commits when the user selects a day, so opening the picker can't accidentally blank the value.

- `EditableCell` in `DealDetail.tsx`: when `type === "date"`, render a button trigger showing the formatted value and a `<Calendar mode="single">` inside `<Popover>`. On day select → call `onSave(formattedISO)` and close. Keep keyboard `Escape` to cancel.
- `Clients.tsx`: same treatment for the start/end inline date cells (they currently reuse `EditableCell`). Use `className="p-3 pointer-events-auto"` on the `<Calendar>` per Shadcn guidance.
- Keep the non-date branches of `EditableCell` untouched (number/text still use the existing `<Input>` flow).

## 2. Cannot add team members from the Team panel (Overview)

**Where:** `src/pages/DealDetail.tsx`, "Team" card inside the Overview tab (~lines 2178–2240).

**Cause:** The Team card only renders fixed rows for `VSD / Principal BOPM / Senior BOPM / BOPM` plus any *existing* extra assignments. There's no entry-point to add anyone else, and the popover dropdowns are limited to people whose `roleTitle` matches the row label, which is empty for most teams. So users can't add a new team member from this card at all.

**Fix:**
- Below the four core rows, render a "+ Add team member" button.
- Clicking it opens the existing `AddStaffingMemberDialog` (already used elsewhere) with `dealId={dealId}`, full `people` list, current `assignments`, and `onAdd={addAssignment}` (already imported). This lets the user pick team → person → allocation, the same flow as the Staffing tab.
- Wire the dialog's open state via local `useState` in the Overview tab.
- For VSD-only personas (already-handled `requestStaffingOpen` path on Staffing tab), the button instead opens `RequestStaffingDialog` to preserve the approval flow.

## 3. Staffing & Capacity – adding a user makes the deal "disappear" and the staffing is lost until refresh

**Where:** `src/components/staffing/BopmStaffingFlatTable.tsx` (the "Staffing" tab on `/staffing`), wired through `useStaffingMutations.addAssignment`.

**Root cause:** Two issues compound:
1. After `onAdd` fires we close the dialog and rely on the optimistic patch in `useStaffingMutations.addAssignment`. The mutation does `patch.assignments(prev => [...prev, assignment])` but then awaits the Supabase insert **without** invalidating the query cache and without rolling back on failure. If the insert fails (RLS, FK, dup id) the optimistic row persists silently and never refetches. The row also fails the `assignmentsByDeal` lookup because the assignment is missing `dealId`/`personId` fields that come from the dialog's `category` spread — `onAddAssignment({ ...assignment, roleKey: quickAdd.roleKey })` overrides `roleKey` but doesn't drop the unknown `category` field which `assignmentToDb` may pass through to the DB.
2. The Staffing tab's `filteredDeals` re-runs on every assignment change. With `activeOnly=true` (default) plus a BOPM/VSD filter, the new assignment briefly causes `bopmStaffedDealIds` and `vsdForDeal` to recompute. If the freshly-added person changes the deal's resolved VSD/BOPM set, the deal can drop out of the filtered list. After a page refresh the read query returns the canonical row and the deal re-appears (often in the same place) but the optimistic chip is gone — making it look like "the staffing isn't reflected".

**Fix:**
- In `useStaffingMutations.addAssignment`:
  - Wrap the insert in try/catch.
  - On error: roll back the optimistic patch (filter out the just-added id), `toast.error("Couldn't add staffing — please retry")`, and `console.error` the supabase error.
  - On success: still call `qc.invalidateQueries({ queryKey: qk.assignments() })` so any DB-side triggers (e.g. `_recompute_deal_bopm_field`) and `staffing_deals.bopm/vsd` updates are reflected — also invalidate `qk.deals()` because those columns are part of the deal row.
  - Apply the same rollback + invalidate to `updateAssignment` and `deleteAssignment` so the same regression can't bite the edit/remove flows.
- In `BopmStaffingFlatTable.tsx`:
  - When the user has a BOPM/VSD filter active and adds someone, do **not** drop the deal from view solely because the filter recomputed. Add a small "sticky" set of `recentlyTouchedDealIds` (cleared after 8 s or when filter changes) and OR it into the `bopmFiltered`/`vsdFiltered` predicate so a deal you just edited stays visible until the next read settles.
  - Strip the unused `category` field before forwarding to `onAddAssignment` (line ~1679) so the payload matches `StaffingAssignment` exactly.

## 4. Verification

- Add an integration test in `src/test/integration/sheets-sync-and-triggers.test.ts` (existing harness):
  - `addAssignment` happy-path: optimistic row appears, `assignments` and `deals` queries are invalidated, `staffing_deals.bopm` recomputes after the trigger.
  - `addAssignment` failure: forced insert error rolls back the optimistic row and surfaces a toast.
  - With a BOPM filter active, adding a person who is *not* that BOPM keeps the deal row visible until the next refetch.
- Manual smoke pass on `/clients`, `/deals/:id` (Overview), and `/staffing?tab=table` covering: date editing via calendar arrows, add team member from Team card, add staffing from the flat table.

## Files touched
- `src/pages/DealDetail.tsx` — `EditableCell` date branch + "Add team member" button + dialog wiring.
- `src/pages/Clients.tsx` — start/end date cells switch to calendar popover.
- `src/components/staffing/BopmStaffingFlatTable.tsx` — strip `category`, add `recentlyTouchedDealIds` exemption.
- `src/hooks/queries/useStaffingMutations.ts` — rollback + invalidate for add/update/delete assignment.
- `src/test/integration/sheets-sync-and-triggers.test.ts` — three new cases.
