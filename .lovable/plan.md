
## Goal
Send NPS via your Google Form (https://forms.gle/xeV7YXrsB9gL8vgTA) while guaranteeing every submission maps back to the correct deal + recipient, using a unique token per invite and an Apps Script webhook on submit.

## How mapping works
1. You add one short-answer question to the Google Form titled **"Tracking ID"** (or similar). Recipients see a prefilled, read-only-looking value.
2. For each POC we generate a unique token (already how `survey_invites.token` works) and build a prefilled Form URL:
   `https://docs.google.com/forms/d/e/<FORM_ID>/viewform?usp=pp_url&entry.<TRACKING_ENTRY_ID>=<TOKEN>`
3. Recipient submits. An Apps Script bound to the form fires on submit and POSTs the response to a new public edge function, which looks up the token in `survey_invites` and writes a `survey_responses` row tied to the correct `deal_id`.

## Changes

### 1. Settings — Google Form config (admin only)
In `src/pages/Settings.tsx` (or a small new card), add fields to store:
- Google Form public URL
- Form ID (parsed automatically)
- Tracking entry ID (e.g. `entry.1234567890`)
- Apps Script shared secret

Stored in a new tiny table `public.pulse_google_form_config` (single row) with admin-only RLS. Secret stored server-side; UI shows masked.

### 2. New send path: "Send via Google Form"
In `src/components/rgy/PulseSurveyTab.tsx`, add a second primary action alongside the existing "Send survey":
- **Send Pepper survey** (existing in-app flow — unchanged)
- **Send Google Form**

The Google Form path reuses the same deal/contact selection, unique-contacts toggle, VSD/BOPM filters, and skip-deals-with-no-contacts logic. It creates `survey_invites` rows exactly as today (so Recent Invites, resend, and analytics keep working) but the email CTA points to the prefilled Google Form URL instead of `/survey/<token>`.

### 3. Edge function updates
- `supabase/functions/send-pulse-survey/index.ts`: accept `mode: "in_app" | "google_form"`. In `google_form` mode, read the stored Form URL + tracking entry ID and build the prefilled URL per invite; pass it to the email template as the CTA.
- New public function `supabase/functions/pulse-google-form-webhook/index.ts` (`verify_jwt=false`):
  - Validates a shared-secret header against the stored secret.
  - Body: `{ token, submittedAt, answers: {...} }`.
  - Loads `survey_invites` by token; rejects if missing/expired.
  - Inserts/updates a `survey_responses` row (deal_id from invite) and marks the invite `completed_at`.
  - Best-effort: extract NPS/CSAT if the form has recognizable numeric fields (mapped via a small config in the same settings card: which Google field → nps / csat / comment). Everything else stored in `payload` JSON.

### 4. Apps Script (one-time, you paste into your form)
The plan section for you will include a ready-to-paste `onFormSubmit` script that:
- Reads the "Tracking ID" answer.
- POSTs `{ token, answers, submittedAt }` with the shared-secret header to the new edge function URL.
We surface the exact script + webhook URL + secret in the Settings card with a copy button so you paste it into Extensions → Apps Script on the form once.

### 5. Analytics
No table changes needed — Google Form responses land in the same `survey_responses` table with the correct `deal_id`, so the existing Analytics → Responses table, per-deal drill-ins, unique-contacts filter, resend, and PNG export all work unchanged. Rows from Google will show a small "Google Form" badge (new `source` value on the invite/response).

## Technical details
- New table: `pulse_google_form_config` (single row, id fixed) — form_url, form_id, tracking_entry_id, secret_hash, field_map jsonb, updated_at. Admin-only RLS.
- Column addition: `survey_invites.source text default 'in_app'` and `survey_responses.source text default 'in_app'` to distinguish channels.
- Reuse existing `survey_invites.token` — no new token scheme.
- Webhook is anonymous (Apps Script can't hold Supabase JWT); auth via shared secret header + token existence check.
- No changes to the existing in-app survey flow (`/survey/<token>` still works for the "Send Pepper survey" button).

## Out of scope
- Auto-cloning forms per deal.
- Polling the Google Sheet (we use the on-submit webhook instead).
