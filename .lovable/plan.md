## Staffing & Capacity — 3-Tab Restructure (Deal View / People View / Matrix)

Restructure the Staffing & Capacity page into three tabs with new layouts and a powerful Matrix grid that becomes the source of truth for allocations across the app.

### Tab 1 — Deal View

Replace existing KPI cards + table with a single VSD-pivoted summary table.

**Columns**: VSD | Already Staffed | No Staffing Needed | Staffing Needed | Total

- One row per VSD (sourced from `staffing_deals.vsd`)
- One row "Yet to be assigned" for deals with no VSD
- Totals row at bottom
- Counts colored: Already Staffed = green, Staffing Needed = red, zeros muted
- Numbers computed live from `staffing_deals.staffing_status` field

**Below the table** — two editable dropdown filters:

- **Deal Type** filter: `Retainer` / `Non-Retainer` / `Pilot` / `All` (filters the table)
- **Deal Status** filter: `Active Deal` / `Completed` / `Churned` / `All` (filters the table)
Both persist in URL query params.

Clicking a VSD row expands to a list of their deals (account, deal name, MRR, status) — keeps the existing deal-drill-down logic from current `DealLevelView`.

### Tab 2 — People View

Replace KPI cards with a hierarchical org-tree table grouped by Department (Operations, Content, SEO, Creative, Video, etc.).

**Columns**: Name | Designation | Deals | MRR | Total Rev | Target | Rev % | Hours (with utilization bar)

- Department group headers show: active count, health distribution mini-bar (Overloaded / Near Full / Healthy / Under-utilised), and avg utilisation %
- Within each department, people are nested by reporting manager (Leader → Manager → Junior) — reuse the existing reporting-manager tree from `PeopleTab.tsx`
- Top filter chips: **Overloaded / Near Full / Healthy / Under-utilised** (with counts), search box, "Collapse all"
- Click a person → expand row to show their deals table:
  - Sub-columns: Deal | Account | Alloc % | Hrs | MRR
  - Sourced from `staffing_assignments` joined with `staffing_deals`
  - Editable allocation % inline (writes back to `staffing_assignments.allocation_pct`)

### Tab 3 — Matrix

Big editable spreadsheet replicating the master sheet structure. One row per deal.

**Column groups** (collapsible group headers):

1. **Deal Identity** — Pepper BU, Capability Line, PC Code, Deal ID (Formulated), Deal ID (Temp), Account, Deal Name, Deal Type, Master Status, Staffing Status, Validation by Central CX
2. **Financials** — Month of Closed Won, MRR, Duration, Retainer Value, Non-Retainer Value, Total Deal Value, Deal Value Lost, Net Deal Value, Total MIS Recognition, Total Pending Recognition, Consumption, Under/Over (×2), MIS vs Consumption, Invoiced, Net − Invoiced, Undelivered Funnel, Start Month, End Month, Deal-Target Status, Deal Status
3. **VSD & BOPM** — VSD + %, Principal BOPM + %, Senior BOPM + %, BOPM + %
4. **Content** — Content Lead 2026 + %, Senior Editor + %, Managing Editor + %, Content Lead + %
5. **SEO** — SEO Staffing flag, SEO Leader + %, Group Head + %, Sr SEO Manager + %, SEO Manager + %, Sr SEO Analyst + %, SEO Analyst + %
6. **Creative — Strategy** — Strategy CD/ACD/Sr Strategist (name + bandwidth)
7. **Creative — Copy** — CD-Copy, ACD-Copy, Sr Copywriter, Jr Copywriter (each with %)
8. **Creative — Art** — Sr CD-Art, ACD-Art, Art Director, Sr Designer, Jr Designer (each with %)
9. **Production / Video** — Production Head, AD-Video PM, Current AD, Video PM/ACPPM, Video Editor 1–5 (each with %)
10. **Other Resources** — Influencer Team, Freelance Ecosystem, Performance & Growth, Strategy Team Bandwidth Required, TCV (USD)

**UX**:

- Sticky first 3 columns (Account, Deal Name, Deal Type)
- Sticky group-header row above column headers
- Group toggles to collapse irrelevant column groups
- Inline edit on every cell (text / number / % / dropdown for staff names — populated from `staffing_people`)
- Person dropdowns include "Not Applicable" sentinel
- "Add row" creates a new deal stub
- Toolbar: search, column-group visibility, export CSV
- Row colored by Master Status (Active = subtle green tint, Churned = red, etc.)

**Sync rules** (the critical part):

- Editing a person + % in Matrix → upsert into `staffing_assignments` (deal_id, role_key=column, person_id, allocation_pct)
- Conversely, edits in Deal Detail → Staffing tab and People View → expanded deals also write the same `staffing_assignments` rows
- People View's hours/utilisation, Deal View's "Already Staffed/Staffing Needed" counts, and Matrix all read from the same `staffing_assignments` + `staffing_deals` joined query
- Matrix uses optimistic updates with toast on save; debounced batch writes (500ms)

### Data model

- All needed columns already exist on `staffing_deals` and `staffing_assignments`. No migration required.
- Add a small `MATRIX_ROLE_COLUMNS` constant in `src/data/staffingData.ts` mapping each Matrix person column to a `role_key` (e.g. `vsd`, `principal_bopm`, `senior_bopm`, `content_lead_2026`, `seo_leader`, `cd_copy`, `video_editor_1`, etc.) — these `role_key`s become the link between Matrix cells and `staffing_assignments` rows.
- A few non-staffing free-text/number fields on Matrix (Strategy Bandwidth Required, TCV USD, MIS Recognition, Consumption, Under/Over, etc.) need columns on `staffing_deals`. Will add via one migration:
  - `total_mis_recognition`, `total_pending_recognition`, `consumption`, `mis_vs_consumption`, `invoiced_deal_value`, `undelivered_funnel`, `tcv_usd`, `strategy_bandwidth_required`, `month_closed_won`, `deal_target_status`, `pepper_bu_l2` (all numeric/text/date as appropriate; nullable, default null/0/'')

### Files

- Edit: `src/pages/Staffing.tsx` — replace tab structure with the 3 new tabs (Deal View / People View / Matrix)
- New: `src/components/staffing/DealViewTab.tsx` — VSD pivot table + filter dropdowns + expandable rows
- Edit: `src/components/staffing/PeopleLevelView.tsx` → renamed/refactored to `PeopleViewTab.tsx` — strip KPI cards, add column headers, inline person→deals expansion with editable allocation
- New: `src/components/staffing/MatrixTab.tsx` — virtualised grid (use existing table primitives + sticky CSS), inline-edit cells, group collapse
- New: `src/components/staffing/MatrixCell.tsx` — typed editable cell (text / number / % / person-picker)
- Edit: `src/data/staffingData.ts` — add `MATRIX_ROLE_COLUMNS` map and column-group definitions
- Edit: `src/hooks/useStaffingData.ts` — add `updateDealField`, `upsertAssignment`, `removeAssignment` helpers if not present
- New migration: add the missing financial/metadata columns on `staffing_deals` listed above
- Remove/retire: existing `SummaryTab.tsx`, `AccountsTab.tsx`, `CapacityTab.tsx`, `BWRulesTab.tsx`, `HiringGapTab.tsx`, `RevenueCapacityTab.tsx` from the Staffing page tabs (keep files for now; just unlink from nav). User can confirm if we should fully delete in a follow-up.

### Open questions before build

1. **Retired tabs** — the current Staffing page has many sub-tabs (Summary, Accounts, Capacity, BW Rules, Hiring Gap, Revenue Capacity). Confirm: collapse them all under the new 3-tab structure, or keep them accessible somewhere (e.g. a "More" menu)?  
remove them
2. **Retainer / Active Deal dropdowns** — confirmed these are filters above/below the table that change which deals are counted. Or did you mean two new editable columns inside the VSD table (one per deal-type)?  
editable columns
3. **Matrix scale** — ~550 deals × ~80 columns. OK with horizontal scroll + sticky columns + virtualisation? (Alternative: one row per deal but split person-roles into a separate side panel that opens per row.)  
one row per deal but split person-roles into a separate side panel that opens per row