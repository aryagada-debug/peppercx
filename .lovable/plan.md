# Google Sheets → App sync (via published CSV)

Pull the **Deal Master - Base data** tab as CSV every 3 hours and upsert into Clients, Deals, and per-deal monthly Financials. Sheet is the source of truth: deal metadata + financial cells always overwrite app values.

## Source

- **CSV URL:** `https://docs.google.com/spreadsheets/d/e/2PACX-1vQvdTYtkeRTrJ0oc1mzsChsI7PocauAP6VGjBxfLDkxW4aoA1Rb8X-JNCLAiu51h1Je3PuGGxVjXlpH/pub?gid=1189053191&single=true&output=csv`
- Stored as the secret `DEAL_MASTER_CSV_URL` so it can be rotated without redeploying.
- **Header row:** row 7 (1-indexed). Data rows: row 8 onwards. Skip rows where column C (Deal ID) isn't a number.
- Total numeric cells in the financial sections often contain thousands separators (`1,749`) — stripped before parsing.

## Column mapping (verified against the live CSV)

### Deal metadata → `clients` + `staffing_deals`

| Sheet col | Header | App field |
|---|---|---|
| B | PC Code | `clients.pc_code` (also key) |
| C | Deal ID | `staffing_deals.deal_id` |
| D | Client Name | `clients.name` |
| E | Deal Name | `staffing_deals.deal_name` |
| F | Final Month of Closed Won | `staffing_deals.start_date` (parse `01/05/2024` DD/MM/YYYY) |
| G | Sales Leader | `staffing_deals.sales_leader` |
| H | Sales Rep | `staffing_deals.sales_rep` |
| I | VSD | `staffing_deals.vsd` |
| J | Group BOPM | `staffing_deals.principal_bopm` |
| K | Senior BOPM | `staffing_deals.senior_bopm` |
| L | Junior BOPM | `staffing_deals.bopm` |
| N | Geo | `staffing_deals.geo` |
| O | Revenue Type | `staffing_deals.revenue_type` |
| P | Retainer MRR | `staffing_deals.mrr` |
| Q | Duration | `staffing_deals.duration_months` |
| T | Total Deal Value | `staffing_deals.total_deal_value` |
| X | Net Deal Value to Consider | `staffing_deals.net_deal_value` |

Composite key for the deal upsert: `${pc_code}_${deal_id}` (matches the existing pattern). If a deal row has a `pc_code` we've never seen, a `clients` row is auto-created with just `name` + `pc_code`.

### Financials → `deal_financials` (one row per `deal_id` × `month`)

Each block uses the same wide layout — one column per month. Only cells whose header parses as a real month label get written. FY subtotal cells (e.g. `FY 2024-25`, `FY 25-26`) and blanks are skipped, so no zeros are wiped.

| Block | Sheet columns | App field |
|---|---|---|
| Invoicing | **DI → ET** (Apr-2024 … Mar-2027) | `deal_financials.invoiced` |
| Collections / Receivables | **FA → GL** (Apr-2024 … Mar-2027) | `deal_financials.received` (and `outstanding = invoiced − received` when both present) |
| Contraction | **HS → IQ** (Apr-2025 … Mar-2027) | `deal_financials.contracted` |
| Delivery | **JA → KL** (Apr-2024 … Mar-2027) | `deal_financials.consumption` |

Month label parser accepts both `Apr-2024` and `Apr-24` (the four blocks mix both formats) and normalises to the first day of the month.

## What gets built

### 1. Edge function: `sheets-sync-deals`
- `GET` the CSV (no auth — published).
- Parse with a streaming CSV parser; build deal-row objects keyed by Deal ID.
- Upsert clients → deals → financials in batches.
- Write a `sync_runs` row with counts + error list.

### 2. `sync_runs` table (new)
Audit trail: `started_at`, `finished_at`, `status` (`success` / `partial` / `failed`), `deals_upserted`, `financials_upserted`, `clients_created`, `rows_skipped`, `error_log` (jsonb).

### 3. Schedule
`pg_cron` + `pg_net` job: `0 */3 * * *` → invokes `sheets-sync-deals`.

### 4. Settings UI: "Google Sheets Sync" card
- Last run time + status + counts.
- Last few errors (collapsed).
- **Sync now** button to invoke on demand.
- Inline note: "Deal metadata and financial cells will be overwritten from the sheet on every run."

## Behaviour rules

- **Blank cells never zero out existing data** — only non-empty cells trigger an upsert.
- **App-only fields are preserved** — RGY weekly, MBR, tasks, SoW, stakeholders, staffing assignments are never touched.
- **New deals appear automatically** — client is auto-created if needed.
- **Soft-deleted deals stay deleted** — the sync skips rows already in `staffing_deals_trash`.
- Idempotent: re-running on the same CSV produces zero diffs.

## Out of scope (flag if you want it later)

- Two-way sync (app → sheet).
- Syncing staffing assignments / team allocations (different tab).
- Email/Slack alerts on failed runs — Settings card will surface the last error for now.
