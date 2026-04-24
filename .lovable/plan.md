

## Connect Google Sheets to Power Deals Dashboard

Wire a live Google Sheet into the app so the Deals dashboard reads from the sheet instead of (or in addition to) static mock data and the `staffing_deals` table.

### Approach

Use the **Google Sheets connector** (gateway-based, OAuth handled by Lovable) to read the sheet server-side from an edge function, then either:
- **A) Sync into Supabase** (`staffing_deals`) on demand + on a schedule, so the dashboard stays fast and offline-tolerant, OR
- **B) Read live** on every dashboard load (slower, always fresh, no DB writes).

Recommended: **A — Sync to DB**. Dashboard stays snappy and existing pages keep working unchanged.

### Steps

1. **Connect Google Sheets**
   - Use the connector tool to link a Google Sheets connection to this project. You'll be prompted to authorize Google.
   - Note: connector authenticates *your* Google account. The sheet must be accessible to that account (or shared with it).

2. **Capture sheet config**
   - You provide: the sheet URL (we extract `spreadsheetId`), tab name, and header row.
   - Stored in a small `integration_config` table (key/value) so it can be changed from the UI later without redeploying.

3. **Column mapping UI** (Settings → Integrations → Google Sheets)
   - Auto-fetch the header row from the sheet.
   - Let you map each sheet column to a `staffing_deals` field (deal_id, account, deal_name, mrr, total_deal_value, vsd, pod, deal_status, rag, start_date, end_date, slack_channel_id, etc.).
   - Save mapping to `integration_config`.

4. **Edge function `sheets-sync-deals`**
   - Calls Google Sheets API via gateway: `GET /spreadsheets/{id}/values/{tab}`.
   - Applies the saved column mapping, normalizes types (numbers, dates).
   - Upserts into `staffing_deals` keyed by `deal_id`.
   - Returns `{ inserted, updated, skipped, errors }`.

5. **Trigger options**
   - **Manual**: "Sync from Google Sheet" button on the Deals page header.
   - **Auto**: pg_cron job hits the function every 15 min (configurable).

6. **Dashboard wiring**
   - `Deals.tsx` already shows hardcoded mock deals — switch it to read from `staffing_deals` (same source of truth other pages use).
   - `Index.tsx` KPIs/RGY remain on existing data; once sync runs, they reflect the sheet.

7. **Status surface**
   - Show last sync time + row count + any row-level errors on the Deals page header.

### What I'll need from you (after approval)

- The Google Sheet URL.
- Confirmation that the Google account you'll authorize has access to it.
- Tab name (e.g. `Deals`) and header row number (usually 1).

### Files

- New: `supabase/functions/sheets-sync-deals/index.ts`
- New migration: `integration_config` table (key text PK, value jsonb), `sheet_sync_log` table (run_at, summary jsonb)
- New: `src/pages/admin/GoogleSheetsTab.tsx` — connect URL, map columns, run sync
- Edit: `src/pages/Settings.tsx` — add tab
- Edit: `src/pages/Deals.tsx` — read from `staffing_deals` + add "Sync now" button + last-sync indicator
- Edit: `supabase/config.toml` — add `[functions.sheets-sync-deals] verify_jwt = false` (called by cron)

### Open questions

1. **Sync direction** — read-only from sheet → app (recommended), or two-way? Two-way is significantly more complex (conflict handling).
2. **Which dashboard surfaces should switch to sheet data?** Just the Deals table, or also KPIs / RGY heatmap on the home page?
3. **Auto-sync cadence** — every 15 min, hourly, or manual only?

