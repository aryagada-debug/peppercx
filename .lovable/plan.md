## Slack Channel Inactivity Flag

Detect deals whose linked Slack channel has fewer than **2 human messages in the last 7 days** (deal must be Active), surface a warning in the **MBR tab**, and post a one-time weekly nudge to the channel.

### Definition of "human message"

From `slack_messages`, count rows where:

- `deal_id = <deal>`
- `created_at >= now() - 7 days`
- `source = 'slack'` (excludes app-sent messages where `source='app'`)
- Bot messages are already filtered at ingestion (`slack-events` skips `ev.bot_id`), so no extra filter needed.

Threshold: `< 2` messages → **inactive**.

Deal must be Active: `staffing_deals.deal_status = 'Active Deal'` AND `slack_channel_id` is non-empty.

---

### 1. Database — add nudge log table

New migration creates `slack_inactivity_nudges` to ensure we send the Slack notice **at most once per deal per ISO week** (idempotent).

```sql
CREATE TABLE public.slack_inactivity_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text NOT NULL,
  channel_id text NOT NULL,
  week_start date NOT NULL,
  message_count int NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, week_start)
);
ALTER TABLE public.slack_inactivity_nudges ENABLE ROW LEVEL SECURITY;
-- authenticated read; only edge function (service role) writes
CREATE POLICY "Auth read nudges" ON public.slack_inactivity_nudges
  FOR SELECT TO authenticated USING (true);
```

### 2. New edge function — `slack-activity-check`

Path: `supabase/functions/slack-activity-check/index.ts` (config: `verify_jwt = false` so it can be cron-invoked; verifies a shared secret or callable from client with auth).

Two modes via POST body:

- `{ mode: "scan" }` — iterates all active deals with `slack_channel_id`, computes 7-day human msg count, for each `< 2` inserts into `slack_inactivity_nudges` (skips on conflict) and posts a Slack message:
  > ⚠️ *Low activity flag* — This channel had only N message(s) from the team in the last 7 days. Per VSD-OS, active deals should see ≥ 2 weekly updates. This has been flagged in the MBR tab.
- `{ mode: "status", deal_id }` — returns `{ count, isInactive, lastMessageAt }` for live UI display (no side effect).

Slack post uses existing `SLACK_BOT_TOKEN` via `chat.postMessage` (same pattern as `slack-send`).

### 3. Frontend — MBR tab inactivity banner

Edit `src/pages/DealDetail.tsx` `DealMBRTab`:

- On mount, if `deal.slackChannelId` and deal status is Active, call `supabase.functions.invoke('slack-activity-check', { body: { mode: 'status', deal_id: dealId } })`.
- Add a 4th KPI card / inline alert: **"Slack Activity"** showing one of:
  - ✅ Active — N msgs / 7d
  - ⚠️ Inactive — only N msg(s) / 7d (red tone)
  - — Not linked (muted, when no channel)
- Show a dismissible alert above the MBR table when inactive: *"Slack channel flagged as inactive (<2 team messages this week)."*

Also surface the same flag as a small badge on the **Slack** column of the deals list:

- `src/pages/Deals.tsx` (or wherever the deal rows render) — add a tiny `🔴 Inactive` chip when applicable. (One bulk fetch of last-7-day counts grouped by `deal_id`.)

### 4. Scheduled scan (weekly)

Add a `pg_cron` job in the migration to invoke the edge function every Monday 09:00 IST:

```sql
SELECT cron.schedule(
  'slack-inactivity-weekly',
  '30 3 * * 1',  -- 09:00 IST Monday
  $$ SELECT net.http_post(
       url := 'https://gdklfxqbocvoxcfthysy.supabase.co/functions/v1/slack-activity-check',
       headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE>"}'::jsonb,
       body := '{"mode":"scan"}'::jsonb
     ); $$
);
```

(Uses existing `pg_net` + `pg_cron` extensions; will enable in migration if not already.)

### 5. Files touched

- **New** `supabase/migrations/<ts>_slack_inactivity.sql` — table + cron
- **New** `supabase/functions/slack-activity-check/index.ts`
- **Edit** `supabase/config.toml` — add `[functions.slack-activity-check] verify_jwt = false`
- **Edit** `src/pages/DealDetail.tsx` — MBR tab Slack activity KPI + alert
- **Edit** `src/pages/Deals.tsx` — optional inactive chip in deal list

### Edge cases handled

- Deal not Active → skipped entirely.
- No `slack_channel_id` → UI shows "Not linked", no Slack post.
- Already nudged this ISO week → unique constraint blocks duplicate Slack post.
- All messages from `source='app'` (sent via VSD-OS UI) → still counted as inactive, since these are app/bot-originated, not organic Slack engagement.
- Bot messages from the Lovable Slack app → already excluded at ingest time.

### What you'll see after approval

1. Open any active deal → **MBR** tab shows a Slack Activity card with a red "Inactive" badge if low.
2. Mondays 09:00 IST, the system auto-posts the warning to flagged channels (one nudge per channel per week).
3. The deals list gets a subtle "🔴 Slack channel Inactive" chip on rows where the Slack channel is silent.  
  
Add another chip that will say clack channel not connected. 