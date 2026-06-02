## Goal

When staffing a deal, let the user create a "TBH" (To Be Hired) placeholder for any specific role type on the fly, then assign that placeholder to the deal like a real person. These TBH placeholders flow automatically into the existing Hiring Gaps views.

## Where the change lands

**1. `AddStaffingMemberDialog` (the dialog used by Deal/People staffing flows)**

- On Step 2 (Role Type → People list), add a small "+ Add TBH for this role" button at the top of the people list, visible once a Role Type is selected.
- Clicking it opens an inline mini-form (name + optional region/band; department + role type are pre-filled from the current selection).
- On save:
  - Create a new `staffing_people` row with `tbh = true`, `leaving = false`, `department_id` and `role_type_id` set from the current Step 2 selection, `name` like "TBH — {Role Type}" (editable), no email.
  - Insert it into the people cache so it appears immediately in the list.
  - Auto-advance to Step 3 with the new TBH pre-selected so the user can set allocation, start/end dates, and assign it to the deal in one flow.
- TBH placeholders already render with a yellow "TBH" badge in the dialog (lines 327, 390, 426) — no badge changes needed.

**2. People data / mutation plumbing**

- Reuse the existing "add person" mutation path used by `AddPersonDialog` (writes to `staffing_people`). Pass `tbh: true` and the chosen role-type/department.
- The dialog receives `onAddTbhPerson` via props from the parent (Staffing page / Deal staffing card) so the same query cache update used elsewhere is reused — no new query layer.

**3. Hiring Gaps**

- No logic change needed. Both `src/components/staffing/HiringGapTab.tsx` and `src/components/people-ops/PeopleOpsHiringGapTab.tsx` already group by `p.tbh` and bucket by `roleCategory`. Newly-added TBH rows will appear automatically.
- Small polish: in the People-Ops Hiring Plan list and the Staffing "TBH Placeholders" card, show the **Role Type** (from taxonomy) next to the name when present, so a "TBH — Sr. SEO Manager" reads cleanly.

## Out of scope

- No schema migration. `staffing_people.tbh` already exists.
- No changes to assignment validation; TBHs are assignable today via the People list, just not discoverable from the staffing flow.
- No changes to capacity math (TBHs are excluded by existing `!p.tbh` filters).

## Acceptance

- From any deal's "Add staffing member" flow, after picking a Role Type, a user can click "+ Add TBH" and create a placeholder in two clicks.
- The new TBH appears in the People list of that role type, in the Hiring Gaps net-gap table (counted in the TBH column), and in the People-Ops Hiring Plan list.
- TBHs still cannot log into the app and are still excluded from capacity utilization.
