## Goal
Use the 5 uploaded CSVs (Neema, Sneha, Sumit, Shaw, Aamir — ~208 deal rows total) to **replace** deal-level values and **replace** staffing allocations in `staffing_deals` / `staffing_assignments`, while keeping `staffing_deals.id` (the PC+DealID primary key) untouched.

## Matching strategy
The CSVs don't have an explicit deal ID column, but they do carry both `PC Code` and `New Deal ID- Formulated`. The `staffing_deals.id` is exactly `{pc_code}_{new_deal_id_formulated}`. Spot-check on 4 sample rows from Neema/Sumit confirmed an exact match for all 4.

- **Primary key:** `id = pc_code + "_" + new_deal_id_formulated`
- **Fallback (only if primary miss):** match by `lower(account)` + `lower(deal_name)` within the VSD's name
- Unmatched rows will be reported (not inserted as new deals).

## What gets replaced

### Deal-level fields (per matched `staffing_deals` row)
From the CSV columns: `MRR`, `Duration`, `Retainer Deal Value`, `Non-Retainer Deal Value`, `Total Deal Value`, `Deal Value Lost`, `Net Deal Value`, `Total MIS Recognition`, `Total Pending Recognition`, `Consumption of Deal Value`, `MIS vs Consumption`, `Invoiced Deal Value`, `Undelivered Funnel`, `Start Month`, `End Month`, `Deal Target Status`, `Deal Status from New Deal Master`, `Pod Name`, `VSD` (from filename), `Validation by Central CX`, `Staffing Status`, `Month of Closed Won`, plus `TCV (USD)` where present (Aamir).

Currency strings (`₹6,912,000`, `"6,912,000"`) get stripped to numbers. Empty/`-`/`Not Applicable` → null/0.

### Staffing allocations (`staffing_assignments`)
For every matched deal:
1. `DELETE FROM staffing_assignments WHERE deal_id = <id>`
2. Re-insert one row per `(role_key, person)` pair from the CSV where the person cell is non-empty and not `-` / `Not Applicable` / `TBD`.

### Role column → `role_key` mapping
Header-driven (each CSV has a different column count: 73 / 106 / 63 / 106 / 105). Mapped to existing `role_key` values already in the DB:

| CSV column (current/new variant) | `role_key` |
|---|---|
| VSD | `vsd` |
| Principal BOPM | `principal_bopm` |
| Senior BOPM | `senior_bopm` |
| Junior BOPM / BOPM / Intern | `bopm` |
| Content Lead | `content_lead` |
| Senior Editor / Sr Content Editor | `senior_editor` |
| Managing Editor | `managing_editor` |
| SEO Leader | `seo_leader` |
| SEO Growth Lead / Growth Lead | `seo_group_head` |
| SEO Operations / Manager 1 | `seo_manager` |
| Manager 2 | `sr_seo_manager` |
| Strategy CD | `strategy_cd` |
| Strategy ACD | `strategy_acd` |
| CD-Copy / ACD-Copy / Sr/Jr Copywriter | `acd_copy` / `sr_copywriter` / `jr_copywriter` (CD-Copy → `acd_copy` per existing data) |
| Sr CD-Art / ACD-Art / Art Director / Sr/Jr Designer | `sr_cd_art` / `acd_art` / `art_director` / `sr_designer` / `jr_designer` |
| Production Head | (no key — skipped) |
| AD - Video PM | `ad_video_pm` |
| Video PM/ACP | `video_pm` |
| Video Editor 1/2 | `video_editor_1` (Editor 2 same key with sequence suffix in `id`) |
| Influencer Team | `influencer` |
| Performance and Growth | `perf_growth` |

Where a CSV has both "Old X" and "New X" columns, only the **New** value is used (the "Old" column is historical). The `% Mapping` column to the right of each role becomes `allocation_pct`.

### People resolution
Names are matched to `staffing_people.name` case-insensitively. For names that don't resolve (typed-in placeholders like `New US BOPM TBH 2`, `India FMCG Creative BOPM 3`, freelancer text, typos):
- I'll produce a "needs resolution" report grouped by name with proposed action: create as `tbh=true` placeholder vs skip.
- **Recommendation:** auto-create placeholders for names containing `TBH` / `TBA` / `New ... BOPM`; skip and report everything else. Final list will be in the dry-run output for your approval before the writes run.

## Execution
1. Write a Python script `/tmp/import_staffing.py` that:
   - Parses each CSV with the right header layout per VSD
   - Resolves deals by composite key + reports misses
   - Resolves people + reports misses
   - Outputs a dry-run summary: matched deals, unmatched deals, unknown people, total assignments to delete vs insert, deal-field diffs
2. You review the dry-run report.
3. On approval, run the same script in apply mode using `supabase--insert` migrations (per-deal UPDATE + DELETE/INSERT batches) inside a transaction per VSD file.

## Technical notes
- All writes go through `supabase--insert` (data, not schema). No migrations needed — schema already supports everything.
- `staffing_deals.id` is preserved; no deletes/inserts on `staffing_deals`, only updates.
- Realtime subscribers on `staffing_assignments` will see the replacement as delete+insert events per deal.

## Open question (will be resolved in dry-run output, but flagging now)
For unknown person names: auto-create as TBH placeholder, or strict-skip with report? Default = the hybrid above (auto-create only for explicit TBH-style names).
