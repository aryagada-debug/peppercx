## Goal

Bring back the original inline person dropdown logic in the staffing table cells (a quick, role-filtered list of people right under each role column), while keeping the new engagement-aware dialog (with start/end date pickers, current engagements, capacity warnings) available for deeper edits.

Today, every click on a cell — even just swapping a person — opens the full `AddStaffingMemberDialog`. That removed the fast inline picker users preferred. We want both: fast picker as default, full dialog as an explicit "advanced" action.

## What changes

### 1. `src/components/staffing/BopmStaffingFlatTable.tsx`

**Cell "+ add" button** (currently opens `AddStaffingMemberDialog` via `setAddCell`)
- Restore inline `PersonPickerPopover` as the trigger. Candidates = `pickerOptions` already computed (role + manager filtered, excludes already-staffed).
- Selecting a person stages an add immediately with default allocation (50%) and the deal's start/end dates as defaults — same behavior as the legacy version.
- Add a small "More options…" footer row inside the popover that opens the full `AddStaffingMemberDialog` (current `setAddCell` flow) for cases where the user wants to set custom dates, allocation, or see engagement details before adding.

**Existing entry name button** (currently opens dialog in edit mode via `setEditEntry`)
- Replace with `PersonPickerPopover` for quick person-swap (same candidates as today's `colMatches`).
- Add a "Edit dates & engagement…" footer item that opens the existing `AddStaffingMemberDialog` edit flow (`setEditEntry`) for date/allocation edits with engagement context.

**Result**: one click → list of valid people; two clicks → quick swap. Power users still reach the full dialog explicitly.

### 2. Other staffing surfaces

`DealLevelView.tsx` and `PeopleLevelView.tsx` already use the dialog for adds. Per the user message ("there should just be those options of people under each table"), apply the same pattern in the BOPM flat table primarily; leave VSD/Admin deal-level "Add staffing member" CTA opening the full dialog (it has no per-cell list to inline into).

### 3. Behavior preserved

- `directEdit` vs staged-batch path is unchanged — the inline picker still calls `stageAdd` / `stageUpdate`.
- Date defaults for inline-add come from `deal.startDate` / `deal.endDate` (so end-date-aware expiry still works).
- Engagement-aware dialog continues to be the editor used inside the Central CX approval drawer (`StaffingApprovalEditor`) — no change there.

## Files to edit

- `src/components/staffing/BopmStaffingFlatTable.tsx` — swap cell add trigger and entry name trigger to `PersonPickerPopover` with a "More options…" / "Edit dates…" escape hatch into `AddStaffingMemberDialog`.

No new files. No schema changes.
