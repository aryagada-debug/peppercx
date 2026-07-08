## Goal
Replace the current per-VSD stacked-card layout in **Contacts → Insights** with a single expandable summary table.

## Table columns
| VSD | # Deals | # Contacts | Deals without contacts |

- Rows are sortable by any column.
- Clicking a row (or a chevron) expands it to reveal the existing per-deal table (Account, Deal, BOPM, Region, Status, # Contacts) already built for that VSD group.
- Multiple rows can be expanded at once.
- A "Deals without contacts" count is rendered in red when > 0.
- Existing filters (Status, VSD, "Show missing only") and the summary footer stay unchanged.
- Existing per-deal ColHeader filtering/sorting inside the expanded panel is preserved.

## Implementation notes (single file: `src/pages/Contacts.tsx`)
1. Add `expandedVsds: Set<string>` state and a `toggleExpanded(vsd)` helper.
2. Add `vsdSort` state (`{key: 'vsd'|'deals'|'contacts'|'missing', dir}`) and sort `insightsGroups` accordingly for the outer table.
3. Replace the `insightsGroups.map(...)` block with:
   - One `<table>` whose header has the 4 columns + a chevron column.
   - For each VSD group: a summary `<tr>` (clickable) + a conditional expanded `<tr>` with `colSpan=5` containing the existing per-deal `<table>` markup.
4. Keep the existing empty/loading states and the top toolbar exactly as they are.
5. No changes to data fetching, hooks, or other files.
