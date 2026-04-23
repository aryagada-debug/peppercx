## MBR Slack Reminder Triggers

Add automated Slack reminders that post into each deal's linked Slack channel, driven by the `mbr_entries.scheduled_date` field.

### Trigger rules

**Trigger A — "Fill MBR details" reminder (10 days before MBR)**

- Condition: `scheduled_date = today - 10 days` AND status is `Pending` (details not yet filled)
- Message: `📝 Reminder: MBR for *<Deal Name>* scheduled on <date>. Please fill in the MBR details: <app link to deal MBR tab>`
- Sent once per MBR entry.

**Trigger B — "MBR in 2 days" countdown (T-2 and T-1)**

- Condition: `scheduled_date = today + 2 days` OR `scheduled_date = today + 1 day`
- Message T-2: `⏰ Reminder: MBR for *<Deal Name>* in 2 days (<date>).`
- Message T-1: `⏰ Reminder: MBR for *<Deal Name>* tomorrow (<date>).`
- Sent on each of the two days.

Reminders only post to deals with a linked `slack_channel_id`. Identical reminders won't be re-sent on the same day (deduped by a log table).

### Implementation

**1. New table `mbr_reminder_log**`
Tracks which reminders have been sent to prevent duplicates if the cron runs more than once per day.
Columns: `id`, `mbr_entry_id`, `reminder_type` (`fill_details` | `t_minus_2` | `t_minus_1`), `sent_date`, `channel_id`, `created_at`. Unique constraint on `(mbr_entry_id, reminder_type, sent_date)`. RLS: authenticated read/insert.

**2. New edge function `mbr-reminders**` (`verify_jwt = false`, called by cron)
Logic:

- Query `mbr_entries` joined with `staffing_deals` where `scheduled_date` in `{today+1, today+2, today+10}` and `staffing_deals.slack_channel_id` is non-empty.
- For each match:
  - Determine reminder type from date offset.
  - Skip if already logged in `mbr_reminder_log` for today.
  - For `fill_details`, also skip if `status != 'Pending'`.
  - Post message to Slack via `chat.postMessage` using `SLACK_BOT_TOKEN`, with `username: "VSD-OS"` so it appears as the app.
  - Insert into `slack_messages` (so it shows in the in-app chatbot too).
  - Insert into `mbr_reminder_log`.
- Returns summary `{ sent, skipped, errors }`.

App link format for fill-details message: `<preview-url>/deals/<deal_id>` (uses the deal detail route — MBR is a tab there).

**3. Cron schedule (pg_cron + pg_net)**
Enable `pg_cron` and `pg_net` extensions. Schedule daily at 09:00 IST (03:30 UTC):

```sql
select cron.schedule('mbr-reminders-daily', '30 3 * * *',
  $$ select net.http_post(
       url:='https://gdklfxqbocvoxcfthysy.supabase.co/functions/v1/mbr-reminders',
       headers:='{"Content-Type":"application/json"}'::jsonb,
       body:='{}'::jsonb) $$);
```

Inserted via the supabase insert tool (not migration) since URL is project-specific.

**4. Manual "Run now" trigger (optional, recommended)**
Add a small **"Send test reminders now"** button on the MBR Tracker header (admin-only) that calls the edge function on demand for verification.

### Files

- New: `supabase/functions/mbr-reminders/index.ts`
- New migration: create `mbr_reminder_log` table + RLS, enable `pg_cron`, `pg_net`
- SQL insert (via insert tool): cron schedule
- Edit: `supabase/config.toml` — add `[functions.mbr-reminders] verify_jwt = false`
- Edit: `src/pages/MBRTracker.tsx` — add "Run reminders now" button

### Verification steps after deploy

1. Manually invoke the function once and check `mbr_reminder_log` + the Slack channel of a test deal.
2. Inspect edge function logs for any Slack errors (channel not found, bot not invited, etc.).
3. Cron will then run automatically each morning.