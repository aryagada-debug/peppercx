## Two-way Slack: receiving messages + DM-ing people

### Current state

- **Outgoing (working):** `slack-send` posts to a channel via `chat.postMessage` using `SLACK_BOT_TOKEN`, then mirrors the message into `slack_messages` so the in-app chat updates instantly.
- **Incoming (configured but not flowing):** `slack-events` is deployed and looks up a deal by `staffing_deals.slack_channel_id`, then upserts the Slack event into `slack_messages`. If messages sent in Slack aren't appearing in the app, it's almost certainly a Slack-app config issue (Event Subscriptions URL not pointing at the function, missing `message.channels` event, bot not in the channel) — not a code issue.
- **DMs:** not supported anywhere today. The UI (`SlackChatBot`) only has channel pick/send.

### Part 1 — Make incoming channel messages reliable (verification + diagnostics)

Most likely root cause: the Slack app's Event Subscriptions aren't wired up, the bot was never invited to the channel, or signature verification is rejecting events silently.

Changes to `supabase/functions/slack-events/index.ts`:

1. Add structured `console.log` at every decision point (URL verify, signature pass/fail, event type/subtype skips, "no deal mapped", upsert error). This makes the edge function logs the source of truth for debugging.
2. Persist messages even when `bot_id` is set **if** `source !== "app"` (i.e. another bot in the channel) so the app reflects what's actually in Slack. Still skip our own echoes (we already mirror in `slack-send`).
3. Also accept `subtype === "message_changed"` and update the existing row's text — small edit-syncing improvement.
4. Add a one-shot diagnostics endpoint `/diag`: when the function is GET'd with `?diag=1` and a valid admin JWT, it calls Slack `auth.test` + `conversations.info` for a passed channel id and returns whether the bot is a member. The UI's "Connect channel" flow will call this so users see immediately if the bot needs to be invited.

Setup steps the user will need to do once (we'll surface them in the UI as a checklist when no events have been received in 24h):

- In the Slack app's **Event Subscriptions**, set the Request URL to the deployed `slack-events` function URL.
- Subscribe to bot events: `message.channels`, `message.groups` (for private channels), `message.im` (for DMs — see Part 2).
- Reinstall the app to the workspace if scopes change.
- `/invite @YourBot` in any private channel.

### Part 2 — Talk to people (DMs), not just channels

Slack DMs use the same `chat.postMessage` API, but the `channel` argument is a user-DM channel id (`D...`) opened via `conversations.open`. We'll add a person-picker alongside the existing channel picker.

Backend:

- New edge function `slack-resolve-user` (auth required): given an email or display name, calls `users.lookupByEmail` (preferred) then falls back to paginated `users.list`. Returns `{ slackUserId, displayName, imChannelId }` after calling `conversations.open` to get/create the DM channel id.
- Extend `slack-send` to accept `recipientType: "channel" | "user"` and `userEmail?` / `slackUserId?`. When `user`, the function calls `conversations.open` server-side to get the DM channel id, then posts there. The mirror row in `slack_messages` is stored with the DM channel id (which is fine — `slack-events` can also receive DMs).
- Extend `slack-events` to handle `channel_type === "im"` and store DM messages. We'll associate them via `slackUserId` rather than a deal — see schema below.

Database (new table) — for DM threads that aren't tied to a deal:

- `slack_dm_threads (id uuid pk, app_user_id uuid, slack_user_id text, im_channel_id text, last_message_at timestamptz, created_at timestamptz)` with RLS: only the owning `app_user_id` can read/write.
- `slack_messages` already has `channel_id` + `text` + `user_*` so we can keep using it for DM message rows. We'll add an optional `dm_thread_id uuid` column to link DM messages back to a thread row.

Frontend:

- `SlackChatBot` gains a tab toggle: **Channel | Person**.
- Person tab: searchable picker that resolves people from `staffing_people` (uses existing `email` / `slackUserId` fields when present, else calls `slack-resolve-user`). Selecting a person opens a thread view backed by `slack_dm_threads` + `slack_messages`.
- A new sidebar entry "Slack DMs" (under Home) lists open DM threads for the logged-in user with realtime unread counts.

### Required Slack scopes (user will need to reconnect / reinstall)

Add to the Slack app's bot token:

- `chat:write` (already have)
- `channels:history`, `groups:history` (so messages from channels reach Events API)
- `im:history`, `im:read`, `im:write` (DM send + receive)
- `users:read`, `users:read.email` (resolve people by email)

Event subscriptions to add: `message.channels`, `message.groups`, `message.im`.

### Files to change

- `supabase/functions/slack-events/index.ts` — logging, edits, DM channel handling.
- `supabase/functions/slack-send/index.ts` — `recipientType` + DM open flow.
- `supabase/functions/slack-resolve-user/index.ts` — new function.
- DB migration — new `slack_dm_threads` table + `slack_messages.dm_thread_id` column + RLS.
- `src/components/deals/SlackChatBot.tsx` — channel/person tabs, person picker.
- `src/components/slack/DmInbox.tsx` (new) — DM list + thread view, mounted on Home or as a route.
- `src/components/layout/AppSidebar.tsx` — "Slack DMs" entry.

### Open question

Anyone in the workspace, or only people who exist in `staffing_people`? Defaulting to **only `staffing_people**` keeps the UX scoped to your team and avoids leaking the entire workspace directory; `slackUserId`/`email` are already stored on those rows. If you need to DM external folks (clients on shared channels, etc.), say so and we'll widen the picker to a workspace-wide search.  
Keep it to everyone in the Home page and only in the Staffing  inistally but also a further option to anyone in the deals