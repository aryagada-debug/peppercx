## Goal

Rewrite Staffing & Capacity and People Ops on a new taxonomy: **7 Departments → 23 Role Types**. Keep every existing feature (table view, deal/people pivots, capacity, BW rules, lock, analytics, requests, hiring, etc.) — only the role/department dimension changes. Wipe existing assignments and people, reseed from the uploaded sheet, and add per-deal applicability so non-relevant departments/roles don't pollute the matrix.

## 1. New taxonomy (source: uploaded sheet)

```text
Delivery Ops and CS               → VSD, Group BOPM, Senior BOPM, BOPM
Content Capability                → Content Capability Leader, Content Lead, Content Editor
SEO Capability                    → SEO Capability Leader, SEO Growth Lead, SEO Operations
Capability - Creative Strategy    → CD/SCD-Strategy, ACD/AGH-Strategy, Creative Strategist
Creative Capability - Copy        → CD/SCD-Copy, ACD/AGH-Copy, Copywriter
Creative Capability - Video       → Video Capability Leader, AD-Creative Producer, Creative Producer, Video Editor
Creative Capability - Design      → CD/SCD-Design, ACD/AGH-Design, Graphic Designer
```

Stable keys: `dept_<slug>` and `rt_<slug>` (e.g. `dept_delivery_ops`, `rt_group_bopm`). All UI labels come from the taxonomy table — never hard-coded.

## 2. Data model

New tables (replacing old role enums baked into code):

- `**staffing_departments**` — `id (text PK)`, `name`, `sort_order`. 7 rows.
- `**staffing_role_types**` — `id (text PK)`, `department_id (FK)`, `name`, `sort_order`, `seniority` (1=lead … 4=ic). 23 rows.
- `**deal_applicability**` — `deal_id`, `department_id`, `role_type_id NULL`, `is_applicable bool`. One row per dept toggle; per-role override rows only when they deviate from the dept default. Default behavior: department off ⇒ all its roles hidden; department on ⇒ all its roles shown unless an override row says false.

Modify existing:

- `**staffing_people**` — add `department_id`, `role_type_id`, drop dependency on free-text `role_category`/`role_title` (keep columns but they become derived/legacy). `region`, `reporting_manager`, `email` continue.
- `**staffing_assignments**` — replace `role_key` semantics with `role_type_id`. Same shape (deal, person, allocation_pct, dates).
- `**staffing_deals**` — keep `staffing_locked_at/by/by_name` exactly as today (single deal-level lock).
- `**staffing_bw_rules**` — `role_key` → `role_type_id`.

RPC `toggle_staffing_lock` and `_recompute_deal_bopm_field` updated to key off `role_type_id` (VSD/Group BOPM/Senior BOPM/BOPM mapping for the deal-level VSD/BOPM display fields).

## 3. Data migration (one shot)

In order, in a single migration + seed:

1. Create new tables.
2. Seed `staffing_departments` (7) and `staffing_role_types` (23) from the sheet's *Staffing Role Format* tab.
3. `DELETE FROM staffing_assignments` (user chose wipe).
4. `DELETE FROM staffing_people` then re-insert all 122 rows from *email ids* tab, joining on Role Type → `role_type_id` and Department → `department_id`. People not matched to a known role type (Leadership/Influencer/Perf Marketing in the sheet but not in the 23-role taxonomy) are inserted with `department_id` only and `role_type_id NULL` — they show in People Ops but can't be staffed.
5. Add FK constraints last.
6. Re-run `_recompute_deal_bopm_field` for every deal so the cached VSD/BOPM text columns clear out.

No `deal_applicability` rows seeded — every deal starts with all 7 departments "off" and the Admin has to opt-in dept-by-dept on first edit. (Alternative: default all 7 on. Confirm during build if you prefer.)

## 4. UI rewrite

### 4.1 BopmStaffingFlatTable (the matrix)

- Columns are generated from `staffing_role_types` filtered to **applicable** role-types for the displayed deals. Grouped header band per department (`Delivery Ops` | `Content` | `SEO` | …) with role-type sub-headers, matching today's visual grouping.
- Sticky first column unchanged (Account · Deal · Lock chip).
- Cells: same allocation-% input / person picker as today, restricted via `ROLE_TO_PEOPLE_FILTER` derived from `role_type_id` (people whose `role_type_id` matches).
- Capacity warnings, totals row, currency display: untouched.
- An **"Applicability" gear** next to each deal's row opens a popover: 7 dept checkboxes + nested role checkboxes (per-role overrides). Saving writes/updates `deal_applicability`. Columns recompute live.
- BU → default applicable departments map preserved (e.g. *Pepper SEO/GEO + Content* defaults Delivery Ops + Content + SEO on, others off) so most deals don't need manual toggling.

### 4.2 Other staffing tabs

- **Deal View / People View / Matrix / Capacity / Hiring / Accounts / Requests / Summary / BW Rules / Lock Analytics**: regenerate role columns/filters from the taxonomy. No layout changes. Filter selectors gain a "Department" dropdown that cascades to "Role Type".

### 4.3 People Ops (`/people-ops`)

- Reporting table groups by `department_id` then `role_type_id`. Region, Reporting Manager, Email columns unchanged.
- Add Person dialog: Department dropdown → Role Type dropdown (filtered), Region, Manager, Email.
- Bulk re-sync button (admin): re-imports from the same sheet structure via a CSV upload (future-proofs without needing me again).

### 4.4 Lock staffing

- Stays a single deal-level boolean (`staffing_locked_at`). UI chip and Lock Analytics tab unchanged in behaviour. The Lock Analytics breakdowns by VSD / Capability now derive Capability from `department_id` instead of the old hard-coded mapping.

## 5. Code changes

- `src/data/staffingData.ts` — strip `ROLE_KEYS`, `ROLE_CATEGORIES`, `BU_ROLE_CATEGORIES`, `ROLE_TO_PEOPLE_FILTER`, `ROLE_SENIORITY_PARENTS`. Replace with thin types (`Department`, `RoleType`) populated at runtime from queries. Keep `normalizeRoleKey` only for legacy reads (returns role_type_id when given an old key, via a one-time mapping table for tests).
- New hook `useTaxonomyQuery` → cached fetch of departments + role types.
- New hook `useDealApplicabilityQuery` / `useDealApplicabilityMutations`.
- `useStaffingMutations.assignPerson` switches `roleKey` arg to `roleTypeId`.
- `useStaffingLockMutations` and `LockAnalyticsTab` — no behaviour change, only swap "Capability" inference to use department.
- `BopmStaffingFlatTable`, `DealViewTab`, `PeopleViewTab`, `MatrixTab`, `CapacityTab`, `HiringGapTab`, `BWRulesTab`, `AddStaffingMemberDialog`, `RequestStaffingDialog`, `PeopleReportingTable`, `AddPersonDialog`, `AddTeamDialog`: all consume the taxonomy hook for labels/columns/filters.
- Legacy fields on `staffing_people` (`role_category`, `role_title`) kept readable for backward-compat in any non-staffing UI that still references them, but the staffing app stops writing them.

## 6. Edge cases / rules

- People with `role_type_id NULL` (Leadership, Influencer, Perf Marketing in the sheet) appear in People Ops but are excluded from staffing pickers and capacity math.
- Per-role overrides cannot enable a role-type whose department is set to non-applicable (UI grays out).
- BW rules without a matching `role_type_id` after migration are kept but flagged for admin attention on the BW Rules tab.
- Lock chip continues to be admin-only; no per-dept locks in this rewrite.
- Realtime channel keys unchanged.

## 7. Files touched

```text
supabase/migrations/<ts>_staffing_taxonomy_rewrite.sql   (new)
supabase/migrations/<ts>_staffing_taxonomy_seed.sql      (new)
src/data/staffingData.ts                                 (major edit)
src/lib/dbMappers.ts                                     (update Person/Assignment mappers)
src/hooks/queries/useTaxonomyQuery.ts                    (new)
src/hooks/queries/useDealApplicabilityQuery.ts           (new)
src/hooks/queries/useDealApplicabilityMutations.ts       (new)
src/hooks/queries/useStaffingMutations.ts                (edit)
src/components/staffing/BopmStaffingFlatTable.tsx        (rewrite columns)
src/components/staffing/DealApplicabilityPopover.tsx     (new)
src/components/staffing/AddStaffingMemberDialog.tsx      (edit)
src/components/staffing/{DealViewTab,PeopleViewTab,MatrixTab,
   CapacityTab,HiringGapTab,BWRulesTab,RequestStaffingDialog,
   LockAnalyticsTab}.tsx                                 (edit)
src/components/settings/{PeopleReportingTable,AddPersonDialog,
   AddTeamDialog}.tsx                                    (edit)
src/pages/{Staffing.tsx,PeopleOps.tsx}                   (light edit)
```

## 8. Out of scope

- No changes to Deal Detail, Financials, MBR, RGY, Targets, or Dashboard beyond consuming the new `role_type_id`/`department_id` where they currently display role labels.
- No bulk-lock, per-department lock, or role-level lock.
- No re-import UI built in v1 (re-import handled via this migration; future CSV uploader noted but not built).

## 9. Risks

- Wiping `staffing_assignments` means every active deal shows fully unstaffed until BOPMs refill — communicate before deploy.
- 122 people in the sheet vs current ~120 in DB: anyone currently staffed who isn't in the sheet is gone; BOPMs will see "person missing" in History/audit views (mitigated because assignments are wiped too).
- BW rules need a manual remap pass post-migration.