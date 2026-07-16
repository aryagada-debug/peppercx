## Add "Download CSV" to Clients & Deals

Add an export button in the Clients & Deals page header (next to the existing action buttons) that downloads a CSV of the currently-visible rows.

### Behavior
- Respects every active filter/scope already applied on the page: search, VSD filter, BOPM filter, per-column filters, renewal filter, show/hide closed, geo scope, and role-based deal visibility.
- Exports the current `filteredDeals` list (same data feeding the table), not the raw dataset.
- Column set = all `ALL_COLS` fields (Client, Deal Name, Deal ID, PC Code, Month Closed Won, Type, Status, Pepper BU, Capability Line, VSD, P/Sr BOPM, BOPM, Content Lead, SEO Lead, MRR, Retainer Value, Non-Retainer Value, Total Revenue, Duration, RGY) — a full export regardless of which columns are hidden in the UI, so users can toggle columns purely for viewing without losing them in exports.
- Currency values exported in the active currency (INR/USD) matching what's shown on screen; RGY exported as letter (R/Y/G/NA/PENDING).
- Filename: `clients-deals-YYYY-MM-DD.csv`.

### Implementation notes (technical)
- Pure frontend change in `src/pages/Clients.tsx`. No backend, no schema.
- Add a small `exportToCsv()` helper (CSV-escape quotes/commas/newlines) and a `Download` icon button in the header row that currently holds "Add Client / Add Deal / column picker".
- Reuse the already-computed filtered/sorted deal array + `clients` map + `rgyRollup` + `format` currency helper so exports stay consistent with the visible table.
- No new dependency; use a Blob + anchor download.
