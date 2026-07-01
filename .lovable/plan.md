## Goal
Add a new **Slack Review** tab under `/rgy-health` that:
1. Lists every **active deal** with columns: Account, Deal, VSD, Sr/P BOPM, Slack channel status (Connected / Not connected), channel name if connected, last message date, 90-day message count.
2. Shows a **Slack Health dashboard** (KPIs, RGY donut, breakdown by VSD & Sr BOPM, per-customer expandable cards) modeled on the uploaded reference — using real Slack message data.

## Performance strategy (non-negotiable)
Slack history is expensive. We will **not** call Slack or scan `slack_messages` on page load. Instead:

- Create a cached rollup table `slack_channel_health` (one row per deal) with:
  `deal_id, channel_id, channel_name, is_connected, msg_count_90d, last_msg_at, first_msg_at, external_msg_count, internal_msg_count, avg_gap_hours, rgy, sentiment_summary, top_signals jsonb, computed_at`.
- A daily edge function `slack-health-rebuild` (cron 04:00 UTC) recomputes all rows in one pass:
  - Reads `slack_messages` grouped by `channel_id` filtered to trailing 90 days (single SQL aggregate — cheap).
  - Joins with `staffing_deals` (active only) + `slack_channels` cache for names.
  - Applies deterministic RGY rules first (dormant → Red, active+low volume → Yellow, healthy cadence → Green). Optional LLM enrichment (Lovable AI) for sentiment/signals in a bounded batch, cached until next rebuild.
- Frontend reads **only** `slack_channel_health` via a single indexed query (`SELECT ... WHERE is_active_deal`). No Slack API calls, no per-row fetches.
- Add index `slack_messages(channel_id, created_at DESC)` if missing to keep rebuild fast.
- Add a manual "Rebuild now" button (admin only) that invokes the same function.

## RGY rules (deterministic, cheap)
- **Red**: no channel linked, OR 0 messages in last 30d, OR only internal-source messages in last 45d.
- **Yellow**: active but msg_count_90d < median, or avg gap > 5 days, or last message 8-21 days old.
- **Green**: last message ≤ 7d, msg_count_90d ≥ 20, mix of external + internal sources.

## UI

### Tab 1: Channel Connection Table
Sortable/filterable table (reuse existing table primitives) over active deals:
| Account | Deal | VSD | Sr BOPM | Slack | Channel | Last msg | 90d msgs |
- "Slack" cell: green "Connected" pill or red "Not connected".
- Channel name links to open Slack via `slack://channel?...` (fallback web URL).
- Row click opens the same expandable health profile used below.

### Tab 2: Slack Health Dashboard
Structure mirrors reference HTML but rebuilt in React/Tailwind using our design tokens:
- KPI strip: Total active retainers, Red, Yellow, Green, Tracked channels, No-channel count.
- RGY donut + headline panel (auto-generated summary text from counts).
- Filters: RGY, VSD, coverage (Connected / Not connected), search.
- Expandable customer cards showing: channel(s), last activity, msg count, RGY reason, top signals.
- Pivot tables: **Health by VSD** and **Health by Senior BOPM** with MRR sum.

Both sub-views live inside a single `SlackReviewTab.tsx` with an inner segmented control (List / Dashboard).

## Files to touch

**New**
- Migration: `slack_channel_health` table + GRANT + RLS (admin/leadership read); helper SQL function `refresh_slack_channel_health()` doing the aggregation.
- `supabase/functions/slack-health-rebuild/index.ts` — calls the SQL function + optional LLM enrichment. Scheduled via `supabase/config.toml` cron.
- `src/components/rgy/SlackReviewTab.tsx` (with sub-components `SlackConnectionTable.tsx`, `SlackHealthDashboard.tsx`, `SlackCustomerCard.tsx`).
- `src/hooks/queries/useSlackHealthQuery.ts` — single query with 5-min staleTime.

**Modified**
- `src/pages/RGYHealth.tsx` — add `<TabsTrigger value="slack">Slack Review</TabsTrigger>` and `<TabsContent value="slack">`.

## Access
Admin, VSD, Capability lead, Sr/P BOPM only (reuse `useIsLeadershipViewer` / role gating already in RGY page).

## Out of scope
- Live Slack sentiment on demand (batch only).
- Historical trend charts beyond 90 days (can add later).

Confirm and I'll build.
