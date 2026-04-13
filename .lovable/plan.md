# Add Team Members to Deal Staffing Tab

## Summary

Add an "Add Member" flow to the Deal → Staffing tab. User picks a team/category first, then sees available people in that team with their current capacity utilization, selects one, sets allocation %, and assigns them to the deal.

## Changes

### 1. Add Member Dialog (`src/pages/DealDetail.tsx`)

Add a new `AddStaffingMemberDialog` component within the file:

- **Step 1 — Select Team**: Show buttons/cards for each `roleCategory` (Operations, SEO, Content, Creative Art, Creative Copy, Video, Content Strategy, Creative Strategy, Performance & Growth)
- **Step 2 — Select Person**: Filter `people` by selected category, excluding already-assigned members. For each person show:
  - Name, role title, pod, region
  - **Current capacity**: Calculate total allocation across all deals from `assignments` and show as a utilization bar (e.g., "65% allocated across 4 deals")
  - **Deal breakdown**: Expandable list showing each deal they're on with the % allocation (like their existing capacity mapping)
  - Highlight if person is `leaving` or `tbh`
- **Step 3 — Set Allocation**: Input field for allocation % for this deal, then confirm

On confirm, call `addAssignment` with a new `StaffingAssignment` record.

### 2. Remove Member Button

Add a trash icon on each member row in the staffing table. On click, confirm and call `deleteAssignment` to remove them from the deal.

### 3. Edit Allocation Inline

Make the allocation % column editable (click to edit). On save, call `updateAssignment`.

### 4. Wire up missing hook functions

The `DealDetail` component currently destructures only `{ deals, people, assignments, loading, updateDeal, updatePerson }` from `useStaffingData`. Need to also pull `addAssignment`, `updateAssignment`, `deleteAssignment`.

## Technical Details

- `addAssignment` already exists in `useStaffingData` hook — just needs to be destructured in `DealDetail`
- Assignment ID generated via `uid()` helper from `staffingData.ts`
- Capacity calculation: `assignments.filter(a => a.personId === person.id).reduce(sum allocationPct)` gives total utilization
- Per-deal breakdown: join `assignments` with `deals` to show deal name + allocation for the selected person  
Reflect the same changes in the overall staffing tab 

## Files Modified


| File                       | Change                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/pages/DealDetail.tsx` | Add `AddStaffingMemberDialog`, remove/edit assignment buttons, destructure additional hook functions |
