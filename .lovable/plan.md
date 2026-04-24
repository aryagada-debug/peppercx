## Goal
Free up vertical space on `/clients` so the table is the focal point. Remove the redundant "X clients • Y deals" subtitle (those numbers already appear in the KPI cards) and collapse the page chrome from ~4 stacked rows into exactly **2 rows** above the table.

## Changes — `src/pages/Clients.tsx`

### Row 1 — Title + KPIs + Actions (single row)
- Remove the `<p>{kpis.clients} clients • {kpis.deals} deals</p>` subtitle line under the heading.
- Make the H1 ("Clients & Deals") inline with the KPI strip and the Add buttons on the same horizontal row.
- KPI cards become even more compact (height ~32–36px) so 5 cards + title + 2 buttons fit on one line at typical widths:
  - Reduce padding to `px-2 py-1`, icon chip to `p-1`, value text to `text-sm`, label to `text-[9px]`.
  - Use `flex-1 min-w-0` on the KPI group so it absorbs available space between title and action buttons.
- Layout: `flex items-center gap-3` containing → Title block · KPI strip (flex-1) · Add Client · Add Deal.
- On narrower viewports (<1100px) the KPI strip wraps below; that is acceptable since the user's viewport (1267px) comfortably fits one line.

### Row 2 — Filters + Search + Closed toggle + Columns (single row)
- Combine into one `flex items-center gap-2` row, no wrap on desktop:
  - VSD pill group (kept but with tighter padding `px-2 py-1`, `text-[11px]`).
  - Search input (shrunk to `max-w-[220px]`, `h-8`).
  - "Show closed/completed" checkbox (shorter label: "Closed", with tooltip showing full text).
  - Clear-filters chip (only when active).
  - Columns popover button pushed to the right via `ml-auto`.
- Drop the third margin row by changing `mb-3` on the filter row to `mb-2`, and KPI/title row to `mb-2`.

### Untouched
- KPI computation, filtering logic, column picker contents, resize behavior, table body — all stay as-is.

## Result
- Two compact rows above the table: `[Title | KPIs | Add buttons]` then `[VSD filters | Search | Closed | Columns]`.
- Redundant client/deal counts removed (still visible in the KPI cards).
- Table gains roughly 60–80px of vertical space.

## File touched
- `src/pages/Clients.tsx` (header block lines ~431–551 only)
