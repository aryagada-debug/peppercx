## What I verified
- The app’s Pulse Google Form config points to the correct Google Form and expects the email question title `Email`.
- There is currently 1 pending Google Form invite and 0 Google Form responses recorded in the app.
- The webhook function for this app has no recent logs, and there are 0 unmatched submissions, which means the live Google Form submit flow is still not reaching this app’s webhook.
- The saved field map still contains a legacy `tracking_token` mapping to `Which company are you with?`, which can cause old/test payloads to fail with `invalid_token` if the deployed webhook/config path still falls back to token matching.

## Plan
1. **Harden the webhook behavior**
   - Make email-based matching the only required mapping path for Google Form submissions.
   - Remove dependence on `tracking_token` for normal submissions.
   - If an email is present but no matching pending invite exists, log the submission into `pulse_unmatched_submissions` instead of failing silently.

2. **Clean up the Google Form config**
   - Remove the stale `tracking_token` field map from the default config.
   - Keep `email_question_title = Email` and retain NPS/CSAT/comment mappings.

3. **Add a safe backfill/sync path**
   - Add or expose a “sync from Google Sheet / pasted responses” admin action only if the webhook still has historical submissions that never reached the app.
   - For each row, match by respondent email to the latest pending Google Form invite and mark it completed.
   - Unmatched rows should be visible for manual review instead of disappearing.

4. **Improve the UI status clarity**
   - In Pulse/NPS analytics, show Google Form invites as `Awaiting form submit` only when no webhook/submission has arrived.
   - Show unmatched submission diagnostics separately so admins can see whether the issue is “not submitted,” “not received,” or “received but not matched.”

5. **Validate end-to-end**
   - Test the webhook with an `answers.Email` payload matching the pending invite.
   - Confirm a `survey_responses` row is created with `source = google_form` and the invite is marked completed.
   - Confirm the response appears in the Pulse/NPS Analytics → Responses table.