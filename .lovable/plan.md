## Client 1-1s tracker

New admin-only Operations tab to track quarterly client 1-1 calls per deal, with per-quarter status, Fathom link, insights PDF upload, and notes.

### 1. Database (migration)

New table `public.client_one_on_ones`:
- `id` uuid PK
- `deal_id` text (references `staffing_deals.id`)
- `quarter` text — one of `JFM`, `AMJ`, `JAS`, `OND`
- `year` int — calendar year of the quarter
- `status` text default `Pending` — `Pending` | `Scheduled` | `Done`
- `fathom_url` text
- `insights_pdf_path` text — path in `client-one-on-ones` storage bucket
- `notes` text
- `created_at`, `updated_at`, `updated_by` uuid
- Unique `(deal_id, quarter, year)`

Grants + RLS: admin-only read/write via `has_role(auth.uid(), 'admin')`. `service_role` full access. Standard `updated_at` trigger.

New private storage bucket `client-one-on-ones` for the insights PDFs, with storage.objects policies restricted to admin role.

### 2. Route + navigation

- Add `/client-one-on-ones` route in `src/App.tsx`, admin-only via `ProtectedRoute adminOnly`.
- Add sidebar link "Client 1-1s" under Operations in `src/components/layout/AppSidebar.tsx` with `adminOnly: true`.
- New page `src/pages/ClientOneOnOnes.tsx`.

### 3. Page UI

Table with one row per deal (all active deals from `staffing_deals`, joined to `client_one_on_ones` rows by deal + current year).

Columns:
- Client name
- Deal name
- MRR
- Total revenue (`total_deal_value`)
- Quarter cells: **JFM**, **AMJ**, **JAS**, **OND** — each cell shows a status pill (Pending/Scheduled/Done) that opens a popover/drawer to edit that quarter's record: status dropdown, Fathom URL input, PDF upload (visible when status=Done), notes textarea. Saves inline.
- When a quarter is `Done`, the cell surfaces small icons/links for Fathom and PDF; PDF opens via signed URL from the private bucket.

Reuse existing patterns:
- Filters mirroring Clients & Deals page (VSD, BOPM, deal type, business unit, deal status, search) — extract from `src/pages/Clients.tsx` conventions.
- Sortable column headers using `ColHeader`.
- Global text search box.
- Year selector (default = current calendar year) so admins can look at prior years.

### 4. Data hooks

- `useClientOneOnOnes(year)` — fetch all rows for the year keyed by `${deal_id}:${quarter}`.
- Mutation hook: upsert quarter record; on PDF upload, upload to storage first, then persist path.
- Signed URL helper for viewing uploaded PDFs.

### Technical notes

- No changes to existing Clients & Deals code; filter logic is duplicated locally on this page (kept small) to avoid coupling.
- Default row for a deal/quarter with no DB row = `Pending` (implicit; no insert until user edits).
- PDF upload accepts `application/pdf` only, max ~20MB, filename normalized `deal_id/YEAR-QUARTER.pdf`.
