## Goal
Import staffing assignments from `Staffing Sheet_May 30th (1).xlsx` (989 deal rows × up to 16 roles each) into `staffing_assignments`, mapping by Deal ID and preserving the `% Mapping` value as `allocation_pct`.

## Rules (per your answers)
- **Only add missing** — never modify or delete existing rows. A `(deal_id, person_id, role_key)` triple already present is skipped.
- **All ~16 roles** imported (VSD, Principal/Sr/BOPM, Content Lead, Sr Content Editor, SEO Leader/Growth/Ops, CD-Strategy, ACD-Copy, Copywriters 1&2, CD-Design, ACD-Design, Graphic Designers 1&2, Video Capability Leader, AD-Creative Producer, Creative Producer, Video Editors 1&2).
- **Attach to `d_{NewDealID}`** records only.
- **Fuzzy auto-match** people names against `staffing_people.name` (handles "Phatak"→"Pathak", "Agarwal"→"Agrawal", etc.); skip cells that are empty, "Not Applicable" / "Not applicable", or have no close match (≥0.85 similarity).

## Steps

1. **Load sheet** (`/mnt/user-uploads/Staffing_Sheet_May_30th_1-2.xlsx`) with openpyxl.
2. **Build people lookup** — fetch all `staffing_people` (id, name); use `difflib.get_close_matches` for fuzzy matching. Cache decisions per name.
3. **Build deal lookup** — fetch all `staffing_deals.id` starting with `d_`; only insert when `d_{NewDealID}` exists.
4. **Walk each sheet row** — for every (role column, % column) pair:
   - resolve `role_key` via the normalizer mapping
   - resolve `person_id` (skip if unmatched)
   - skip if `(deal_id, person_id, role_key)` already exists in `staffing_assignments`
   - else queue an INSERT with id `id_sheet_{rownum}_{rolekey}_{personid}`, `allocation_pct` from the % cell (0 if blank)
5. **Generate a single SQL file** under `/tmp/import_assignments.sql` containing only the new INSERTs.
6. **Generate a report** at `/mnt/documents/staffing_import_report.csv` with: rows inserted, rows skipped (duplicate / unmatched-person / unknown-deal), unmatched name list for your review.
7. **Run the INSERTs** via the insert tool (one batch).
8. The existing `sync_bopm_fields_from_assignment` trigger will recompute the `vsd / principal_bopm / senior_bopm / bopm` cached columns on `staffing_deals` automatically — no extra step needed.

## Role-column → `role_key` mapping

```text
VSD                       -> vsd
Principal BOPM            -> principal_bopm
Senior BOPM               -> senior_bopm
BOPM                      -> bopm
Content Lead (2026)       -> content_lead
Senior Content Editor     -> senior_editor
SEO Leader                -> seo_leader
SEO Growth Lead           -> seo_group_head
SEO Operations            -> seo_manager
CD/SCD - Strategy         -> strategy_lead
ACD/AGH - Copy            -> copy_lead
Copywriter 1 / 2          -> copywriter
CD/SCD - Design           -> design_lead
ACD/AGH - Design          -> design_acd
Graphic Designer 1 / 2    -> graphic_designer
Video Capability Leader   -> video_lead
AD - Creative Producer    -> creative_producer_ad
Creative Producer         -> creative_producer
Video Editor 1 / 2        -> video_editor
```

(SEO + creative role keys follow existing `normalize_staffing_role_key` conventions where they exist; new keys like `copywriter`, `graphic_designer`, `video_editor`, `creative_producer` are used as-is — they already appear in the codebase via `staffing_data`.)

## Deliverables
- New assignment rows inserted into `staffing_assignments` (additive only).
- CSV report at `/mnt/documents/staffing_import_report.csv` with counts + unmatched-name list so you can decide whether to add new `staffing_people` records or correct typos in a follow-up.

No code/schema changes — pure data import.