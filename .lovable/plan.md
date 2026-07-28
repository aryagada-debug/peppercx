## Goal
Make Google Form responses show up in the app.

## Root cause
The Apps Script attached to your form is POSTing to `https://pvchgfndmojcuvhfsvoj.supabase.co/functions/v1/NPS-creative-form`. That URL is on a **different backend project** and a **function name that does not exist in this app**. Our webhook has received 0 hits (0 unmatched submissions, 0 completed google_form invites), which confirms nothing is reaching us. The Pulse Google Form config in this app is otherwise correct (form URL saved, `Email` question mapped for email-based matching).

## Fix (no code changes needed — configuration only)
1. **Get the correct webhook URL + shared secret from the app.** In this app, go to **Settings → Notifications → Pulse Google Form**. The "Apps Script snippet" panel there shows the exact webhook URL for *this* project and the shared secret to send in the `secret` field. Copy both.
2. **Update the Apps Script bound to the Google Form** (`1FAIpQLScoBY5IInv54OsTW-I5M81LicgKAg-bmg8z0kgSMSn0HudWsg`):
   - Replace the current endpoint string with the URL from step 1.
   - Confirm the payload sent on submit is `{ secret, answers }` where `answers` is a map of question title → response (the snippet in Settings already does this).
   - Save, then **Deploy → Manage deployments → New deployment → Web app**, "Execute as: Me", "Who has access: Anyone". Copy the new deployment URL (Apps Script side) — this is only needed if you're using an intermediate web-app; the trigger itself is `onFormSubmit`.
   - In the Apps Script editor: **Triggers → Add trigger →** function `onFormSubmit`, event source "From form", event type "On form submit". Authorize when prompted.
3. **Verify the email question title matches exactly.** Config currently expects `Email`. Your form's first question is `Email` — good. Leave as is.
4. **Send a test end-to-end:**
   - In Settings → Notifications → Pulse Google Form, click **Send test webhook**. Expect `ok:true` and a new row in "Recent activity".
   - Then submit the live Google Form as `arya.gada@peppercontent.io` (the recipient of the existing pending invite `a05eb7ec…`). Within a few seconds, the invite should flip to **Completed** on `/pulse-nps/analytics`.
5. **If a real submission still doesn't arrive:**
   - Open the Apps Script editor → **Executions**. If `onFormSubmit` isn't listed, the trigger never fired → recreate it (step 2).
   - If it fired but errored, the log will show the HTTP status from our webhook. 401 = wrong/missing `secret`. 400 `invalid_email` = the answers map didn't include the `Email` field (fix the question title or the snippet's answer extraction).
   - Any submission that reaches the webhook but can't be matched will appear in `pulse_unmatched_submissions` (visible to admins) — that's the diagnostic surface.

## Non-goals
- No schema changes.
- No edge function changes — email-based matching is already deployed and correct.
- No changes to the Google Form itself.

## Deliverable of this plan
A short in-chat walkthrough with the two values the user must paste into Apps Script (webhook URL + shared secret) sourced from **Settings → Notifications → Pulse Google Form**, plus the trigger-setup checklist above. No file edits.