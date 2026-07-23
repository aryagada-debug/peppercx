## Goal
In Settings → Notifications, allow admins to trigger any notification rule on demand (real send to the actual recipients from the rule), in addition to the existing "Send test" (which only sends to one entered email).

## Changes

### 1. `supabase/functions/send-app-email/index.ts`
- Add a new action `trigger_rule_now` that takes `{ eventKey }`.
- Behavior:
  - Look up the rule by `event_key`; if disabled or missing, return `{ error }`.
  - For the three aggregated BOPM digests (`mbr.reminder_bopm_digest`, `rgy.weekly_bopm_digest`, `nps.weekly_bopm_digest`), reuse the same aggregation logic the cron uses (group active deals by BOPM, resolve VSD CCs, build digest rows) and send one email per BOPM — identical to what the scheduled cron would send today.
  - For any other rule (per-deal event rules), reject with a clear error: on-demand trigger only supports the aggregated digests, since per-deal rules need a triggering deal/context.
- Log each send to `email_send_log` with `template_name = <event_key>` and a `manual-trigger-<timestamp>` idempotency prefix so it's distinguishable from cron runs.
- Return `{ ok: true, sent: <count>, skipped: <count> }`.

### 2. `supabase/functions/notification-cron/index.ts`
- Extract the digest-building logic for MBR/RGY/NPS into small exported helpers (or duplicate cleanly in `send-app-email`) so both cron and the on-demand action produce identical output. No behavior change to the cron itself.

### 3. `src/components/settings/NotificationRulesCard.tsx`
- Next to the existing "Send test" row on each rule card, add a "Send now" button (admin-only, same disabled rules as save).
- Clicking it shows a confirm dialog: "This will send the real email to all configured recipients for {rule.display_name}. Continue?"
- On confirm, invoke `send-app-email` with `{ action: "trigger_rule_now", eventKey }` and toast the result (`Sent N emails` or the returned error).
- For non-digest rules, the button is hidden (or shown disabled with tooltip "On-demand trigger only available for aggregated digests").

## Out of scope
- No schema changes.
- No changes to cron schedule.
- No new rule types.
