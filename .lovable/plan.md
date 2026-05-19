## 1. Slack chatbot: resolve user mentions and shorten URLs

**File:** `src/components/deals/SlackChatBot.tsx` (also reuse the same logic for `slack-channel-history`-fed text).

Slack sends raw markup inside `text`:
- User mentions: `<@U12345>` or `<@U12345|name>`
- Links: `<http://example.com>` or `<http://example.com|label>`
- Channels: `<#C123|name>`

Replace the plain `{m.text}` render with a small formatter that:
- Builds a `Map<userId, displayName>` from the messages already fetched (the history function already resolves `user` → name; we extend it to also return a `users` map keyed by Slack user ID so the frontend can rewrite `<@Uxxx>` tokens inside message text).
- Splits text into tokens and renders:
  - `<@Uxxx>` / `<@Uxxx|name>` → `@DisplayName` (badge styled, primary color). If unknown, fetch via a small lookup call (cached) or fall back to the inline name.
  - `<http…|label>` and bare `<http…>` → a single clickable token labelled **URL** (opens in new tab, `rel="noopener"`).
  - `<#Cxxx|name>` → `#name`.
- Decodes Slack entities (`&amp;`, `&lt;`, `&gt;`).

**Backend change** in `supabase/functions/slack-channel-history/index.ts`: in addition to `messages`, also scan each message's `text` for `<@U…>` IDs, resolve them via `users.info` (same cached batch we already do), and return a `users: { [id]: displayName }` map so the frontend can rewrite mentions without extra round-trips.

No DB changes.

## 2. MBR auto-task: end-of-month, auto-close, no recurrence, record link

**File:** `supabase/functions/mbr-task-generator/index.ts`

Changes to Part 1 ("Schedule MBR"):
- Only create the task in the **last 7 days of the current month** (skip otherwise). This makes it "appear at the end of the month".
- Set `auto_regen: false` so it does not recur.
- `end_date` = last day of the month (not today+7).
- Add a record link into `description`, e.g.:
  ```
  Record the MBR directly: <APP_ORIGIN>/deals/<deal.id>?tab=MBR&action=record
  ```
  `APP_ORIGIN` comes from a new env var (e.g. `APP_ORIGIN`, defaulting to the published URL).

New Part 1b — **auto-close**:
- For each Active deal that **does** have a scheduled MBR for the current month, find any open auto-gen task with `phase = 'MBR'`, `auto_regen = false` (or legacy `true`), title starting with `Schedule MBR`, and update `stage = 'Done'`. This handles users who scheduled after the task was created.

Part 2 ("Update MBR notes") — also flip `auto_regen` to `false` to match the "no recurring" rule; keep dedup via `mbr_reminder_log`.

**Frontend hook (optional but recommended):** in `src/components/mbr/ScheduleOnlyDialog.tsx` / wherever an MBR `scheduled_date` is saved (`useMBRData`), after a successful upsert that sets `scheduled_date` in the current month, run the same close-task update so the kanban reflects immediately without waiting for the daily cron.

**Record action in UI:** in `src/pages/DealDetail.tsx` (or the MBR tab component), read `?action=record` from the URL and auto-open the existing MBR notes drawer / `MBRInputDrawer` so the link in the task description lands users directly in the record flow.

No DB schema changes.

## Technical notes

- The Slack history function already resolves the message author IDs; we extend the same resolved `nameMap` lookup to cover mention IDs found inside `text` so we avoid N+1 calls.
- All edge-function edits keep the existing `npm:@supabase/supabase-js@2` import style (no other functions touched).
- The mbr-task-generator already deploys with the daily cron; behaviour change is purely in logic, no schedule changes needed.
