## Link a Slack channel from the Slack Review table

Today the Channel column just renders a dash when no channel is linked. Add an inline "Link channel" affordance in the same cell so admins can pair a Slack channel with a deal without leaving the page.

### Behaviour
- When `channel_id` is empty → render a small "Link channel" button in place of the dash.
- Click opens a compact popover with:
  - Search input (client-side substring filter over channel names).
  - Virtual-friendly scroll list of channels from `loadSlackChannels()` (public + private the bot can see).
  - Loading / error state matching the existing `SlackChatBot` picker copy.
- Selecting a channel:
  - `UPDATE staffing_deals SET slack_channel_id = ch.id WHERE id = deal_id`.
  - Optimistically patch the row (`channel_id`, `channel_name`, `is_connected: true`) in the React Query cache for `["slack-health"]`.
  - Toast success, close popover.
  - Trigger the same `slack-health-rebuild` invocation used by the "Rebuild now" button in the background so message counts populate.
- When `channel_id` is already set → keep the current `#channel` link, and add a subtle "Change" affordance next to it that reopens the same picker (also allows unlink via a "Remove link" row at the top of the list, mirroring `SlackChatBot`).

### Access
- Only show the link/change controls for users where `useUserRole().isAdmin` is true, matching the existing rebuild-only-admin pattern. Non-admins keep the read-only view.

### Implementation notes
- New component `SlackChannelLinkCell` (co-located inside `SlackReviewTab.tsx` to keep it scoped) using `shadcn` `Popover` + `Command` for search — same primitives already used in `SlackChatBot`.
- Reuse `loadSlackChannels()` from `src/lib/slackChannels.ts` (already cached / dedupes in-flight).
- After a successful update, invalidate `["slack-health"]` (or use `setQueryData` for immediate feedback) plus fire-and-forget `supabase.functions.invoke("slack-health-rebuild")`.
- No schema changes, no new edge functions.

Files touched:
- `src/components/rgy/SlackReviewTab.tsx` (add cell + popover, wire mutation).
