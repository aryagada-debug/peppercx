## Change

1. **Test emails ("Send test") for the 3 BOPM digest rules** should include every real deal that would appear in the actual digest for the sample BOPM (Rishabh Agarwal), instead of the 4 hardcoded sample rows. The email is still delivered to whatever `to` address the admin typed — only the contents become real.
2. **MBR reminder rule description/subject** in Settings still reads "Working-day reminders (T-10, T-7, T-4, T-1) … previous-month MBR". Update it to reflect the new behaviour (fires once when 10 calendar days remain in the current month; checks current month).

## Where

- `supabase/functions/send-app-email/index.ts` — `send_test_rule` branch (~lines 913–990), the digest sample-payload block.
- `public.notification_rules` row `mbr.reminder_bopm_digest` — `description` and `subject_template`.
- `supabase/functions/notification-cron/index.ts` — top-of-file comment (line 2) still says "T-10/7/4/1 working days"; align with new logic.

## Edits

### 1. Real applicable rows in test emails

In `send_test_rule`, when the rule is one of the 3 BOPM digests, replace the hardcoded `rows` with a resolver that mirrors `notification-cron`:

- Resolve the sample BOPM (`Rishabh Agarwal`) to their email via `staffing_people`.
- Pull `staffing_deals` in `ACTIVE_STATUSES` where Rishabh appears in `bopm` / `senior_bopm` / `principal_bopm` (case-insensitive substring on the comma-split names, same as `groupByBopm`).
- Apply the per-digest filter:
  - **MBR**: exclude deals whose current-month `mbr_entries.status` is `Done` or `Not Required`.
  - **RGY**: keep deals with no `deal_rgy_weekly` row in the last 7 days.
  - **NPS**: keep pending POCs from `survey_invites` (sent, not completed) for Rishabh's deals; group per POC as in the cron.
- Build the `rows` array in the exact shape each digest template expects (`account`, `deal`, `month`/`last_updated`/`poc_*`, `link`).
- If the resolver returns zero rows (Rishabh has no pending items), fall back to the existing 4 sample rows so the test still previews the layout, and prefix the subject with `[Sample data]`.
- Keep `bopm_name = "Rishabh Agarwal"`, `vsd_name = ""` (no CC on tests), `days_remaining` computed from today, `mbr_month` = current month, `week_label` from today.
- Recipient of the actual email remains the `to` address the admin typed; only the `payload.rows` change.

Deploy `send-app-email` after the edit.

### 2. MBR rule description

Run a one-line update via `supabase--insert` (UPDATE is allowed there):

```sql
update public.notification_rules
   set description = 'Once a month, when 10 calendar days remain in the current month, sends one email per BOPM listing all their accounts whose current-month MBR is still not logged (status not Done / Not Required). CCs the VSD.',
       subject_template = 'Action needed: {pending_count} MBR(s) pending for {current_month} — {days_remaining} days left'
 where event_key = 'mbr.reminder_bopm_digest';
```

Also update the header comment in `notification-cron/index.ts` line 2 from `T-10/7/4/1 working days` to `10 calendar days before month-end`.

## Not changing

- Email templates / branded layout.
- Recipients logic in production cron.
- RGY and NPS rule text (still accurate).
- Settings UI code — only the DB-stored `description` / `subject_template` strings change, which the existing UI already renders.
