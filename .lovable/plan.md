# Clients & Deals: VSD filter + Google Sheet sync

## Part 1 — Replace the Pod filter with a VSD filter

In `src/pages/Clients.tsx`, the top filter chip strip currently shows Pods (`Integrated`, `India B2B`, `US B2B`, `FMCG`, `BFSI`, `Unassigned`). Replace it with VSD chips.

**New chip list:**
- All
- Neema Jayadas (US)
- Aamir Khan
- Aditya Shaw (BFSI)
- Sneha Iyer (FMCG)
- Sumit Shekhawat
- Other (everyone else, e.g. Veena Lobo, etc.)
- Unassigned (blank / "To Be Assigned" / "Not Applicable")

Filter logic switches from `deal.pod` to `deal.vsd` matching. Search box, "show closed", per-column filters and KPIs all stay as-is.

The per-column **VSD** filter inside the table (column header) stays — it's a free-text contains-match, so it still works alongside the new chip strip.

## Part 2 — Connect Google Sheets and sync

The sheet `1geonDCJpM-3qVWEx1g34xmTMXK37Vy6UsmgbhNJqpRc` is private and needs OAuth, so I'll connect the Google Sheets connector first. Once connected, I'll read all tabs and identify:

1. **The deals master tab** — to upsert into `staffing_deals` (matched by `deal_id` or `pc_code`). Fields likely covered: account, deal name, deal id, pc code, deal type, deal status, vsd, principal/senior bopm, mrr, total/retainer/non-retainer deal value, start/end dates, pod, business unit, capability line.
2. **The financial summary tab (gid=2042069)** — to upsert per-deal monthly rows into `deal_financials` and/or `deal_revenue_monthly` (contracted, invoiced, received, outstanding, consumption, planned & actual GM%, MRR, delivered, contraction).

### Sync approach

A one-time Node script run via `code--exec`:
1. Fetch every tab via the gateway `GET /spreadsheets/{id}` then `GET /spreadsheets/{id}/values/{tab}`.
2. Print the header rows of each tab so I can confirm column → DB-field mapping before writing.
3. Generate a SQL migration that:
   - Updates `staffing_deals` for matched rows (by `deal_id` or `pc_code`, case-insensitive). Only writes columns where the sheet has a value (no nulling out existing data).
   - Inserts rows into `deal_financials` keyed by `(deal_id, month)`. Existing rows for the same `(deal_id, month)` are deleted first to keep the sheet authoritative.
   - Same for `deal_revenue_monthly` if the sheet has MRR / delivered / contraction columns.
4. Skip rows where the deal cannot be matched and print a summary list at the end so you can decide whether to create them as new deals.

### What I will confirm with you before writing data

After I read the sheet, I'll come back with:
- The exact list of tabs found and which one I'll treat as deals master vs financial summary.
- A short sample of unmapped deals (sheet rows that don't match an existing `deal_id` / `pc_code`).
- Whether to insert those unmapped deals as new `staffing_deals` rows or skip them.

## Files to change

- `src/pages/Clients.tsx` — replace `PODS` constant + chip strip + filter logic with VSD equivalents.

## Database writes (after sheet read confirms shape)

- `UPDATE staffing_deals` (matched rows only).
- `DELETE` + `INSERT` into `deal_financials` per `(deal_id, month)`.
- Optional: `DELETE` + `INSERT` into `deal_revenue_monthly` per `(deal_id, month)` if the sheet covers MRR / delivered / contraction.

No schema changes required — both tables already exist with the right columns.

## Out of scope

- Recurring auto-sync (this is a one-shot import; can be added later as an edge function on a schedule if you want).
- Creating brand-new deals from sheet rows that don't match — I'll list them and confirm before creating.