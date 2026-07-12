## Scope

Pulse / NPS page (`/pulse-nps`) send flow + analytics.

## 1. Pepper BU filter (Send Surveys tab)

- Extend the deals query in `src/pages/PulseNPS.tsx` to select `business_unit` and pass it through on each deal.
- In `src/components/rgy/PulseSurveyTab.tsx`, add a `activeBU` state and a BU filter control next to the existing VSD / BOPM chips (dropdown, since BU list is short — Pepper Content, Pepper Creative, Pepper Digital, etc., derived distinct from loaded deals + "All").
- Apply the filter in `filteredDeals` alongside VSD/BOPM/search.

## 2. Always CC [anirudh@peppercontent.io](mailto:anirudh@peppercontent.io)

- In `supabase/functions/send-pulse-survey/index.ts`, after the existing auto-CC leadership block, unconditionally append `anirudh@peppercontent.io` to `ccEmails` (dedupe via the existing `Array.from(new Set(...))`).
- Respect the existing `excludeCcNames` only for name-based auto-CC; Anirudh is added by email so it always stays.
- No UI change needed — it will show in the "CC" list on the sent invite record automatically. add an option to remove this email as well just keep it added by default

## 3. Campaigns

**Data model** (migration):

- New table `public.pulse_campaigns` (`id uuid pk`, `name text not null unique`, `description text`, `created_by uuid`, `created_at timestamptz default now()`), with GRANTs + RLS (authenticated read/insert; admin full).
- Add `campaign_id uuid null references public.pulse_campaigns(id) on delete set null` to `public.survey_invites`, with index.

**Send flow** (`PulseSurveyTab.tsx`):

- Add a "Campaign" selector above the Send button: dropdown of existing campaigns + "➕ New campaign…" option that opens a small inline dialog (name + optional description). Selection is optional.
- Pass `campaignId` in the `send-pulse-survey` invoke body.

**Edge function** (`send-pulse-survey/index.ts`):

- Accept optional `campaignId`, validate it exists, and write it into each `survey_invites` insert.

**Analytics** (`src/pages/PulseNPSAnalytics.tsx` + `src/components/pulse/useAnalyticsData.ts`):

- Include `campaign_id` in the invites select and hydrate campaign name via a `pulse_campaigns` lookup.
- Add a "Campaign" filter (dropdown: All / each campaign / No campaign) to `AnalyticsFilters` and apply it in the client-side filter chain.
- Add a "Campaign" column to `AnalyticsTable` / `AnalyticsResponsesTable`.
- Optional: a small KPI card for "Campaigns active" and per-campaign response rate is out of scope unless requested.

## Notes / non-goals

- No changes to the survey form itself or to email template content (Anirudh is silent CC only).
- Campaign is metadata only — it does not gate sending or change email copy.
- All existing filters, permissions (`useCanEditRgy`), and RLS behavior unchanged.