# Google Sheets → App sync

Pull the "Deal Master - Base data" tab from the master Google Sheet every 3 hours and upsert into Clients, Deals, and per-deal monthly Financials. Sheet is the source of truth: deal metadata and financials always overwrite app values.

## Source sheet

- **Spreadsheet:** `1t8d0v1vKFSBZPizMaBQF2B_biF8epp12hb3hM1ogr9Q`, tab `Deal Master - Base data`.
- One row per Deal ID.
- Wide-format financial sections (one column per month) on the same row:
  - **Invoicing:** columns DI → ET
  - **Receivables:** columns FA → GL
  - **Contraction:** columns HS → IQ
  - **Delivery:** columns JA → KL
- Each section's header row holds month labels (e.g. `Apr-24`, `May-24`, …) that drive the `month` value for `deal_financials`.

## Setup the user does once

1. Connect **Google Sheets** in Lovable Cloud (the connector picker — I'll trigger it from build mode).
2. Make sure the connected Google account has at least Viewer access to the spreadsheet.

## What gets built

### 1. Edge function: `sheets-sync-deals`

- Calls Google Sheets API via the connector gateway (`google_sheets/v4/spreadsheets/.../values:batchGet`) for:
  - Header row (row 1) to discover month labels per section.
  - The full data range of `Deal Master - Base data`.
- For each row:
  - **Clients** — upsert by `pc_code` (auto-create with just `name` + `pc_code` if missing).
  - **Deals (`staffing_deals`)** — upsert by the existing composite key `${pc_code}_${deal_id}`. Overwrites mapped metadata columns every run (status, VSD, BOPMs, MRR, dates, etc.).
  - **Financials (`deal_financials`)** — one upsert per non-empty month cell per section, keyed on `(deal_id, month)`. Maps:
    - Invoicing block → `invoiced`
    - Receivables block → `received` (+ `outstanding` derived as `invoiced − received` if both present)
    - Contraction block → `contracted`
    - Delivery block → `consumption` (matches the existing "Consumption (actual/contracted)" model in Financial Reporting)
- Writes a `sync_runs` row at the end with counts (deals upserted, financials upserted, clients created, errors) so we have an audit trail.

### 2. `sync_runs` table (new)

Tracks each run for the UI and debugging:

- `started_at`, `finished_at`, `status` (`success` / `partial` / `failed`)
- `deals_upserted`, `financials_upserted`, `clients_created`, `rows_skipped`
- `error_log` (jsonb array of `{ row, reason }` for bad rows)

### 3. Schedule

`pg_cron` job runs `sheets-sync-deals` every 3 hours.

### 4. Settings UI: "Google Sheets Sync" card

Lives under **Settings**. Shows:

- Last run time + status + counts.
- Last few errors (collapsed).
- A **Sync now** button that invokes the edge function on demand (handy for testing without waiting 3h).

## Behavior notes

- **Sheet wins.** Each run overwrites deal metadata and financial cells from the sheet. Document this in the UI so users know in-app edits to those fields will be replaced on the next sync.
- **App-only fields are preserved.** Anything not present in the sheet (RGY weekly, MBR entries, tasks, SoW, stakeholders, staffing assignments, etc.) is never touched by the sync.
- **Blank cells = no write.** A blank financial cell does not zero out an existing value — only non-empty cells trigger an upsert. This avoids the sheet wiping data the team hasn't filled in yet.
- **New deals show up automatically.** When a new Deal ID appears in the sheet, the next run creates the client (if needed) and the deal, and seeds whatever financial months are populated.

## Technical details

- Connector: `google_sheets` via Lovable connector gateway (`https://connector-gateway.lovable.dev/google_sheets/v4`). Server-side only — no per-user OAuth.
- Edge function uses the `SUPABASE_SERVICE_ROLE_KEY` to write, bypassing RLS (all writes are server-validated).
- Sheets API call shape:
  - `GET /spreadsheets/{id}/values:batchGet?ranges='Deal Master - Base data'!1:1&ranges='Deal Master - Base data'!2:5000&valueRenderOption=UNFORMATTED_VALUE`
  - Parse with column-letter helpers (`DI`→113, `ET`→150, etc.) to slice each section.
- Cron registered via `pg_cron` + `pg_net`:
  ```text
  schedule: '0 */3 * * *'  (every 3 hours, on the hour)
  ```
- Idempotent: re-running on the same data produces zero diffs.
- Soft-deleted rows in app trash are not resurrected by the sync (the upsert keys exclude trashed IDs).

## Out of scope (flag if you want them later)

- Two-way sync (app → sheet). Sheet remains read-only from the app's perspective.
- Syncing staffing assignments / team allocations (the existing memory mentions a `'1.0 Deal Level Mapping'` tab — not part of this request).
- Email/Slack alerts on failed runs. The Settings card will show the last error. - want this later