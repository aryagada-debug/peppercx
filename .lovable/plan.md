

# Enhance Add Member Dialog — Show Engagements & Group Ops by Role

## Summary

Two changes: (1) Redesign the Add Member dialog to match the reference image — after selecting a person, show their current engagements inline with deal names, role, allocation bars, and status badges, plus a capacity warning when at 100%. (2) In step 2 (member list), group Operations people by sub-role (VSD, Principal BOPM, Senior BOPM, BOPM) instead of a flat list.

## Changes — `src/pages/DealDetail.tsx`

### 1. Redesign Step 3 to match reference image

Replace the current minimal step 3 with a layout matching the uploaded reference:

- **Person dropdown** (read-only, showing selected name + role title)
- **Current engagements panel** below the person selector:
  - Header: `"{Name} — current engagements"` with capacity summary on right (`X% allocated · Y% free` in green/orange/red)
  - List of each deal assignment: `{Account} — {DealName}  {roleKey}  [progress bar]  {pct}%  Active` badge
  - If total utilization ≥ 100%, show a yellow warning banner: `"⚠ This person is already at {X}% capacity across other deals. Adding them may exceed 100%."`
- **Role on this deal** field (pre-filled with person's `roleTitle`, editable)
- **Allocation %** input field
- **Type** dropdown (Internal / External / Freelance) — default "Internal"
- **Footer**: Cancel + "Add to plan" button

### 2. Group Operations people by roleTitle in Step 2

When `selectedCategory === "Operations"`, instead of a flat list, group members under collapsible sub-headers by `roleTitle`:
- VSD
- Principal BOPM
- Senior BOPM
- BOPM

Each sub-header shows the count of available members. Members listed under their respective group. Other categories remain ungrouped (flat list).

### 3. State additions

- `roleOnDeal: string` — pre-filled from `selectedPerson.roleTitle`
- `assignmentType: "Internal" | "External" | "Freelance"` — default `"Internal"`

These get passed into `onAdd` (extend `StaffingAssignment` or just store locally for display).

## Files Modified

| File | Change |
|------|--------|
| `src/pages/DealDetail.tsx` | Redesign step 3 UI with engagements panel + warning; group Ops by roleTitle in step 2; add roleOnDeal and type fields |

