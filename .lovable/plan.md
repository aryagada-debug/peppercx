# Auto-suggest designations in Staffing when no handover suggestions exist

For deal 11111 (and any deal not created via the "Send all to Staffing" handover step), the `SuggestedStaffingPanel` reads `staffing_suggestions` and finds none, so nothing renders. The suggestion logic currently only runs inside the Handover wizard.

Move the "compute suggestions from comparable deals" logic into the Staffing panel itself so every deal gets designation suggestions automatically, using its own `business_unit`, `capability_line`, `vsd`, `deal_type`, and `mrr`.

## Changes

**1. `src/components/staffing/SuggestedStaffingPanel.tsx`**
- Add a second query `computed-staffing-suggestions` keyed by deal id + its attributes. Port the scoring/aggregation from `SuggestedStaffingCard.tsx`:
  - Fetch up to 800 `staffing_deals`, score by capability(+3) / BU(+2) / VSD(+2) / deal_type(+1) / MRR within ±30%(+1), take top 5.
  - Fetch their `staffing_assignments` and group by normalized `role_key`, computing `frequency` and `medianPct`.
  - Ensure a `vsd` row exists if the deal has a VSD.
- Merge: if there are pending rows in `staffing_suggestions`, show those (existing behaviour). Otherwise, render the computed rows as ephemeral suggestions with the same UI. Ephemeral rows have no db id; "Assign person" opens `AddStaffingMemberDialog` with role/pct prefilled and, on add, we just call `onAddAssignment` (no `updateStatus`). "Dismiss" hides the row locally via component state (Set of dismissed role keys).
- Skip roles already staffed on this deal (based on `assignments` prop) so we don't suggest duplicates.
- Empty state: only truly hide the panel if both persisted and computed lists are empty.

**2. No changes** to the handover card, DB schema, or edge functions.

## Out of scope
- Persisting the computed suggestions to `staffing_suggestions` (kept ephemeral so we don't pollute the table for every deal view).
- Changing scoring weights or adding new role taxonomy.
