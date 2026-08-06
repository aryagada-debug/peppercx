# Admin check + MBR data export

## Admin status
`arya.gada@peppercontent.io` **is already an admin** — the account exists and holds the `admin` role. No change needed.

## MBR data export
The MBR tracker data lives in `mbr_entries` (240 rows, months 2026-04 through 2026-09). I can produce a downloadable CSV containing one row per deal per month:

- Deal ID, account, deal name, VSD, Principal/Senior/BOPM
- Month bucket (`week_start`) and month label
- Status, mode, sentiment
- Scheduled date, input recorded at
- Notes, AI summary, Fathom link, MBR PPT link
- Action items, Anirudh added/joining flags
- Updated by, created/updated timestamps

Sorted newest month first, then by account. Delivered as a downloadable file (`mbr_entries_export.csv`).

## Technical notes
Read-only export via a single SQL query joining `mbr_entries` to `staffing_deals`; written to the documents area and surfaced as a download artifact. No schema, code, or role changes.
