## Change

Update the MBR BOPM digest (`mbr.reminder_bopm_digest`) so it:
1. Checks whether the **current month's** MBR is filled (instead of previous month).
2. Fires **once** when there are **10 calendar days remaining** in the current month.

## Where

`supabase/functions/notification-cron/index.ts`, MBR block (lines ~126-190).

## Edits

- Replace the working-days-remaining slot logic (`SLOTS = {10,7,4,1}`) with a single trigger: calendar days remaining in current month == 10 (i.e. fires on `lastDayOfMonth - 10`).
- Change the entries query window from `[prevMonthStart, thisMonthStart)` to `[thisMonthStart, nextMonthStart)`.
- Update `ym`, `monthLabel`, and `mbr_month` payload fields to reference the **current** month.
- Update dedupe key to `mbr_digest:<bopm>:<currentYM>` (single send per month) so it can't double-fire.
- Keep `bypass_schedule` / `bypass_dedupe` behavior for the Settings "Send now" button.
- Keep "Done" and "Not Required" as the completion states.

## Not changing

- Email template, recipients (BOPM to, VSD cc), Anirudh suppression, or the Settings UI.
- RGY and NPS digests.
- Existing per-deal MBR reminders in `mbr-reminders` (Slack-only, unrelated).
