## Root cause found

The survey feature has **no created invites or responses in the database** (`survey_invites = 0`, `survey_responses = 0`). That means the survey page cannot open for any real token because no token rows exist to look up. The route `/s/:token` exists, but the full send → invite → open → submit chain is not completing.

There is also a risky access setup: the survey tables have broad anon table privileges but the app relies on a security-definer lookup and an edge function for public access. I’ll tighten this so public users can only access surveys through the token flow, and logged-in users can still see analytics through existing deal visibility rules.

## Plan

1. **Fix invite creation visibility**
   - Update the Pulse send flow so failed email sending still leaves a clear invite row with failure reason.
   - Make the UI surface send results prominently: recipients attempted, invites created, emails sent/failed, and exact reason if Gmail/central mailbox blocks sending.
   - Ensure the generated link always uses the current app origin instead of a stale/hardcoded domain when needed.

2. **Fix public survey opening**
   - Keep `/s/:token` as the correct public route.
   - Make token lookup resilient and return only safe invite fields.
   - Add proper error states for invalid token, expired/missing invite, already submitted, and backend error.

3. **Fix response submission/storage**
   - Harden `survey-submit` validation so NPS must be 0–10 and CSAT must be 1–5.
   - Store submitted response rows with invite ID, deal ID, respondent details, NPS, CSAT, comment payload, and completion timestamp.
   - Mark the invite completed only after the response insert succeeds.

4. **Audit database access rules**
   - Replace broad public table access with a safer token-only function/edge-function model.
   - Keep authenticated analytics access scoped to deals the user can see.
   - Keep service access for functions that create invites and responses.

5. **Verify end to end**
   - Create/use a test invite path, open `/s/:token`, submit NPS/CSAT, and confirm:
     - invite `opened_at` is set,
     - one response row is created,
     - invite `completed_at` is set,
     - analytics queries can read the response.
   - Check function logs/network status for the send and submit functions after the fix.