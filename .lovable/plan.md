## Goal
Give admins a single tab to see **who is logging in**, **who is actively working on the platform**, and **who is dormant / never logged in** — so the team can drive adoption.

## Where it lives
New tab in `Settings` → **"Usage"** (admin-only), next to Users & Roles / Access Controls. Route: `/settings` with `?tab=usage`.

## Data sources (no new schema required for v1)
1. **Auth signals** (via existing `admin-user-mgmt` edge function, extended):
   - `auth.admin.listUsers()` already returns `last_sign_in_at`, `created_at`, `email_confirmed_at`. Extend the `list` action to return these fields.
2. **Expected users** = `staffing_people` where `leaving=false` and `tbh=false`. Join by email against auth users to derive:
   - **Never invited** — in staffing_people but no auth account.
   - **Invited, never signed in** — auth account exists, `last_sign_in_at IS NULL`.
   - **Dormant** — `last_sign_in_at` older than 14 / 30 days.
3. **Work activity** (per user, last 30 days, derived client-side from existing tables):
   - `deal_tasks` updates (`created_by`, assignees)
   - `deal_rgy_weekly` + `deal_rgy_notes` (`updated_by`)
   - `personal_todos` (`user_id`, `assigned_by_user_id`)
   - `slack_messages` (`sent_by_app_user`)
   - `mbr_entries` (`updated_by` text field, best-effort)
   - `approval_requests` (`requested_by`)
   Aggregate count of writes per user over the period.

## UI layout (`src/pages/admin/UsageTab.tsx`)
- **KPI strip (6 tiles):** Total expected users · Provisioned · Active 7d · Active 30d · Dormant 30d+ · Never signed in.
- **Adoption funnel bar:** Expected → Provisioned → Signed in once → Active 30d → Active 7d.
- **Logins over time (last 60 days):** simple Recharts area chart of distinct daily sign-ins (bucketed from `last_sign_in_at`; v1 shows current snapshot only — note in section copy that historical daily login series requires audit logs and will land later).
- **Users table** with columns: Name · Email · Role · Pod/Region (from staffing_people) · First login · Last login · Days since last login · Writes (30d) · Status pill (Active / Dormant / Never signed in / Not provisioned). Sortable, searchable, filter by status + role + region.
- **"Never signed in" panel:** quick list with one-click "Resend invite" (calls existing `admin-user-mgmt` `invite` action if present; otherwise a copy-email button).
- **"Dormant" panel:** top 20 by days-since-login with Slack-DM nudge button (uses existing `slack_dm_threads` infra if available; otherwise copy mailto).

## Edge function changes (`supabase/functions/admin-user-mgmt/index.ts`)
- Extend the `list` response to include `last_sign_in_at`, `email_confirmed_at`.
- Add new action `usage_summary` that returns the joined per-user usage snapshot server-side (to avoid pulling all rows to the client). Admin-gated as today.

## Files
**New**
- `src/pages/admin/UsageTab.tsx` — page shell, KPIs, charts, tables.
- `src/components/admin/usage/UsageKpiStrip.tsx`
- `src/components/admin/usage/UsersUsageTable.tsx`
- `src/components/admin/usage/AdoptionFunnel.tsx`
- `src/lib/usageAnalytics.ts` — pure helpers: classify status, bucket activity, aggregate writes per user.

**Edited**
- `src/pages/Settings.tsx` — add "Usage" tab (admin only) and render `<UsageTab/>`.
- `supabase/functions/admin-user-mgmt/index.ts` — return `last_sign_in_at`; add `usage_summary` action.

## Out of scope (v1)
- True page-view / session analytics (requires a `user_activity_events` table + client beacon — propose as Phase 2 if you want per-page heatmap).
- Historical daily login time-series before today (needs auth audit log ingestion).
- Per-feature usage breakdown beyond the write-count rollup above.

## Phase 2 (only if you want it — say the word)
Add `public.user_activity_events (user_id, route_key, occurred_at)` + a tiny `usePageActivityBeacon()` hook fired on route change (throttled to 1/min). Unlocks: daily active users chart, per-module adoption, time-on-platform.
