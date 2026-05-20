# Slack Health — Live Data

Replace the fully-mocked `SlackHealth.tsx` with a real view over every Slack channel currently linked to a deal, and compute the health metrics on the fly from `slack_messages` + staffing data.

## Source of channels

A "connected channel" = any `staffing_deals` row where `slack_channel_id` is non-empty. That field is set when a deal owner links a Slack channel from the deal page, so it already represents the union of channels users have connected.

For each such row we already have: `id`, `deal_name`, `slack_channel_id`, `slack_channel_name` (if missing in schema we fall back to fetching via `conversations.info`), `deal_status`.

## Health metrics (same 5 columns as today)

Computed per deal/channel for the last 7 days, all from existing tables — no extra Slack API calls per render:

| Column | Source | Formula |
|---|---|---|
| Staff Match | `staffing_assignments` for the deal vs `slack_messages.user_id` distinct senders in 7d | `matched / expected` (expected = active assignees, matched = those who posted ≥1 msg) |
| Daily (7d) | `slack_messages` grouped by day | count of distinct days with ≥1 team message (max 5, weekdays only) |
| Weekly Internal | `slack_messages` where sender is in our staffing list | clamp(count, 0, 4) |
| Weekly Customer | `slack_messages` where sender is **not** in staffing list (external) | clamp(count, 0, 4) |
| Score | weighted blend | `round(staffMatch*25 + daily*10 + wkInt*10 + wkCust*15)` capped 0–100 |

Top metric cards (Avg Health, Well Run ≥75, Needs Attention 50–74, Critical <50) are derived from the same array.

## Implementation

1. **Edge function `slack-health-snapshot`** (new): runs server-side with service role, returns `{ channels: [{ channel_id, channel_name, deal_id, deal_name, score, staffMatch, daily, wkInt, wkCust }] }`. One query joins `staffing_deals` + `staffing_assignments` + aggregates over `slack_messages` for the last 7 days. Cached for 5 min in-memory.
2. **Hook `useSlackHealth`** (new, `src/hooks/queries/`): React Query wrapper invoking that function.
3. **`src/pages/SlackHealth.tsx`**: remove mock array, render rows from the hook, keep the existing table + `ScoreBadge` + metric cards UI exactly. Add empty state ("No Slack channels connected yet") and loading skeleton. Channel name renders as a link that opens `slack://channel?team=...&id=...` (fallback to web).
4. No schema migration needed — all required tables exist (`staffing_deals`, `staffing_assignments`, `slack_messages`, `staffing_people`).

## Out of scope

- Adding a "connect channel" flow from this page (already done on deal detail).
- Persisting historical health scores / trend lines.
- Backfilling messages for channels the bot was just invited to.

## Files

- New: `supabase/functions/slack-health-snapshot/index.ts`
- New: `src/hooks/queries/useSlackHealth.ts`
- Edit: `src/pages/SlackHealth.tsx`
