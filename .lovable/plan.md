## Goal
The "Access denied" screen in the screenshot is Lovable's editor auth wall — the survey link the recipient clicked points at an `id-preview--*.lovable.app` (editor) URL, not the published `peppercx.lovable.app` domain. Even with the recent edge-function fix, any invite created or copied from inside the editor preview still produces an editor-hosted link, and a few helpers still embed the wrong host. We will replace this with a fully standalone, anonymous public form that:

- Lives on a dedicated route on the **published** domain, with no `AuthProvider`, no `ProtectedRoute`, no role checks.
- Writes the response directly to Supabase via the anon key (no edge function dependency, no JWT).
- Looks identical to today's survey UI so brand stays consistent.

## Scope

### 1. New public route (no auth)
- Add `src/pages/SurveyForm.tsx` — a self-contained component that:
  - Reads the token from `/survey/:token`, `?token=...`, or `?survey=...`.
  - Loads invite metadata via the existing `get_survey_invite_by_token` RPC (already `SECURITY DEFINER`, safe for anon).
  - Calls `supabase.from('survey_responses').insert({...})` directly using the anon client. No `functions.invoke`, no auth headers.
  - Marks the invite `opened_at` / `completed_at` via a new tiny `SECURITY DEFINER` RPC `mark_survey_invite(_token, _state)` so anon can update without broad table grants.
- Mount it in `src/App.tsx` **outside** `AuthProvider`:
  - `/survey/:token`
  - `/survey`
  - Keep existing `/s/:token` and `/?survey=...` as redirects → `/survey/:token` so old links keep working.

### 2. Database (single migration)
- `survey_responses` already has 2 policies. Add:
  - `GRANT INSERT ON public.survey_responses TO anon;`
  - Policy `"Anon can submit a survey response with valid token"` `FOR INSERT TO anon WITH CHECK (invite_id IN (SELECT id FROM survey_invites WHERE completed_at IS NULL))`.
- Add `mark_survey_invite(_token text, _state text)` SECURITY DEFINER function (sets `opened_at` or `completed_at`, scoped by token).
- Grant `EXECUTE` on the new function + existing `get_survey_invite_by_token` to `anon`.

### 3. Link generation hardening
- `src/components/rgy/PulseSurveyTab.tsx` → `surveyLinkForToken` returns `https://peppercx.lovable.app/survey/${token}`.
- `supabase/functions/send-pulse-survey/index.ts` → `surveyLinkFor` always returns `${APP_ORIGIN}/survey/${token}`, ignoring the request `Origin` entirely (single source of truth: the published domain). Email body and "copy link" actions use the same helper.

### 4. Audit (after build)
- Headless Playwright run from the sandbox:
  1. Pick an open invite, POST the new form anonymously, verify a row lands in `survey_responses` and the invite gets `completed_at`.
  2. Re-open the same link → should show the "already submitted" thank-you state instead of a fresh form.
  3. Hit `/survey/invalid-token` → "Survey unavailable" card, no crash.
- Run `supabase--read_query` to confirm: `select count(*) from survey_responses where created_at > now() - interval '5 min'` increments, and the invite row's `completed_at` is set.
- Document the result inline in chat (counts + screenshot of the form).

## Technical notes

```text
Old:  email link → id-preview--*.lovable.app/?survey=TOKEN → Lovable editor auth wall (Access denied)
New:  email link → peppercx.lovable.app/survey/TOKEN       → SurveyForm.tsx (anon) → survey_responses
```

- No edge-function invocation from the form, so even if `send-app-email` / central mailbox is mis-configured the form still records responses.
- `AuthProvider` is never mounted on `/survey/*`, so there is no session check, no redirect, no role gating.
- All existing analytics (`PulseNPSAnalytics`, `useAnalyticsData`) read from `survey_responses` — no changes needed there.

## Out of scope
- Re-sending old invites with corrected links (user can re-trigger from the Pulse tab once the new route is live).
- Visual redesign of the form (keeps current layout).