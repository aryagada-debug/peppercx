## Goal

Open the **People Ops** page to Admins, every VSD, and every Capability Leader, and add the two missing views from the reference app — **Capacity** and **Hiring Gap** — scoped automatically to the viewer's team.

## 1. Access — route + data scope

- `route_visibility`: set `visible=true` for `route_key='people-ops'` for roles `member` (VSD) and `capability_lead`. Admin already true.
- New hook `src/hooks/useTeamScope.ts`:
  - Admin → returns `{ scopeMode: "all" }`.
  - VSD (`member`) / Capability Leader (`capability_lead`) → resolves the viewer's `staffing_person_id`, walks `staffing_people.reporting_manager` to build the set of all direct + indirect reportees (plus self), returns `{ scopeMode: "team", teamPersonIds, teamDealIds }` (deals derived from `staffing_assignments` for that team).
  - Other roles → empty scope (page already gated by route_visibility, so this is a safety net).
- `PeopleOps.tsx` filters `people` / `assignments` / `deals` through this scope before passing them down. Header subtitle becomes "Your team — N people" for non-admins.

## 2. Tabs

Convert the page body to four tabs (existing content stays):

| Tab | Content |
|---|---|
| Summary | Existing `PeopleOpsAnalyticsStrip` + `DepartmentCardsGrid` + `UtilLegend` |
| People | Existing `PeopleReportingTable` |
| Capacity | New `PeopleOpsCapacityTab` |
| Hiring Gap | New `PeopleOpsHiringGapTab` |

## 3. Capacity tab — `src/components/people-ops/PeopleOpsCapacityTab.tsx`

Mirror the reference screenshot, using semantic tokens (no hard-coded colors).

- Four summary cards on top:
  - `> 100% Overloaded` (red)
  - `85–100% Near Full` (warning)
  - `30–85% Healthy` (positive)
  - `< 30% Under-utilised` (info)
- Filter row:
  - Role pills: All Roles / Senior BOPM / VSD / SEO Growth Lead / SEO Capability Leader / Content Lead / Content Capability Leader / Others
  - "Lead" select (managers in the scoped people set)
  - "VSD" select (admins only; for VSDs/CapLeads it's locked to themselves)
  - Counter `N of M people` on the right
- Grouped table (group by `designation`), columns:
  `▶ | Name | Role | Region | Reporting Manager | BW Used (bar + %) | # Deals | MRR (actual) | MRR Capacity | MRR Fill %`
  - BW used = sum of `allocationPct` across active, non-expired assignments. Bucket coloring same as cards.
  - MRR (actual) = Σ(deal.mrr × allocation%) over active assignments.
  - MRR Capacity = `getPersonRevenueCapacity(person, allPeople)` (already implemented).
  - MRR Fill % = actual / capacity; color green ≥ 100, warning ≥ 60, destructive otherwise.
  - Row expands to show per-deal split (deal name, region, allocation %, deal MRR contribution).
- Below the table: **VSD-Level Capacity** rollup. For each VSD in the scope, aggregate BW used (avg), total MRR actual, total capacity, fill %.

## 4. Hiring Gap tab — `src/components/people-ops/PeopleOpsHiringGapTab.tsx`

- Top filter: VSD select (admin / multi-VSD only).
- Two side-by-side cards:
  - **Leaving (N)** — list of `leaving` people in scope, with role + manager + impacted-deal count.
  - **TBH placeholders (N)** — list of `tbh` people, with assigned-deal count.
- **Replacement-needed deals** — active deals that have at least one assignee marked `leaving`.
- **FTE Gap by role** cards for the three driver roles (Senior BOPM, SEO Growth Lead, Content Lead):
  - Required BW = sum of recommended allocations per deal from `staffing_bandwidth_rules` (existing memory references this) where the deal is in scope.
  - Current BW = sum of `allocationPct` of in-scope people in that role on active deals.
  - Gap = `ceil(required) - ceil(current)`, shown as "⚠ N FTE gap" / "✓ Sufficient".
- **Unstaffed active deals** — active deals in scope with `mrr > 0` and no non-leaving / non-TBH assignee in the driver roles.
- **Prioritised Hiring Plan** table — reads from existing TBH person rows (Name, Designation, Region, Manager, target date if recorded, rationale notes). Editable via a small dialog (consistent with Core memory "all data must be editable").

## 5. Out of scope

- No new DB tables. We reuse `staffing_people`, `staffing_assignments`, `staffing_deals`, `staffing_bandwidth_rules`, the new `getPersonRevenueCapacity` helper, and `route_visibility`.
- No changes to the existing Summary / People tabs beyond wrapping them in the new tab shell.
- Mobile-specific tuning not addressed beyond Tailwind responsive defaults already used in PeopleOps.
