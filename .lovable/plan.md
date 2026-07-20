## Goal
Make the Staffing → Sheet view **Download** produce a file that mirrors the on-screen sheet: one row per deal, one column per visible role, with person names + allocation % inside each cell — and honour all currently applied filters and column show/hide.

## Current behavior
`handleExportCsv` in `src/components/staffing/BopmStaffingFlatTable.tsx` writes a **long-format** CSV — one row per (deal × role × person) — using `orderedRoleKeys` (ignores hidden columns). It doesn't look like the sheet.

## Change
Rewrite `handleExportCsv` to output a wide sheet-shaped CSV:

- **Row scope**: `filteredDeals` (already respects Active/All, search, Deal Type, VSD pill, BOPM filter).
- **Columns (left → right, matching the on-screen order)**:
  1. `Client` (`d.account`)
  2. `Deal Name` (`d.dealName`)
  3. `Deal ID` (`d.dealId`)
  4. `Deal Status`
  5. `MRR`
  6. One column per `visibleRoleKeys` (respects hidden/drag-reordered columns), header = `ROLE_LABEL_OF(rk)`.
- **Role cell contents**: join every non-removed entry for that deal/role as `"Person Name (25%)"`, separated by `"; "`. Empty when unstaffed.
- Keep the UTF-8 BOM + CSV escaping already in place. Filename stays `staffing-sheet-<YYYY-MM-DD>.csv`.
- Update the button `title` to "Download sheet view (respects filters & visible columns)".

Only `handleExportCsv` (and its `useCallback` deps) changes. No UI, filter, or data changes elsewhere.

## Notes / trade-offs
- CSV (not XLSX) — matches the existing download and the other Clients & Deals export. Say the word if you'd rather have `.xlsx` with frozen header + first column and I'll swap to `xlsx` writer.
- The `Not Staffed` marker from the old long-format export goes away; a blank role cell now naturally indicates "not staffed", which is how the on-screen sheet reads too.