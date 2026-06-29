## Issue

The survey email links point to `https://peppercx.lovable.app/survey.html?t=...`. Fetching that URL returns the React 404 page — Lovable's SPA host is serving `index.html` instead of the static `public/survey.html` file, so the survey never loads. (The static page also has 822 lines of hand-rolled HTML/JS calling Supabase from anon — fragile and out of step with the app's auth/styling.)

## Fix

Replace the static page with a proper public React route inside the SPA, which is guaranteed to render on Lovable hosting.

1. **New page** `src/pages/PublicSurvey.tsx`
   - Path: `/s/:token` (public, no auth wrap).
   - Reads token from the URL, calls `supabase.rpc("get_survey_invite_by_token", { _token })`.
   - Shows the recipient name + deal/account, NPS 0–10 scale, CSAT 1–5, comment box, submit button.
   - On submit, posts to the existing `survey-submit` edge function via `supabase.functions.invoke`.
   - Handles already-completed and invalid-token states with friendly messages.
   - Uses the app's design tokens (matches the existing email template look).

2. **Register the route** in `src/App.tsx` alongside the other public routes (`/login`, `/calendar/callback`), outside `ProtectedRoute`.

3. **Update link generation** in `supabase/functions/send-pulse-survey/index.ts`:
   - Change `${APP_ORIGIN}/survey.html?t=${inviteToken}` → `${APP_ORIGIN}/s/${inviteToken}`.
   - Also update the same link in the `pulse_email_templates` rendering path / preview if hard-coded.

4. **Update the in-app email template preview** (`PulseEmailTemplateEditor.tsx`) sample link to `/s/<token>`.

5. **Delete `public/survey.html`** so nothing references the old broken path.

6. (Optional safety) Add a tiny `/survey.html` → `/s/:t` client-side redirect inside the SPA router so any already-sent emails still work after publish.

## Why this works

Lovable's SPA fallback always serves `index.html` for client-routed paths, so `/s/<token>` will hit the React app every time, no hosting/static-file race. The existing `get_survey_invite_by_token` RPC and `survey-submit` edge function are already public and unchanged — only the rendering layer moves.

## Files touched

- add: `src/pages/PublicSurvey.tsx`
- edit: `src/App.tsx`, `supabase/functions/send-pulse-survey/index.ts`, `src/components/rgy/PulseEmailTemplateEditor.tsx`
- delete: `public/survey.html`

No DB migration needed.
