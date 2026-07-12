## Scope

Public survey form (`/survey/:token`) shown to recipients — `src/pages/SurveyForm.tsx` + `src/components/pulse/SurveyWizard.tsx` + `src/lib/pulseSurvey.ts`.

## Changes

**1. Header subtitle — company only**
- In `SurveyForm.tsx`, drop the ` — {deal_name_snapshot}` suffix from `subtitle`. Show just `invite.account_snapshot`.

**2. Lighter outlines for better visibility**
- In `SurveyWizard.tsx` `PulseFrame`, lighten the `--line` token:
  - Light mode: `#e7e4ef` → `#efecf5`
  - Dark mode: `#2c2740` → `#3a3352`
- Also lighten the unselected star color `#d8d4e0` → `#e4e0ec` in `Stars`.
- All borders across cards, inputs, chips, star row already read from `var(--line)`, so this single change flows through.

**3. Make every question compulsory**
- In `validate()`:
  - `experience`: require every visible row to have a value (star rating 1–5 or explicit N/A) instead of "at least one".
  - `retention_growth`: also require the `save_lever` textarea when the "at risk" branch is revealed.
  - `recommend`: require the `nps.verbatim` follow-up textarea (shown after picking a score).
  - `outcomes`: require the `seo.win_outcome` textarea.
- Add red `*` markers to the corresponding `FieldLabel`s that become required (experience follow-up, retention save, nps verbatim, seo win outcome).

**4. Wider form so scale options stay on one line**
- In `PulseFrame`, bump `maxWidth: 680` → `960`.
- In `LabelScale`, tighten so 5–7 options fit: change `flex: "1 1 120px"` and `minWidth: 100` to `flex: 1` with `minWidth: 0`, and remove `flexWrap: "wrap"` on the container so options render on a single row (matches the "compact" behavior already used for AI visibility).

**5. Q1 wording**
- In `src/lib/pulseSurvey.ts`, `defaultConfig.steps.about.company_q`:
  `"Which company / account are you with?"` → `"Which company are you with"`.
- Also update `normalizePulseConfig` fallback if it repeats the old string (it references the same default).

**6. Post-submit screen — minimal thank-you**
- In `SurveyWizard.tsx`, replace the `if (done)` block content with a single card containing only the line: **"Thank you, truly. Your response has been recorded"**.
- Remove: 🎉 emoji, `Lede` copy, the three `ScoreCard` tiles (NPS / Experience / Mood), and the "New response" preview button.
- Keep the small `serverError` warning only if the save failed (silent otherwise), so the recipient still knows if something went wrong.

## Out of scope

- No changes to `PublicSurvey.tsx` (legacy short survey — not the current form).
- No changes to email content, invite RPCs, or analytics.
- No changes to which questions appear per role — only their required status.
