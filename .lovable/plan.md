

# Compact Accounts Table with Team Chips + Expand Drawer

## Problem
The Accounts table currently renders every role-category slot as a separate column (VSD, BOPM, Content, SEO, Creative, etc.), creating extremely wide rows. The user wants the Kindred Companion pattern: a compact main row with team badges, and staffing done inside the expanded row only.

## Changes

### Remove inline role-category columns from the main table
Strip all `visibleSlots.map(...)` columns from both `<thead>` and `<tbody>`. Replace with a single **"Team"** column that shows compact `PersonBadge` chips (name + %) for all assigned people on that deal, grouped visually. This mirrors Kindred's `teamChips` pattern.

### Compact Team column rendering
For each deal row, gather all assignments, render them as small colored badges:
```
[VSD: Vanshika 10%] [BOPM: Ruchi 20%] [Content: Amit 40%]
```
Using the existing `PersonBadge` component with `flex-wrap` layout. If no assignments, show "No team" in muted text.

### Staffing happens only in the expanded row
The existing `renderDealExpand` already has the full role-grouped staffing UI with `PersonSel` dropdowns + allocation inputs. This becomes the sole place for staffing changes. No changes needed to the expand panel itself.

### Column cleanup
Final table columns (compact): Deal ID | Account | BU | Capability | Deal Name | Status | MRR | Total DV | Type | Staffing | **Team**

Remove from main row: PC Code, Duration, Retainer, Non-Retainer columns (move these into the expanded panel's metadata section if needed). This keeps the table scannable.

### File: `src/pages/Staffing.tsx`
1. Remove `visibleSlots.map(...)` from thead and tbody
2. Remove `visibleSlots`/`getDealVisibleSlots` usage from main row (keep for expand panel)
3. Add "Team" column header + cell that renders assignment chips
4. Remove less-important columns (PC Code, Duration, Retainer, Non-Ret) from main row — show in expand
5. Update `colSpan` in expand row to match new column count
6. Remove category filter dropdown from filter bar (no longer drives columns)

