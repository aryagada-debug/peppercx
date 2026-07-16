## Root cause

The current suppression in `supabase/functions/send-app-email/index.ts` (around line 505-507) only skips when the **assignee** being staffed is Anirudh:

```ts
if (STAFFING_EMAIL_SUPPRESSED.has(person.email.trim().toLowerCase())) return null;
```

But staffing/allocation emails (`staffed`, `staffing_changed`, `staffing_removed`) also reach other people via the notification rule system (lines 849-871). The `assignment.created` rule expands `extra_to`, `cc_tokens`, and `extra_cc` — and `{assignee_manager}` resolves to the assignee's manager in `staffing_people`. Since Anirudh is a manager/VSD for many people, he gets copied on their staffing emails through this path, bypassing the current per-assignee suppression.

## Fix

In `supabase/functions/send-app-email/index.ts`, apply the suppression to the **final recipient lists** (both `to` and `cc`) for staffing/allocation events, right before `buildRaw` is called (around line 870).

1. Keep the existing early return (still useful when Anirudh is the direct assignee).
2. Add a global filter for staffing events: if `inp.event` is one of `staffed | staffing_changed | staffing_removed`, remove any address matching the suppression set (case-insensitive) from both `finalTo` and `cc`.
3. If `finalTo` becomes empty after filtering, skip the send and log `skipped: true, reason: "all_recipients_suppressed"`.
4. Lift the `STAFFING_EMAIL_SUPPRESSED` set to module scope so both the early-return and the new final-list filter share one source of truth.

No other files change. Deploy `send-app-email` after the edit.

## Verification

- Trigger a staffing change for a report of Anirudh's and confirm the email log shows no row with `recipient_email = anirudh@peppercontent.io` for staffed/staffing_changed/staffing_removed events.
- Non-staffing events (MBR, RGY, handover, etc.) remain unaffected.
