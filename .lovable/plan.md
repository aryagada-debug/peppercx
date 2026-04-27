# Populate April 2026 Financials & Targets

Run a database migration to load the April 2026 data from the master Google Sheet (210 deals) into both the Targets dashboard and every deal's Financials tab, mapped by Deal ID.

## What gets populated

**`deal_financial_targets`** (April 2026) — drives the Targets page:
- Consumption (contraction) target & actual
- Delivery target & actual
- Invoicing target & actual
- Receivables target & actual

**`deal_financials`** (April 2026) — drives Financials tab in Clients & Deals:
- `consumption` ← Consumption Actual
- `invoiced` ← Invoicing Actual
- `received` ← Receivables Actual
- `contracted` ← Net Deal Value (where present)

## Mapping logic

- Match CSV "New Deal ID" or "Add New Deal ID Here" against `staffing_deals.deal_id` (case-insensitive, trimmed) using `COALESCE`.
- Upsert by `(deal_id, month='2026-04-01')` — re-runnable, won't duplicate.
- Skip rows where neither ID resolves to an existing deal; report count of unmatched rows.

## Technical steps

1. Create migration file with the full 210-row data load (two upserts — one per table).
2. Run it via the migration tool.
3. Verify counts via `read_query` and report matched/unmatched totals back.

No schema changes, no UI changes — this is a one-time data load only.
