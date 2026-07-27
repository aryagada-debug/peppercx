# Portfolio Update Framework — filled file + in-app page

## Part A — Filled xlsx (delivered now as artifact)

Populate the uploaded workbook for the current reporting month (Nov-2026), one row per relevant deal per tab. All-open scope = deal_status in Active Deal, New Deal in SLA/PO, Deal Disputed, Deal in Renewal Process. Preserve purple header row and yellow example row; write real data starting row 4.

Per-tab row selection and column fills:

**VSD tab** — one row per open deal (grouped by VSD).
- Month = Nov-2026
- Deal / Client = "{deal_name} / {account}"
- Submitted By (VSD) = deal.vsd
- RGY Status = overall RGY from latest `deal_rgy_weekly` (worst-of across dimensions → Red/Yellow/Green; blank if none)
- NPS (latest) = latest `survey_responses.nps` for that deal
- CSAT (latest) = latest `survey_responses.csat_avg` for that deal
- Remaining KPI + narrative columns left blank (owner fills)

**US BOPM tab** — deals whose business_unit / geo is US (fallback: any deal where account country/region indicates US; if none reliably tagged, include all open deals owned by BOPMs with US in their profile — will use `staffing_deals.business_unit ILIKE '%US%'` OR `region ILIKE '%US%'`).
- Submitted By (BOPM) = principal_bopm || senior_bopm || bopm (first non-empty)
- RGY Status = same rollup
- MBR Completion (%) = MBRs with status Done in last 3 months ÷ MBRs due in last 3 months from `mbr_entries`
- Rest blank

**SEO tab** — deals with SEO applicability (`deal_applicability` where capability = SEO, or `capability_line ILIKE '%SEO%'`).
- Submitted By (SEO Head) = "Mayur" (constant per current org)
- RGY Status = latest `capability_seo` dimension from `deal_rgy_weekly`
- Rest blank

**Creative tab** — deals with Creative/Content applicability.
- Submitted By = "Sneha" (blank if unknown — leave blank rather than guess)
- RGY Status = latest `capability_creative` dimension from `deal_rgy_weekly`
- Rest blank

Script: openpyxl load → for each tab, run scoped SQL → write rows from row 4 → save to `/mnt/documents/Portfolio_Update_Framework_Filled.xlsx` → emit `<presentation-artifact>`. No formula recalc needed (no formulas added).

## Part B — In-app page

New route `/portfolio-update` (sidebar under Operations, group "Portfolio Update").

Access:
- VSD tab: visible to admin + users whose person role matches VSD
- US BOPM tab: admin + BOPMs on US deals
- SEO tab: admin + SEO capability leads (Mayur / Vedanga / SEO group heads)
- Creative tab: admin + Creative capability leads
- Non-admins see only tabs they own; admins see all four

UI:
- Tabs component (VSD / US BOPM / SEO / Creative) with same column set as xlsx
- Month selector (defaults to current month)
- Rows auto-seeded from same queries as Part A on first open of a month, one row per relevant deal for the signed-in owner
- Editable cells for narrative + KPI columns; RGY/NPS/CSAT/MBR% cells are read-only (auto-computed, refresh on load)
- "Export to Excel" button reuses the same fill logic → downloads xlsx matching template layout
- Save writes to new table `portfolio_updates`

Data model — new migration:
```
portfolio_updates (
  id uuid pk,
  month date not null,             -- first of month
  tab text not null,               -- vsd | us_bopm | seo | creative
  deal_id text not null references staffing_deals(id) on delete cascade,
  submitted_by text,
  rgy_status text,                 -- snapshot at save
  metrics jsonb default '{}',      -- nps, csat, mbr_pct, traffic_delta, etc.
  narrative jsonb default '{}',    -- exec_summary, achievements, risks, support, priorities
  created_by uuid, updated_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (month, tab, deal_id)
)
```
Grants: SELECT/INSERT/UPDATE/DELETE to authenticated + ALL to service_role. RLS: user can read/write rows for deals in `visible_deal_ids_for_user(auth.uid())`; admins read/write all.

## Files

- `/mnt/documents/Portfolio_Update_Framework_Filled.xlsx` (artifact)
- New migration for `portfolio_updates`
- `src/pages/PortfolioUpdate.tsx`
- `src/components/portfolio/{VsdTab,UsBopmTab,SeoTab,CreativeTab,ExportButton}.tsx`
- Shared `src/hooks/queries/usePortfolioRows.ts` (computes seed rows + merges saved edits)
- Route + sidebar entry in `src/App.tsx`, `src/components/layout/AppSidebar.tsx`

## Out of scope
- Notifications / reminders for submitters
- Historical backfill beyond current month
- Approval workflow
