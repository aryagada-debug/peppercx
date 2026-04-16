

# Fix Team Member Dropdowns in Deal Overview

## Problem
- VSD and other team role dropdowns show duplicate entries and don't support deselection (clicking the same person to unassign them)
- Changes need to sync to both `staffing_deals` fields and `staffing_assignments` table

## Solution

### 1. Replace `TeamMemberSelect` component with deselection support
- Change the `Select` component so selecting the already-selected person clears the field
- Add a dedicated "Clear" option or toggle behavior: if `onSelect` receives the current name, treat it as deselection
- On deselect: save empty string to the deal field AND remove the corresponding `staffing_assignments` row

### 2. Deduplicate people in dropdowns
- Add `.filter((v, i, arr) => arr.findIndex(x => x.name === v.name) === i)` to remove duplicate names from the people list passed to each `TeamMemberSelect`

### 3. Sync staffing assignments on deselect
- When a team member is deselected (cleared), call `handleDealFieldSave(field, "")` to clear the deal column
- Also find and delete the corresponding `staffing_assignments` record using `deleteAssignment` (or update to remove the person)

## Files Modified
- **`src/pages/DealDetail.tsx`**
  - Update `TeamMemberSelect` to support deselection (clicking same value clears it)
  - Deduplicate the `people` arrays passed to each dropdown
  - Add deselect logic in `onSelect` callbacks to clear deal field + remove assignment

