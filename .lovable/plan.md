# Fix People View: VSD grouping + indentation + background tint

## Root cause

The 5 VSDs (Sneha, Aamir, Aditya, Sumit, Neema) have no entries in `assignments`, so the current filter `assignedPersonIds.has(p.id)` removes them from `visiblePeople`. With the VSD missing:

- Their BOPMs no longer find a manager in the visible set → each BOPM becomes its own root row.
- The `VSD_GROUP_BG` tinting only kicks in for descendants of a rendered VSD → no background tint.
- Indentation (`depth * 28px`) is reset to 0 for every BOPM → no nesting.

So even though the data is correct, the view never builds the VSD → BOPM tree.

## Fix

In `src/components/staffing/PeopleViewTab.tsx`:

1. **Always include the 5 VSDs in `visiblePeople`**, regardless of whether they have assignments. Detect them via the existing `VSD_NAMES` set or `roleTitle === "VSD"`.
2. Keep the rest of the inclusion rule unchanged (assigned + mapped to one of the 5 dept groups + not TBH).
3. Inside the "Delivery Ops and CS" group, sort roots so VSDs render in a fixed order (Sneha, Aamir, Aditya, Sumit, Neema) before any non-VSD roots.
4. For VSD rows whose totals are zero (no assignments), display dashes for MRR / Total Rev / Hours instead of `₹0` to keep the row readable. Children continue to render their real numbers.
5. Auto-expand the "Delivery Ops and CS" department and the 5 VSD rows on first mount so the hierarchy is visible by default. The existing Expand/Collapse toggle continues to work.
6. Keep everything else (zebra striping for non-VSD subtrees, 28px indent per depth, `VSD_GROUP_BG` tint passed down to descendants, dot color per dept) as-is.

## Result

```text
▼ ● Delivery Ops and CS
    Sneha Iyer            VSD               —    —    —
      Vrusha Mawani       Group BOPM        …    …    …     ← tinted info/[0.06]
      Sumitha Shetty      Group BOPM        …    …    …     ← tinted
      …
    Aamir Khan            VSD               —    —    —
      Vanshika Khandelia  Senior BOPM       …    …    …     ← tinted warning/[0.06]
      Tushar Walia        Principal BOPM    …    …    …     ← tinted
      …
    Aditya Shaw           VSD               —    —    —
      Shreshtha Pathak    Principal BOPM    …    …    …     ← tinted positive/[0.06]
      …
    Sumit Shekhawat       VSD               —    —    —
      Karna Shah          Senior BOPM       …    …    …     ← tinted primary/[0.05]
      …
    Neema Jayadas         VSD               —    —    —
      Tiffany Fernandes   Senior BOPM       …    …    …     ← tinted destructive/[0.05]
      …
```

## Files

- `src/components/staffing/PeopleViewTab.tsx` (only file)
