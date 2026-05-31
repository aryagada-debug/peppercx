## What I'll do

Wipe all current staffing and rebuild from the new sheet (158 rows: 124 Active Deal + 24 New Deal in SLA/PO + 10 Deal Disputed). Sheet now includes `PC Code` and `New Deal ID‑Formulated`, so matching is reliable.

## Dry-run matching results

- **151 / 158** sheet rows match an existing DB deal (111 by Deal ID, 40 by Account+Name).
- **7 sheet rows unmatched** — listed below.
- **58 active DB deals not present in the sheet** — to be soft-deleted (Trash).
- Full CSV: `[/mnt/documents/staffing_match_report.csv](sandbox:/mnt/documents/staffing_match_report.csv)`

### 7 unmatched sheet rows


| PC     | Deal ID | Account                         | Deal Name                      | Status             | Likely DB equivalent                                               |
| ------ | ------- | ------------------------------- | ------------------------------ | ------------------ | ------------------------------------------------------------------ |
| PC3969 | &nbsp;  | Aditya Birla Sun Life Insurance | SEO/GEO + Content Mandate      | New Deal in SLA/PO | — (new)                                                            |
| &nbsp; | &nbsp;  | Edelweiss Life Insurance        | SEO/GEO + Content Mandate      | New Deal in SLA/PO | — (new)                                                            |
| &nbsp; | TT02011 | Arbor                           | SEO/GEO + Content Mandate      | New Deal in SLA/PO | DB has *Arbor – SEO + GEO Mandate* (will be deleted unless mapped) |
| PC3984 | 101089  | Harness Inc                     | SEO/GEO + Content Mandate      | Active Deal        | DB has *Harness – SEO/GEO + Content Mandate* (no PC, no DID)       |
| PC3980 | 101080  | Hunger Co                       | SEO/GEO + Content Mandate      | Active Deal        | DB has *Hunger Co – Bombay Sweet Shop – SEO GEO Retainer*          |
| &nbsp; | 101084  | AAA Club Alliance               | SEO/GEO + Content Mandate      | Active Deal        | DB has *AAA Alliance – SEO + Content Retainer-Opportunity*         |
| PC3077 | 101017  | Tata Communications             | GEO Mandate – Pilot (3 Months) | Active Deal        | — (new)                                                            |


For these 7, default behaviour will be: **create as brand-new deals** in the app (account + name + pc_code + deal_id from sheet, no other fields). The 5 "likely equivalents" in DB will then be soft-deleted by the next step. Tell me if you'd rather have me map any of those to the existing DB row instead of creating new + deleting old. create brand new deals and delete the older ones. 

## Build steps (after you say go)

1. **Wipe** every row from `staffing_assignments`. BOPM-sync trigger will null out `vsd / principal_bopm / senior_bopm / bopm` on `staffing_deals`.
2. **Create new deals** for the 7 unmatched sheet rows (with PC, Deal ID, Account, Deal Name, Deal Type, Status, Month of Closed Won, Retainer/Non-Retainer/Total Deal Value).
3. **Completely-delete** the 58 active DB deals not in the sheet.   
4. **Insert assignments** for all 158 sheet rows. For each role column:
  - Skip if person is blank / "Not Applicable" / "Not applicable" / "To Be Hired".
  - Skip if `% Mapping` is blank or 0 (deal left "unstaffed" for that role, per your instruction).
  - `allocation_pct = sheet_value * 100` (0.20 → 20).
  - Person resolved by exact case-insensitive name match on `staffing_people.name`; trim/space-collapsed fallback.
5. **Strategy split** for the *Strategy (Blended)* column → role_type by person's `designation`:
  - `CD/SCD` → `rt_cd_scd_strategy`
  - `ACD/AGH` → `rt_acd_agh_strategy`
  - anything else → `rt_creative_strategist`
6. **Column → role_key map** (final):
  ```
   VSD                 → vsd
   Principal BOPM      → principal_bopm
   Senior BOPM         → senior_bopm
   BOPM                → bopm
   Content Lead (2026) → content_lead
   Senior Content Editor → senior_editor
   SEO Leader          → seo_leader (role_type rt_seo_capability_leader)
   SEO Growth Lead     → rt_seo_growth_lead
   SEO Operations      → rt_seo_operations
   Strategy (Blended)  → rt_cd_scd_strategy / rt_acd_agh_strategy / rt_creative_strategist (split)
   CD/ACD Copy         → rt_acd_agh_copy
   Sr/Jr Copy 1 / 2    → rt_copywriter
   CD Art / SCD Art    → rt_cd_scd_design
   ACD / SDG Art       → rt_acd_agh_design
   Sr/Jr Designer 1 / 2→ rt_graphic_designer
   Production Head     → rt_video_capability_leader
   ACD Prod            → rt_ad_creative_producer
   CP / ACP            → rt_creative_producer
   Video Editor 1 / 2  → rt_video_editor
  ```
   Confirm this mapping before I run — `Production Head` and `CP / ACP` mappings are inferred.
7. **Final report** at `/mnt/documents/staffing_load_result.csv` listing: unresolved person names, role rows skipped due to blank %, and per-deal assignment counts.

## I need from you

- ✅ Proceed as above? Specifically confirm:
  - The 7 unmatched sheet rows → create as new deals (and let their probable DB equivalents be soft-deleted).
  - `Production Head → rt_video_capability_leader` and `CP / ACP → rt_creative_producer` mapping.
- Anything else, flag and I'll adjust before running the wipe.