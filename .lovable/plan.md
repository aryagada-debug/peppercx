## Goal
Make the Pulse / NPS page feel populated and fast on load, without fetching everything at once.

## What's there today
- Deals: fetched all at once (active + closed, no user scoping).
- Stakeholders: only fetched after a deal is picked.
- Invites: last 50, no per-deal aggregates.
- No NPS/CSAT score summary.

## Plan

### 1. Smarter deals query (left panel)
- Server-side scope to **active** deals only: `deal_status in ('Active Deal','New Deal in SLA/PO','Deal Disputed','Deal in Renewal Process')`.
- Respect user visibility via `visible_deal_ids_for_user(auth.uid())` (admins still get all).
- Order by `account, deal_name`; cap at 500.
- Keep current columns; add `deal_status` for a small badge.

### 2. Per-deal "populated" preview (without preloading stakeholders for every deal)
- New lightweight query: count of stakeholders per visible deal and count of invites/completed per visible deal, returned in two grouped queries:
  - `deal_stakeholders` grouped by `deal_id`/`client_name` → `contacts` count.
  - `survey_invites` grouped by `deal_id` → `sent`, `completed`, `last_sent_at`.
- Show next to each deal row: `5 contacts · 2 sent · 1 completed`.
- Both queries run once on mount (cheap aggregates), cached 60s.

### 3. Lazy stakeholder fetch (unchanged, but improved)
- Keep fetching stakeholders only for selected deals.
- Prefetch on hover of a deal row using `queryClient.prefetchQuery` so picking feels instant.
- Auto-select all valid stakeholder emails by default once a deal is opened (user can uncheck).

### 4. Recent invites: paginated + summary
- Top of section: small stat strip — `Sent (30d)`, `Opened`, `Completed`, `Avg NPS`, `Avg CSAT` — computed from `survey_invites` + `survey_responses` (single grouped query, 30-day window).
- Table: keep last 50 with a "Load more" button (offset pagination, 50 at a time).
- Add a filter by deal (chip) and status (sent/failed/completed).

### 5. Response data (new)
- Join `survey_responses` (nps, csat) to invites on `invite_id` for the listed rows only — one query keyed by current page's invite IDs.
- Show NPS and CSAT columns in the Recent invites table.

## Technical notes
- All new queries via `useQuery` with `staleTime: 60_000`; aggregates use `.select('deal_id, count:id.count()', { head: false })` style grouping or RPCs if grouping isn't supported by PostgREST for the columns we need.
- No schema changes required. No new tables. No new edge functions.
- Visibility uses existing `visible_deal_ids_for_user` RPC; we call it once and `in.()` filter the deals query.
- Pure frontend change in `src/pages/PulseNPS.tsx` and `src/components/rgy/PulseSurveyTab.tsx`.
