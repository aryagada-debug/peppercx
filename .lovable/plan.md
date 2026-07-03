## Goal
Replace the current Pulse/NPS wizard with the new 5-step "Customer Pulse" form shipped in `customer-feedback-survey_3.html`, realign the analytics (KPIs, filters, tables, drill views) to the new schema, and wipe legacy survey responses so charts match 1:1.

## 1. Schema + data (backend)

- **Data wipe (via insert tool):** `DELETE FROM public.survey_responses;` and reset invite completion (`UPDATE public.survey_invites SET completed_at = NULL, opened_at = NULL;`) so counts start clean.
- **No schema migration required.** `survey_responses` already stores freeform `payload jsonb` plus the columns we still use (`nps`, `csat_avg`, `renew`, `mood`, `churn_risk`, `respondent_*`). CES column stays in DB but stops being written/read.
- `submit_pulse_response` RPC keeps working: it derives `nps_category`, `csat_avg` (from `experience.avg`, rounded 1–5), `renewal_intent`, `mood`, `churn_risk`, `expansion_ready`, `capabilities`, `reasons` — all still emitted by the new payload.

## 2. Survey model — `src/lib/pulseSurvey.ts`

Rewrite types + defaults + scoring to match the new form:

- `PulseAnswers`:
  - `respondent`: `{ role: Role|"", name, email, company, capabilities: Capability[] }` (drop `wants_followup`; `capabilities` auto-set to `["seo","content"]`).
  - `nps`: `{ score: number|null, verbatim: string }` (score constrained to the 5 bucketed options 10/9/7/4/1 in the UI, but stored 0–10).
  - `value`: `{ value_for_money: number|null }` (drop `goal_attainment`, `target_outcome`).
  - `capability_deep_dive`:
    - `content?: { quality: number|null }`
    - `seo?: { success_metrics: string[]; traffic_growth: number|null; ai_citation_visibility: number|null; organic_to_pipeline: number|null; win_outcome: string }`
    - Remove `creative` and `studios` entirely.
  - `experience`: `{ ratings, comment }` (unchanged; rows: quality, support, comms, speed, +`ease` when user/both, +`partner` when buyer/both).
  - Remove `effort` / CES entirely.
  - `retention`: `{ renewal_intent, save_lever }` unchanged.
  - `expansion`: `{ interests: string[] }` with new options `volume | platforms | geo | outcomes | none` (drop referral fields).
  - `sentiment`: `{ mood: Mood|"" }` where `Mood = "love" | "glad" | "neutral" | "frustrated" | "done"` (rename `fine` → `neutral`; drop `one_change`, `fan_for_life`).
- `computeChurnRisk`: keep NPS/renewal/value/mood contributions; add `content.quality <= 2` (+1) and keep SEO signals; remove `effort.ces` and `goal_attainment` and `content.drives_outcome`.
- `expansionReady`: unchanged logic (any interest ≠ `none` AND renewal ∈ {def, prob}).
- `buildPayload`: emit the new shape; `experience.avg` stays for `csat_avg` derivation.
- `defaultConfig` reduced to the 5 new steps: `role`, `outcomes` (value + SEO block + content quality + win outcome), `experience`, `retention_growth` (renewal + save + expansion), `recommend` (NPS bucket choices + mood + verbatim). Keep copy from the HTML verbatim.

## 3. Wizard — `src/components/pulse/SurveyWizard.tsx`

Rewrite step definitions to 5 sections mirroring the HTML:

1. **About you** — company text input (required) + role card grid (buyer/user/both). Auto-set `capabilities=['seo','content']`. Drop the separate capabilities step.
2. **Outcomes** — Value scale (1–5), then SEO/GEO block (multi-select outcomes, traffic-growth scale, AI-search visibility scale in a highlighted panel, organic-to-pipeline scale), then Content quality scale, then `seo_winOutcome` textarea. Validation matches the HTML `validate()` list.
3. **Experience** — existing star matrix; add `ease` row when role∈{user,both}, `partner` row when role∈{buyer,both}; low-rating aware follow-up prompt (existing behavior).
4. **Loyalty & growth** — renewal choice; conditional "save lever" textarea when `unsure/risk/gone`; expansion multi-select with new options (volume/platforms/geo/outcomes/none; `none` clears others and vice-versa).
5. **Recommend us** — NPS as 5 stacked choice cards mapped to scores 10/9/7/4/1 with the exact copy; conditional follow-up prompt varying by band; mood choice list with 5 options including `neutral`.

Keep existing progress bar, back/next nav, submission plumbing (`onSubmit(payload)`), preview banner, and the "already submitted" screen. Reuse existing shadcn primitives (Button, Card, Textarea, Input, RadioGroup/checkbox visuals) so the flat purple design system is preserved — do not import the HTML's inline CSS.

## 4. Analytics — `src/pages/PulseNPSAnalytics.tsx` + subcomponents

- **KPIs (`AnalyticsKpis.tsx`)** — remove CES tile; keep NPS score, Promoters/Passives/Detractors mix, CSAT avg (from `csat_avg`), Response rate, Churn-risk %, Expansion-ready %.
- **Filters** — update mood filter chips to include `neutral`; update expansion filter options to `volume | platforms | geo | outcomes | none`; remove any filter tied to CES / goal_attainment / referral / wants_followup.
- **Responses table (`AnalyticsResponsesTable.tsx`)** — drop CES column and "wants follow-up" column; keep NPS, CSAT, Renewal, Mood, Churn risk, Reasons; add a "Content quality" and "SEO traffic growth" column sourced from `payload.capability_deep_dive.content.quality` and `payload.capability_deep_dive.seo.traffic_growth` when present.
- **Aggregates in `useAnalyticsData.ts` / any analytics helpers** — stop reading `ces`, `payload.effort`, `payload.value.goal_attainment`, `payload.expansion.referral_openness`, `payload.sentiment.one_change|fan_for_life`, and `content.drives_outcome/needed_outcomes/on_brief`. Add readers for the new `content.quality`, `seo.win_outcome`, and normalized expansion values.
- **Response drill view (`SurveyResponseView.tsx`)** — remove Effort/CES section, Creative/Studios sections, Goal Attainment, Referral, One Change, Fan-For-Life panels. Add: Content Quality (single scale), SEO Win Outcome (verbatim), updated Expansion list with new labels, updated Mood mapping.
- **Mood mapping helper** — extend to `neutral: "Neutral"` and keep back-compat mapping for stale `fine` value (renders as Neutral) even though we wipe rows, in case any legacy invite still submits during rollout.

## 5. Nice-to-haves out of scope

- Email templates (`send-pulse-survey`, `PulseEmailTemplateEditor`) left untouched per user answer.
- `SurveyFormEditor.tsx` still edits `pulse_survey_config`; because its schema is `PulseConfig`, we'll adjust its editor sections to the new step keys so admins can still tweak copy. If the current config JSON in DB uses old keys, the wizard falls back to `defaultConfig` (already the behavior when `data.steps` is missing).

## Technical notes

- `submit_pulse_response` reads `_payload #>> '{experience,avg}'`, `{nps,score}`, `{retention,renewal_intent}`, `{sentiment,mood}`, `{flags,churn_risk}`, `{flags,reasons}`, `{flags,expansion_ready}`, `{respondent,role|capabilities|name|email|company}`. All of these remain in the new payload → no RPC change needed.
- `pulse-churn-alert` edge function reads `payload.respondent.wants_followup` — safe to leave (it will just render "Follow-up: undefined"), but we'll drop that one line in the Slack template since the field no longer exists.
- No changes to `survey-submit` edge function (unused by the wizard, which calls the RPC directly).

## Files touched

- `src/lib/pulseSurvey.ts` (rewrite types, config, scoring, payload)
- `src/components/pulse/SurveyWizard.tsx` (5-step rewrite)
- `src/components/pulse/AnalyticsKpis.tsx` (drop CES)
- `src/components/pulse/AnalyticsResponsesTable.tsx` (columns)
- `src/components/pulse/AnalyticsTable.tsx` (aggregates/filters)
- `src/components/pulse/useAnalyticsData.ts` (drop ces reads if any)
- `src/components/pulse/SurveyResponseView.tsx` (drill view sections)
- `src/pages/PulseNPSAnalytics.tsx` (filter options, mood chips)
- `src/components/pulse/SurveyFormEditor.tsx` (align editor sections to new step keys)
- `supabase/functions/pulse-churn-alert/index.ts` (remove `wants_followup` line)
- Data op (via insert tool): wipe `survey_responses` and reset invite completion.
