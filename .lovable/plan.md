## Goal

Bulk-overwrite the 9 financial fields on each of the 158 deals in the uploaded Staffing Sheet, and expand the Deal Detail **Financial Snapshot** card to show all 9. All of the data is in INR - so update that data for INR - and also have a column which basis the current $ conversion rate that someone can input at the top of the app - all US deals should be able to also be seen in $ and both in INR - there should be a toggle

## Source → DB column mapping


| Excel column             | DB column (`staffing_deals`)                  |
| ------------------------ | --------------------------------------------- |
| MRR                      | `mrr`                                         |
| Duration                 | `duration` (text; store as `"12"`)            |
| Retainer Deal Value      | `retainer_deal_value`                         |
| Non-Retainer Deal Value  | `non_retainer_deal_value`                     |
| Total Deal Value         | `total_deal_value`                            |
| Deal Value Lost          | `deal_value_lost`                             |
| Net Deal Value           | `net_deal_value`                              |
| Start Month (`"Sep-25"`) | `start_date` (parsed → `2025-09-01`)          |
| End Month (`"Aug-25"`)   | `end_date` (parsed → first day of that month) |


All fields above already exist in `staffing_deals` — **no schema migration needed.**

## Match strategy (per row)

1. Primary: match Excel `New Deal ID- Formulated` against DB `new_deal_id_formulated` **OR** `deal_id` (handles both populated styles).
2. Fallback for the 2 rows without a deal ID:
  - `Aditya Birla Sun Life Insurance — SEO/GEO + Content Mandate (PC3969)` → `id = 'sd_pc_PC3969'`
  - `Edelweiss Life Insuance — SEO/GEO + Content Mandate` → `id = 'sd_edelweiss_life_insuance_seo_geo_content_mandate'`
3. If a row matches multiple DB deals (same deal_id under different PC codes), update all matches — the spec says "overwrite for the 158 deals".
4. Unmatched rows: surface a short list to the user after the run; no row created automatically.

## Data normalization

- Empty / `NaN` numerics → write `0` (matches existing column defaults, since the user wants overwrite).
- `Start/End Month` parsed with `MMM-YY` → ISO date `YYYY-MM-01`. Unparseable → `NULL`.
- `Duration` stored as text (preserves existing column type).

## Execution

Build a single SQL statement via the **insert tool**:

```sql
UPDATE staffing_deals d
SET mrr = v.mrr,
    duration = v.duration,
    retainer_deal_value = v.rdv,
    non_retainer_deal_value = v.nrdv,
    total_deal_value = v.tdv,
    deal_value_lost = v.dvl,
    net_deal_value = v.ndv,
    start_date = v.sd,
    end_date = v.ed,
    updated_at = now()
FROM (VALUES (...)) AS v(deal_id_key, mrr, duration, rdv, nrdv, tdv, dvl, ndv, sd, ed)
WHERE d.new_deal_id_formulated = v.deal_id_key
   OR d.deal_id = v.deal_id_key
   OR d.id = v.deal_id_key;  -- covers the 2 fallback rows
```

Generated client-side in Python from the xlsx, then submitted as one statement.

## UI: Financial Snapshot expansion (`src/pages/DealDetail.tsx`, lines ~2009-2030)

Replace the current 4-tile grid with a compact 9-field block:

- Row 1 (4 KPI tiles, large numbers): **MRR**, **Total Deal Value**, **Net Deal Value**, **Deal Value Lost**.
- Row 2 (5 inline editable fields in a thin metadata bar): **Retainer Value**, **Non-Retainer Value**, **Duration**, **Start Month**, **End Month**.
All remain inline-editable via `EditableCell` (numeric, text, date) — preserves the project rule "All data must be editable". Currency symbol respects existing `currencySymbol`.

The duplicate Duration / Start / End rows currently shown in the "Contract Details" panel just below (lines 2092-2150) stay as-is — they were already there.

## Files

**Edited**

- `src/pages/DealDetail.tsx` — Financial Snapshot section only.

**No new files. No migration. No edge function.**

## Out of scope

- Inserting deals that don't exist in DB (the 2 fallback rows are matched to existing rows).
- Recomputing downstream aggregates (TCV, target_status) — those flow from the same numbers and will re-derive on load.
- Currency conversion — values written as-is in their existing input currency.