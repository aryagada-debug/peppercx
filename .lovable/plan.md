## Goal

Replace the Clients & Deals roster with the 253 deals in `All_deals_Financials_-_Sheet1.csv`, preserve RGY/MBR for existing deals, and load the monthly Consumption / Delivery / Invoicing / Receivables target & attainment values into the Financials tab.

## What I found

- CSV: 253 deal rows, 129 unique PC codes, deal IDs in column "New Deal ID".
- DB: 251 of the 253 deal IDs already exist in `staffing_deals` (matched by `deal_id`). Only 2 are new.
- RGY (`deal_rgy_weekly`, `deal_rgy_notes`) and MBR (`mbr_entries`) are keyed by `deal_id` text — preserved automatically when we update existing rows in place.
- Financials tab reads `deal_financials` (per-month) and `deal_revenue_monthly`. Monthly targets live in `deal_financial_targets` (used by Home/Targets pages).

## Approach

### 1. Match & upsert deals (no destructive replace)

For each of the 253 CSV rows:

- Match on `staffing_deals.deal_id` = "New Deal ID" (if blank, fall back to PC code).
- **Existing (251)**: UPDATE in place — name, VSD, BOPMs, status, deal type, start/end date, MRR, total deal value, net deal value, customer status. RGY and MBR rows untouched.
- **New (2)**: INSERT new `staffing_deals` row; auto-create `clients` row if Client Name doesn't exist.
- Deals in DB but not in CSV: leave alone (no deletion, since RGY/MBR for them must be retained and the user said "keep existing"). I'll surface a count in the summary.

### 2. Map monthly financials

Two annual blocks in CSV (cols 28–57 = Consumption, similar for Delivery/Invoicing/Receivables) cover **Jan 2025 – Mar 2026**. I will map column-by-column to month dates:

- Cols 28–51 → Jan–Dec **2025**
- Cols 52–57 → Jan–Mar **2026**

For each (deal, month) write/upsert `deal_financial_targets`:

- `contraction_target` / `contraction_actual` ← Consumption Target / Attainment
- `delivery_target` / `delivery_actual` ← Delivery
- `invoicing_target` / `invoicing_actual` ← Invoicing
- `receivables_target` / `receivables_actual` ← Receivable

Also upsert `deal_financials` (per-month) with `consumption`, `invoiced`, `received` so the Financials tab inside each deal reflects the same numbers.

Currency values like `"₹27,547,872"` will be parsed by stripping `₹`, `$`, commas, spaces, and treating empty as 0.

### 3. Execution

- Write a Python script that parses the CSV, queries existing deals, builds bulk SQL, and emits a migration + insert statements.
- Run it through the Supabase insert/migration tools (data ops use the insert tool).
- Print a final report: # updated, # inserted, # new clients, # financial rows written, # deals skipped.

## Out of scope

- Auto-deletion of deals not in the CSV (kept to preserve their RGY/MBR — flag if you want them archived).
- The Pre-Apr Invoicing, Carry Forward, Spillover, Risk/Issue, Notes columns — I'll capture Notes into `staffing_deals` if non-empty but skip the rest unless you want them mapped.

## Files / data touched

- DB tables: `staffing_deals` (update + 2 inserts), `clients` (0–2 inserts), `deal_financial_targets` (upserts ~253 × 15 months), `deal_financials` (upserts).
- No code file changes expected — Financials tab already reads these tables.  
  
