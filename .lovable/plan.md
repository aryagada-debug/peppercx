## Goal

When a Pulse response has `source = "google_form"`, the drill-in view should display the answers as they were captured from the Creative Pulse Google Form (11 sections, exact question wording), instead of trying to shoehorn them into the in-app SurveyWizard layout.

## What to build

1. **New component** `src/components/pulse/GoogleFormResponseView.tsx`
   - Reads `payload.answers` (the object keyed by Google Form question titles that the webhook already stores) plus `payload.raw` / `payload.comment` as fallbacks.
   - Renders sections matching the form:
     1. Respondent (company, role, email) — from `answers["Which company are you with?"]`, `answers["Which best describes your role on this retainer?"]`, `answers["Email"]`.
     2. Outcomes — success criteria (multi), measurable impact, on-brand consistency, craft rating, single-win verbatim.
     3. Your experience — 7 sub-ratings on 1–5 (with N/A), rendered as star rows like the current SurveyResponseView, plus the free-text "got right / could do better" verbatim.
     4. Looking ahead — renewal likelihood.
     5. Change-your-mind verbatim.
     6. Growth — where retainer could do more.
     7. Recommendation — NPS 0–10 with category pill (Promoter/Passive/Detractor), reusing `npsCategory` from `@/lib/pulseSurvey`.
     8. Main reason / what would need to change (verbatim).
     9. Holding back from wholehearted yes (verbatim).
     10. Value most / quote (verbatim).
     11. Overall feeling — mood/scale.
   - Handles missing answers gracefully (renders "—").
   - Includes a small "Unmapped answers" collapsible at the bottom that lists any keys in `answers` we didn't explicitly render, so nothing is lost if Google Form question wording changes.
   - Reuses existing `Section`, `QA`, `Pill`, `Quote`, `ScaleBar`, `Empty` styling (extract into a shared helper file or duplicate the small primitives inside the new component — whichever keeps the diff small).

2. **Route by source** in `src/components/pulse/AnalyticsResponsesTable.tsx`
   - In the drill-in `Dialog` body (around line 512), branch:
     - `drillRow.source === "google_form"` → `<GoogleFormResponseView payload={drillRow.payload} />`
     - otherwise → existing `<SurveyResponseView payload={drillRow.payload} />`.
   - Also pass `nps` / `csat_avg` from `drillRow` into the Google Form view so the header can show them even if `answers` parsing misses the NPS numeric.

3. **PNG download** — the existing "Download PNG" action already snapshots the dialog body, so it will automatically capture whichever view is rendered. No changes needed there.

## Non-goals

- No changes to the webhook, database, or in-app SurveyResponseView.
- No changes to Send/Analytics tabs beyond the drill-in dialog body.
- No new fields on `survey_responses`.

## Technical notes

- The webhook stores `payload = { comment, answers, raw, diagnostics }` where `answers` is `Record<questionTitle, string | string[]>`. Match on the exact titles from the shared form; fall back to `payload.raw.answers` if `payload.answers` is missing on older rows.
- Experience sub-ratings are captured as a grid in Google Forms; they typically arrive as either a nested object or as separate `answers` keys of the form `"How are we doing on each of these? [Quality of the creative output — …]"`. The new view will look for both shapes and normalize before rendering star rows.
