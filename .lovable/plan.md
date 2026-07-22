
## 1. Add the SEO Ops scorecard

New file `src/components/seo-kras/scorecards/seoOps.ts` mirroring the Growth Lead structure with 4 areas and 17 KPIs from your table:

- **Outcome-led Growth & Portfolio Performance (30%)** — Organic Traffic & Conversions, Non-brand Traffic & Impressions, GEO Brand Mentions, GEO Domain Prompt Presence, Search Opportunity Experiments.
- **Client Satisfaction & Retention (20%)** — Client Revenue/Retention/Expansion, CSAT & Client Sentiment, Escalation Resolution.
- **Pepper Platform Adoption — AI Transformation & Operational Efficiency (25%)** — Proprietary AI Workflows, Atlas Adoption & AI Roadmap, Resource & Time Optimization.
- **Operational Excellence & Delivery Quality (25%)** — SEO/GEO Reporting Insights, SEO & GEO Strategy Documentation, Content Brief Accuracy & Quality, Technical SEO Audit Quality, SLA & Timely Delivery, SOP & Workflow Improvements.

Registered in `scorecards/index.ts` with `roleCategoryMatch: /seo operations/i` so the team dropdown auto-loads all SEO Ops people (~30 staff already in the directory). The scorecard picker in both tabs then shows two options: **SEO Growth Lead** and **SEO Ops**.

## 2. Colorize the UI

Currently the page is mostly grey cards on white. Refresh to a more designed look while staying on semantic tokens:

- **Area color coding.** Assign each area a color family (Growth = indigo, Client = emerald, AI/Platform = violet, Delivery = amber). Used consistently for:
  - Area header bar with colored left border + soft tinted background.
  - Area-average KPI tiles (top row) get a matching tinted background and colored numeric.
  - Dashboard heatmap chips per area use the same family.
- **Header band.** Replace the plain title block with a subtle gradient banner (primary → primary/70) containing title, subtitle, and the scorecard/year/quarter selectors — pulls the eye to the top and consolidates filter chrome.
- **Score chips.** Keep the existing R/Y/G tone logic but bump contrast and add a small colored dot so scores read at a glance in dense tables.
- **KPI rows.** Zebra striping + a colored left rail matching the area color; band-guide line becomes 4 pill chips (10 / 8–9 / 5–7 / <5) with matching R→G gradient so the scoring rubric is visible at a glance.
- **Weighted Total tile.** Larger, gradient-backed hero tile (colored by score band), with a small progress ring showing % of 10.
- All colors added as semantic tokens in `index.css` (`--kra-growth`, `--kra-client`, `--kra-ai`, `--kra-delivery`, plus `--kra-score-good/warn/bad`) and mapped in `tailwind.config.ts` so nothing is hardcoded in components.

## 3. Per-person KPI trends over time

Add a **Trends** section to the Dashboard tab (below the member scorecards table).

Controls at the top of the section:
- **Member** picker (defaults to first person with any reviews).
- **View** toggle: *Area averages* / *Individual KPIs*.
- **KPI** picker (only shown in Individual KPI mode) — grouped by area, defaulting to the first KPI.
- **Range**: last 4 / 8 / 12 quarters.

Chart:
- Recharts `LineChart` (Recharts is already in the stack per project memory).
- X-axis: quarter labels (`Q3 2025`, `Q4 2025`, …), sorted chronologically.
- Y-axis: 0–10 with reference lines at 5 (bad→ok) and 8 (ok→good).
- One line per selected series, colored by area family. In *Area averages* mode all four areas are drawn; in *Individual KPIs* mode a single KPI line is drawn plus a dashed reference line for the area average.
- Empty state when the member has fewer than 2 saved reviews: shows the single data point plus a hint to save more reviews to see trend.

Data source:
- New hook `useSeoKraMemberHistory(scorecardKey, memberPersonId, limitQuarters)` in `src/hooks/queries/useSeoKraReviews.ts`. Reads `seo_kra_reviews` for the member across all year/quarter combinations, joins `seo_kra_scores` for per-KPI values, and returns an ordered series `[{ periodKey, year, quarter, weighted_total, area_averages, kpiScores: Record<kpiKey, number> }]`.
- No schema changes — everything is already stored per (year, quarter, member).

## 4. Small polish that comes with the color pass

- Selects and tabs get the header band's colored underline for the active tab.
- Sticky area header inside long tables so column meaning stays visible while scrolling.
- Score input becomes an inline segmented control-lookalike (still a number input, just wrapped with the colored chip preview to the right showing what band the score falls into).

## Files touched

- Add: `src/components/seo-kras/scorecards/seoOps.ts`.
- Add: `src/components/seo-kras/TrendsChart.tsx` (Recharts wrapper).
- Update: `src/components/seo-kras/scorecards/index.ts` (register SEO Ops + `areaColor` helper).
- Update: `src/components/seo-kras/EnterReviewTab.tsx` (color pass, gradient header, colored area headers/chips, score-band pill row).
- Update: `src/components/seo-kras/DashboardTab.tsx` (color pass + mount Trends section).
- Update: `src/hooks/queries/useSeoKraReviews.ts` (add `useSeoKraMemberHistory`).
- Update: `src/index.css` and `tailwind.config.ts` (KRA color tokens).

No database migration, no changes to permissions (still admin-only), no changes to unrelated modules.
