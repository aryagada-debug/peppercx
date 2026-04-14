

# Clients & Deals Tabular View + Deal Overview Sync

## Summary

Three interconnected changes: (1) Redesign the Clients page to show a flat tabular view with editable VSD, P.BOPM/Sr BOPM, MRR, and Total Revenue columns linked to the deal's staffing and financials data. (2) Rebuild the Deal Overview Team section to reflect actual staffing assignments with role-filtered dropdowns. (3) Wire the Overview tab's RGY health section through the same `handleRGYSave` logic (issue form on Y/R, green-gate on G).

## Changes

### 1. Clients & Deals Page — Flat Tabular View (`src/pages/Clients.tsx`)

Replace the current collapsible client-group layout with a flat, spreadsheet-style table. Each row = one deal.

**Columns**: Client | Deal Name | Deal ID | Type | Status (dropdown) | VSD (dropdown) | P.BOPM / Sr BOPM (dropdown) | MRR (inline edit) | Total Revenue (inline edit) | RGY (dot) | Actions

**Editable columns**:
- **VSD**: Dropdown populated from `people.filter(p => p.roleTitle includes "VSD")`. On change, call `updateDeal(deal.id, { vsd: selectedName })` AND update/create a staffing assignment for that person on the deal.
- **P.BOPM / Sr BOPM**: Dropdown from people with roleTitle containing "Principal BOPM" or "Senior BOPM". Same dual update.
- **MRR & Total Revenue**: Inline editable numeric cells using the existing `EditableCell` pattern, calling `updateDeal`.
- **Status**: Already exists as a dropdown — keep as-is.

Import `people` from `useStaffingData` to populate dropdowns. Keep the client grouping toggle as an option (flat vs grouped view toggle button).

### 2. Deal Overview — Team from Staffing (`src/pages/DealDetail.tsx`)

Replace the current `TeamMemberRow` free-text edit with dropdown selects sourced from `people`:

- **VSD row**: Dropdown of people where `roleTitle` contains "VSD"
- **Principal BOPM row**: Dropdown of people where `roleTitle` contains "Principal BOPM"
- **Senior BOPM row**: Dropdown of people where `roleTitle` contains "Senior BOPM"
- **BOPM row**: Dropdown of people where `roleTitle` contains "BOPM" (but not Senior/Principal)

On selection:
1. Update `deal.vsd` / `deal.principalBopm` / etc. via `updateDeal`
2. Create or update a staffing assignment (`addAssignment` / `updateAssignment`) linking that person to the deal with a default allocation

Show additional assigned members (from staffing tab) below the core 4 roles, grouped by category (SEO, Content, Creative, etc.) with their allocation %.

### 3. Overview RGY — Full Edit Rules (`src/pages/DealDetail.tsx`)

The Overview tab already renders `<EditableRGY>` connected to `handleRGYSave` (line 1412-1421), which already includes:
- Green-gate validation (blocking Green if open tasks exist)
- Issue form trigger on Y/R save
- Snapshot + revert on cancel

Verify the `showIssueForm` state and `<RGYIssueForm>` component render within the Overview tab section (currently they only render in the RGY Health tab). Move or duplicate the issue form rendering so it also appears in the Overview tab after an RGY save triggers `setShowIssueForm(true)`.

Also render the green-gate `AlertDialog` when triggered from the Overview tab's EditableRGY.

### 4. New `TeamMemberSelect` Component

Create a small reusable component (inline in DealDetail.tsx or extracted):
- Props: `role: string`, `currentName: string`, `people: Person[]`, `onSelect: (person: Person) => void`
- Renders: Avatar + name + role label, with a `Select` dropdown on click showing filtered people
- Reused in both the Clients table and the Deal Overview Team section

## Files Modified

| File | Change |
|------|--------|
| `src/pages/Clients.tsx` | Flat tabular layout, editable VSD/BOPM dropdowns from `people`, inline MRR/revenue editing |
| `src/pages/DealDetail.tsx` | Team section uses dropdowns from `people` by role, syncs with staffing assignments; RGY issue form + green-gate rendered in Overview tab |

