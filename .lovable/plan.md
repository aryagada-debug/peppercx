## Goal

Replace the People Ops directory and the platform's auth users with a clean state driven by **People Master - for CX OS (2).xlsx**.

---

## 1. People Ops — full reset from sheet

Wipe `staffing_people` and reload 132 rows from the sheet's `email ids` tab. Only these fields per person:


| Sheet column      | DB column                               |
| ----------------- | --------------------------------------- |
| Name              | `name`                                  |
| Department        | `department`                            |
| Role Type         | `designation` + `role_type_id` (mapped) |
| Region            | `region`                                |
| Reporting Manager | `reporting_manager`                     |
| Official Email ID | `email`                                 |


Clear/empty all legacy fields: `pod`, `sub_team`, `role_category`, `band`, `hourly_rate`, `role_title`, `slack_user_id`, `leaving`, `tbh`.

**Role Type → role_type_id map** (using sheet's "Staffing Role Format" tab):

```
VSD                       → rt_vsd
Group BOPM                → rt_group_bopm        (== principal_bopm)
Senior BOPM               → rt_senior_bopm
BOPM                      → rt_bopm
Content Capability Leader → rt_content_capability_leader
Content Lead              → rt_content_lead
Content Editor            → rt_senior_editor
SEO Capability Leader     → rt_seo_capability_leader
SEO Growth Lead           → rt_seo_growth_lead
SEO Operations            → rt_seo_operations
CD/SCD - Strategy         → rt_cd_scd_strategy
ACD/AGH - Strategy        → rt_acd_agh_strategy
Creative Strategist       → rt_creative_strategist
CD/SCD - Copy             → rt_cd_scd_copy
ACD/AGH - Copy            → rt_acd_agh_copy
Copywriter                → rt_copywriter
CD/SCD - Design           → rt_cd_scd_design
ACD/AGH - Design          → rt_acd_agh_design
Graphic Designer          → rt_graphic_designer
Video Capability Leader   → rt_video_capability_leader
AD - Creative Producer    → rt_ad_creative_producer
Creative Producer         → rt_creative_producer
Video Editor              → rt_video_editor
CEO / Influencer Team / Performance Marketing Team / Leadership → no role_type_id (designation only)
```

Person IDs reused where the email matches an existing `staffing_people` row (preserves staffing assignments, profile links, MBR/calendar links). New IDs minted for new people (`p_<slug>`).

## 2. Staffing assignments / referenced people

- **Simran Pohani** appears in the recent staffing sheet but not in People Master. I'll keep her staffing_people row in place and her 1 assignment intact until you send her details (Department, Role Type, Region, Reporting Manager, Email). Once you reply, I'll add her properly.
- Any other `staffing_people` rows not in the sheet and not referenced by staffing assignments get deleted.
- People referenced by assignments but not in the sheet (only Simran today) are flagged in a report at `/mnt/documents/people_reload_result.csv`.

## 3. Auth users — keep only the 7 admins

Keep these 7 admin accounts:

- Shashwat Sood, Arya Gada (×2), Anirudh Singla, Sudhanshu Sikhwal, Priyanka Sharma, Sneha Iyer

Delete every other auth user (≈200 rows). Cascade:

- `user_roles` rows for deleted users → deleted
- `profiles` rows for deleted users → deleted
- `auth.users` rows → deleted via service role
- Foreign references on tables like `personal_todos.user_id`, `approval_requests.requested_by`, `deal_rgy_notes.updated_by`, `mbr_calendar_links.user_id`, `slack_dm_threads.app_user_id`, `smart_nudges.user_id`, `google_calendar_connections.user_id` → cleaned (rows owned by deleted users are deleted; foreign user_id refs set to NULL where the column is nullable).

## 4. Role types / departments taxonomy

`staffing_role_types` and `staffing_departments` are reseeded to exactly the 23 role types + 10 departments above. Any role_type rows not on that list are removed (no staffing_people or staffing_assignments will reference them after step 1/2).

## 5. Final report

`/mnt/documents/people_reload_result.csv` with:

- Per-person: kept / updated / created / deleted, plus mapped role_type_id and reporting manager.
- Auth: list of deleted users.
- Unresolved: Simran Pohani (awaiting details).

---

## Open item before run

Send Simran Pohani's row: **Department, Role Type, Region, Reporting Manager, Official Email**. I can proceed without it (her assignment stays as-is); supply it any time and I'll patch.  
  
She is Senior BOPM, India, SUmit Shekhawat is Reporting manager - and Email is simran.pohani@peppercontent.io