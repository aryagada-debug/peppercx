
## Goal

Add a new admin-only page **SEO KRAs** under the Operations sidebar section that lets admins run quarterly KRA reviews for SEO Growth Leads and see a dashboard of results. Skip Team Setup — the team is auto-derived from existing SEO capability members. Architected so a second scorecard (SEO Ops) can be plugged in later without refactoring.

## What we build

### 1. Route + navigation
- New route `/seo-kras` in `src/App.tsx`, lazy-loaded, gated `adminOnly` via `ProtectedRoute` (routeKey `settings` for access).
- New sidebar item in the **Operations** group of `src/components/layout/AppSidebar.tsx`, visible only to admins (uses the existing `adminOnly` flag pattern already used for Deal Handover / Slack Review).

### 2. Backend (Lovable Cloud)
One migration adding two tables with full GRANTs + RLS.

- `seo_kra_reviews`
  - `id uuid pk`, `scorecard_key text` (default `'growth_lead'`, allows later `'seo_ops'`), `member_user_id uuid` (references `auth.users`), `year int`, `quarter text` (`Q1..Q4`), `reviewer_user_id uuid`, `total numeric`, `area_scores jsonb`, `notes text`, `complete boolean`, `created_at`, `updated_at`.
  - Unique index on (`scorecard_key`, `member_user_id`, `year`, `quarter`).
- `seo_kra_scores`
  - `id uuid pk`, `review_id uuid fk → seo_kra_reviews on delete cascade`, `kpi_id text`, `score int`, `note text`, unique (`review_id`, `kpi_id`).
- RLS: admins full access via `has_role(auth.uid(), 'admin')`; select-own by `member_user_id = auth.uid()` (so a reviewee can see their own review later — no UI yet).
- Standard GRANTs (authenticated + service_role) per public-schema rules.

### 3. Frontend

All UI in a new folder `src/components/seo-kras/` with a single page shell at `src/pages/SEOKRAs.tsx`.

Structure (kept small and composable so SEO Ops can be added later by dropping in a second scorecard definition):

- `scorecards/growthLead.ts` — the 4 KRA areas / 18 KPIs / weights / bands from the uploaded HTML, typed as a shared `Scorecard` interface. A `scorecards/index.ts` registry keyed by `scorecard_key` makes adding SEO Ops later a one-file change.
- `SEOKRAsPage` — top-level tabs: **Enter review**, **Dashboard**. (No Team Setup.)
- `useSeoTeam.ts` — reads users from the existing `capability_groups` + `capability_memberships` tables, filtering to the SEO capability group (matched by name containing "SEO" and role_category `growth_lead` / applicable to the scorecard). Returns the member list used everywhere.
- `EnterReviewTab` — reviewer, member, year, quarter selects (member list from `useSeoTeam`). KPI rows show target, definition, band cells, 1–10 score picker, per-KPI note. Sticky weighted-score composer with stacked bar, saves via a single upsert to `seo_kra_reviews` + `seo_kra_scores`.
- `DashboardTab` — filters (year, quarter, capability lead / all). Stat cards (avg score, reviews completed X/Y, strongest area, focus area), pod averages bar, area breakdown bar, quarterly trend line, member × area heatmap, CSV export. Pods are inferred from `capability_leads` (each capability lead ⇒ pod, members assigned via `capability_memberships`).
- Reuse existing UI tokens (semantic colors, `Card`, `Tabs`, `Select`, `Button`) — no new colors or fonts. Two font weights (Regular/Medium) per project design system.

### 4. Data flow

- React Query keys added to `src/lib/queryKeys.ts`: `seoKraTeam()`, `seoKraReviews(scorecardKey, year, quarter)`, `seoKraReview(scorecardKey, memberId, year, quarter)`.
- One query loads the whole quarter for the dashboard; edits invalidate the affected keys.

### 5. Out of scope (per user)

- No Team Setup UI — team comes from the SEO capability group.
- SEO Ops scorecard: registry stub only, not exposed in UI yet.

## Technical notes

- Scoring math (weighted total = Σ(area_avg × weight)) implemented once in `lib/scoring.ts` so both scorecards share it.
- Sample data / demo mode from the uploaded HTML omitted (real users only).
- All amounts stored raw; formatting done at render.
- No changes to existing routes, roles, or non-admin views.

```text
src/
  pages/SEOKRAs.tsx
  components/seo-kras/
    EnterReviewTab.tsx
    DashboardTab.tsx
    KpiRow.tsx
    ScoreComposer.tsx
    useSeoTeam.ts
    useSeoReviews.ts
    scorecards/
      types.ts
      growthLead.ts
      index.ts
    lib/scoring.ts
supabase/migrations/<ts>_seo_kras.sql
```
