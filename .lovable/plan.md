Evidence checked:
- The `pulse-google-form-webhook` function has only boot/shutdown logs and no submission/error logs.
- Function HTTP logs show no calls to this webhook in the last 48 hours.
- The Google Form config row is present with a form URL, tracking entry ID, and webhook secret, but `field_map` is empty.
- Recent Google Form invites were sent, but none have `completed_at` set and no matching Google Form responses exist.

Plan:
1. Add a clear diagnostics section in Settings → Notifications for the Google Form integration:
   - Show webhook health/config status.
   - Add a “Test webhook” action that sends a synthetic request and confirms the backend can write a test-mapped response path without relying on Google Forms.
   - Show actionable error states: “Apps Script not calling webhook”, “missing token”, “invalid secret”, “field mapping incomplete”.

2. Harden `pulse-google-form-webhook`:
   - Log every incoming request with safe metadata only.
   - Accept token from either top-level `token` or mapped Google Form answers.
   - Use `field_map.tracking_token` as a first-class mapping key, not only `nps`, `csat`, and `comment`.
   - Return structured diagnostics for missing token / missing mapped fields.
   - Store raw Google Form answers even if optional score mappings are incomplete, as long as the tracking token maps to a valid invite.

3. Update Google Form config UI:
   - Add explicit fields for Tracking Token question, NPS question, CSAT question, and Comment question instead of requiring raw JSON.
   - Keep the JSON advanced editor available for edge cases.
   - Generate/copy the Apps Script snippet using the configured webhook endpoint and expected answer keys.

4. Add response visibility safeguards:
   - In Pulse/NPS analytics, surface Google Form invites whose email was sent but no webhook callback has arrived.
   - Show a reason column/status note so it is clear whether the email was sent, opened, completed, or waiting on Google Form sync.

5. Validate after implementation:
   - Send the test webhook from Settings.
   - Confirm a request appears in webhook logs.
   - Confirm the invite is marked completed and a `survey_responses` row with `source = google_form` is created for the matching token.