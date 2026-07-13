## Audit findings

- **Cream City Mortgage is linked correctly in the app database**: deal `Cream City Mortgage / SEO/GEO + Content Mandate` points to channel `C0A7BHBTXJB` / `r-cream_city_mortgage-internal`.
- **There are currently zero stored messages for that channel** in the app database, so both the health rollup and AI insights are working from an empty local transcript.
- **Live Slack history calls from the current backend bot token fail for that channel**:
  - `slack-channel-history` returns `not_in_channel`.
  - `slack-health-rebuild` first sees `not_in_channel`, then tries to join the public channel, but the token is missing the Slack join permission, so it reports `missing_scope`.
- **The screenshot likely shows a different Slack app/bot than the one the backend token is using**, or Slack has not granted the backend bot membership/permissions for that channel. The app says “Lovable App has been added”, while the backend functions use the project’s `SLACK_BOT_TOKEN` directly, not an active Slack connector connection.
- **Slack events are not backfilling this either**: there are no recent `slack-events` logs, so historical messages only arrive through `conversations.history`, and that path is blocked by bot membership/scope.
- **The insight card is also cached** in `slack_channel_audits`, so once an empty audit is saved, it can continue showing “empty channel” until force-regenerated after messages are ingested.

## Root cause

The Slack Review does not read messages directly from the visible Slack UI. It reads from the app database. For Cream City Mortgage, the app database has no messages because the backend Slack token cannot read that channel’s history. The visible “Lovable App” membership in Slack is not currently enough proof that the exact backend bot token has both channel membership and the required history/join scopes.

## Fix plan

1. **Make Slack permission errors precise**
   - Update `slack-health-rebuild` so `not_in_channel` + failed auto-join is reported as:
     - “Backend Slack bot is not in this channel, or it is a different Slack app than the one added in Slack.”
   - If the auto-join call fails with `missing_scope`, report the missing `channels:join` / history permission separately instead of saying only “missing Slack scope to read history.”

2. **Add live verification for each linked channel**
   - Add a small backend check that calls Slack `conversations.info` and `conversations.history` for a channel and stores/display these diagnostic states:
     - bot can see channel metadata
     - bot is member of channel
     - bot can read history
     - last live Slack message timestamp, if accessible
   - Surface this in Slack Review so users can distinguish “no messages” from “bot cannot read messages.”

3. **Repair ingestion after permissions are fixed**
   - Once the correct backend Slack bot is invited/re-authorized, run the rebuild to backfill recent Slack history into `slack_messages`.
   - Ensure the rebuild updates `slack_channel_health` counts immediately after backfill.

4. **Prevent stale empty insights**
   - When `slack-health-rebuild` ingests messages for a deal that previously had a fallback/empty audit, mark that audit stale or force it to refresh on next open.
   - Update the Insights panel to show a warning when the audit is older than the latest Slack message rollup.

5. **Optional connector alignment**
   - If you want this to use the Lovable Slack connector instead of a custom `SLACK_BOT_TOKEN`, link/configure the Slack app connector and move the backend Slack calls through the connector gateway. That would avoid confusion between the visible “Lovable App” and the custom backend bot token.

## Expected outcome

- Cream City Mortgage will no longer misleadingly show “empty channel” when the real issue is access/membership/scope.
- After the correct bot/token can read the channel, the rebuild will ingest its messages and the Slack Review counts/insights will reflect the actual activity.