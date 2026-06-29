## Pepper Customer Pulse — multi-step survey

Replace the current single-card survey with a branching wizard, and add a "View / Edit" surface so the team can preview and tweak the question copy without redeploying.

### 1. Database (one migration)

Extend `survey_responses` with broken-out columns for fast querying (payload already holds the full nested object):

- `nps_category` text  — Detractor / Passive / Promoter
- `renewal_intent` text
- `mood` text
- `churn_risk` text  — LOW / MEDIUM / HIGH
- `churn_reasons` text[]
- `expansion_ready` boolean
- `respondent_role` text  — buyer / user / both
- `capabilities` text[]

Add `pulse_survey_config` (single row, admin-editable) so question copy, eyebrow text, lede lines and option labels live in the DB:

- `id` uuid PK, `version` int, `config` jsonb (full step/question tree), `updated_at`, `updated_by`
- Grants + RLS: anon `SELECT` (needed by public form), admins can `UPDATE/INSERT`.

Seed one row with the defaults from the spec.

### 2. Public wizard — `src/pages/SurveyForm.tsx`

Full rewrite as a stepper. Token resolution + invite lookup stays the same (`get_survey_invite_by_token` RPC). New pieces:

- Loads `pulse_survey_config` once; falls back to bundled defaults if fetch fails.
- State machine: `answers` object mirroring the payload schema in the spec.
- Top progress bar (`step / totalSteps * 100`), step meta line, Back / Continue, inline red validation copy.
- Step components (one card on screen at a time, fade+rise animation):
  1. Role (3 big cards) — sets `isBuyer`, `isUser`
  2. Capabilities (multi, ≥1)
  3. NPS 0-10 with colour-banded selection + dynamic follow-up textarea
  4. Value & ROI (2 scales; buyer-only outcome input)
  5. Capability deep-dive — only renders sections for picked capabilities, incl. GEO highlighted box
  6. Experience CSAT star matrix (rows depend on role) + N/A + follow-up
  7. CES + friction textarea
  8. Renewal intent + conditional save-lever textarea
  9. Expansion (multi with "happy as-is" mutual-exclusive) + referral scale + conditional name
  10. Wrap-up — mood, optional contact, follow-up call choice
- Reusable inputs: `Scale`, `NPSScale`, `SingleChoice`, `MultiChoice` (with mutex rule), `StarMatrix`, `RevealBlock`, `Textarea600`.
- Submit:
  - Computes `nps.category`, `experience.avg`, `expansion_ready`, `flags.churn_risk` + `reasons` per the scoring rules.
  - Calls a new RPC `submit_pulse_response(_token, _payload, _meta)` that writes to `survey_responses` (broken-out columns + payload) and marks the invite completed. This keeps anon writes safe via SECURITY DEFINER, same pattern as `submit_survey_response`.
  - On failure, still shows the thank-you screen with Copy JSON / Download .json fallback so no answer is lost.
- Thank-you screen: 🎉, NPS + category, avg experience /5, mood emoji, collapsible JSON, "New response" reset.

### 3. Design tokens

Scope the spec's tokens (`--ink`, `--brand`, `--brand-soft`, gradient bg, 16px radius, soft purple shadow) to the public survey route only via a wrapper class in `SurveyForm.tsx` + a small `survey.css` (or inline `<style>`) so it does not bleed into the app theme.

### 4. View / Edit survey copy

New admin tab inside the existing **Pulse / NPS** page (`src/pages/PulseNPS.tsx`) called **"Survey form"**:

- Left: live preview of the wizard (read-only, uses the same components, points at the working draft config).
- Right: structured editor for each step — eyebrow, h1, lede, option labels, scale end-labels, required toggle. Backed by `pulse_survey_config.config` jsonb.
- Save writes a new row (versioned) and bumps `version`; "Reset to defaults" restores the seeded version.
- Gated by `useCanEditRgy` (already used on this page).

### 5. Slack alert on HIGH churn risk

New edge function `pulse-churn-alert`:

- Triggered from the client immediately after a successful insert when `churn_risk === 'HIGH'` (simpler than DB webhook, no extra infra).
- Posts to `SLACK_WEBHOOK` (request as a secret if not present) with the formatted 🚨 message from the spec.

### 6. Acceptance checks (manually verified after build)

- Content-only buyer vs SEO+Creative user see different deep-dive + experience sections.
- Per-step required gating with the warm error copy.
- "Happy as-is" mutex + star-row N/A clearing.
- HIGH-risk submission fires exactly one Slack alert; LOW/MEDIUM do not.
- Row in `survey_responses` has both `payload` and broken-out columns populated.
- Existing invite-token flow + thank-you-on-completed-invite still works.

### Out of scope (call out)

- No change to invite sending, email templates, or analytics page — they keep reading `nps`, `csat_avg`, and `payload` which all still populate.
- `csat_avg` will be set to `experience.avg` (rounded to nearest int 1-5) so the existing analytics keep working without changes.
