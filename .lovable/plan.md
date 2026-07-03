## MBR Tracker Insights — Two Changes

### 1. Remove "Scheduling — BOPM-wise" table
Delete the entire "Part 1: Scheduling" block in `src/pages/MBRTracker.tsx` (the card with the CalendarDays icon and the Accounts / Scheduled / Not Scheduled / Schedule rate columns). Keep the "Status — Scheduled vs Done" table and the new VSD Leaderboard as-is.

### 2. VSD Leaderboard — collapsible per-row deal list
Make each VSD row in the leaderboard expandable via a chevron button in the Rank cell:

- Track expanded VSD in local state (`expandedVsd: string | null`); clicking the chevron toggles.
- When expanded, insert a full-width `<tr>` below the VSD row containing an inner table of that VSD's deals, using the same scoping logic as the leaderboard bucket (`vsdForDeal(d) || "Unassigned"` matches the row label).

Inner table columns:
| Client (Account) | Deal Name | Deal ID | P / Sr BOPM | MBR Logged |

- **Deal Name** is a `<Link to={`/deals/${d.id}`}>` styled like other clickable deal names in the page.
- **P / Sr BOPM** shows `principalBopm` and, if different, `seniorBopm` joined with " / ".
- **MBR Logged** = "Yes" (positive color) if the active-month entry has `status === "Done"` or `"Not Done"`, otherwise "No" (warning color).
- Sort rows: not-logged first, then by account name, so gaps stand out.
- Compact styling matching the existing drill dialog table (`text-xs`, subtle borders, `bg-secondary/20` background to visually nest under the parent row).

No changes to data hooks, backend, or drill-down dialog.

### File to change
- `src/pages/MBRTracker.tsx`