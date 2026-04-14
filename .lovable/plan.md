

# Fix RGY Issue Form as Popup + Staffing Availability Dialog in Clients & Deals

## Summary

Two fixes: (1) Convert the inline `RGYIssueForm` into a modal dialog so it appears as a popup over the page, and revert RGY status on cancel — applies to both Overview and RGY Health tabs. (2) When VSD or BOPM is changed via dropdown in the Clients & Deals page, show the same `AddStaffingMemberDialog` (with engagements panel + capacity warning) instead of silently assigning.

## Changes

### 1. RGY Issue Form as Dialog (`src/pages/DealDetail.tsx`)

Wrap the `RGYIssueForm` component's return JSX inside a `<Dialog>` (from `@/components/ui/dialog`). The form is currently rendered inline as a `<div>` at line 793. Change it to:

- Wrap in `<Dialog open={true}>` + `<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">`
- Move the Cancel button to trigger `onCancel` (which already reverts via `prevRGYSnapshot`)
- Close the dialog on cancel or successful save
- Both the Overview tab instance (line 1526) and the RGY Health tab instance (line 1880) already pass the same `onCancel` revert logic — no changes needed there, just the form itself becoming a dialog

### 2. Staffing Availability Dialog in Clients & Deals (`src/pages/Clients.tsx`)

Currently `handleVSDChange` and `handleBOPMChange` silently assign a person on dropdown change. Instead:

- Add state for a staffing dialog: `staffingDialogOpen`, `staffingDialogDealId`, `staffingDialogRoleFilter` (VSD or BOPM)
- When VSD or BOPM dropdown value changes, instead of calling `handleVSDChange`/`handleBOPMChange` directly, open the `AddStaffingMemberDialog` pre-filtered to the relevant role category (Operations) and pre-selected to the chosen person
- Import and render the `AddStaffingMemberDialog` component (it's currently defined inside `DealDetail.tsx` — extract it to a shared component file first, or duplicate the key parts)

**Approach**: Extract `AddStaffingMemberDialog` from `DealDetail.tsx` into `src/components/staffing/AddStaffingMemberDialog.tsx` so it can be reused in both `DealDetail.tsx` and `Clients.tsx`.

- In `Clients.tsx`, replace the simple `Select` dropdowns for VSD and BOPM with buttons that open the staffing dialog
- The dialog shows the engagements panel, capacity warning, and allocation input — same UX as the Staffing tab
- On confirm, run the existing `handleVSDChange`/`handleBOPMChange` logic

## Files Modified

| File | Change |
|------|--------|
| `src/pages/DealDetail.tsx` | Wrap `RGYIssueForm` return in `<Dialog>`; import from extracted `AddStaffingMemberDialog` |
| `src/components/staffing/AddStaffingMemberDialog.tsx` | New file — extracted from `DealDetail.tsx` |
| `src/pages/Clients.tsx` | Import `AddStaffingMemberDialog`; replace VSD/BOPM dropdowns with dialog trigger; add dialog state and render |

