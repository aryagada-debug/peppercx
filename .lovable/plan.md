# Resend stuck Google Form invites

## Goal
Give users a one-click way to re-send the Google Form invite email (and refresh sync state) for invites that have been "Awaiting sync" for too long — plus a bulk action to handle all stuck ones at once.

## What counts as "stuck"
An invite is `Awaiting sync` when: `source = 'google_form'`, `sent_at` is set, `completed_at` is null, and no `survey_responses` row exists.
Threshold for "stuck": `sent_at` older than **48 hours**. (Rationale: most respondents open the same or next day; 48h avoids nagging early.)

## UX changes — `src/components/pulse/AnalyticsResponsesTable.tsx`
1. Extend the row model with an `awaiting_sync` boolean and a `stuck` boolean (age > 48h).
2. Row-level "Resend" button (existing Resend column):
   - Already enabled for `failed`. Also enable it for `awaiting_sync` rows.
   - Tooltip: "Resend Google Form invite" for google_form rows, "Resend failed invite" otherwise.
3. Sync note text: when stuck, append `" · Sent {N} days ago — try resending."` so users can see age at a glance.
4. Header bulk action next to "Resend failed":
   - New "Resend stuck syncs (N)" button. Counts filtered rows where `stuck && awaiting_sync`.
   - Calls the same `pulse-resend-invite` function.
5. Toast copy: reuse existing; nothing new backend-side.

## Backend
`pulse-resend-invite` already accepts `inviteIds[]` and re-sends via the current send path (which respects `source = 'google_form'` and regenerates the prefilled Google Form URL). **No edge function changes.**

On resend success the function updates `sent_at`, so the "awaiting sync" clock resets and the row drops out of "stuck" until it ages again — exactly what we want.

## Non-goals
- No new DB columns, no schema migration.
- No changes to the webhook or Apps Script flow.
- No auto-retry cron — user-initiated only, to avoid spamming respondents.

## Technical notes
- `stuck` computed in the same `useMemo` as `rows`: `awaiting_sync && sent_at && (Date.now() - new Date(sent_at).getTime()) > 48*3600*1000`.
- Bulk id list mirrors the `failedVisibleIds` pattern.
- Reuse `runResend(ids, "bulk")` — no new handler.
