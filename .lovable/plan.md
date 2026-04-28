
# BOPM Interface Revamp — Comprehensive Plan

Building a much sharper experience for BOPM persona (`role = "user"`), spanning Home, Clients, Staffing, RGY Health, and MBR Tracker. All changes scope to the BOPM's tagged + staffed deals and use the existing access-control + approval pipeline.

---

## 1. Home (merge with Portfolio Overview)

A single page with two sections in one scroll, divided by sticky sub-tabs at top: **Home** (tasks/notifications/quota/calendar) and **Portfolio overview** (KPIs, finance targets, RGY summary). Same route `/home`; the existing `/` (Dashboard) becomes a redirect to `/home?view=portfolio`.

### 1a. Quota panel
- Drop the **Quarterly** option. Period toggle becomes **Monthly · Annual** only.
- Auto-create a row in `user_quotas` (existing table) when none exists for the selected period so BOPM can set a target inline.
- Attainment % = `closedAmount / target_amount` (already computed); just relabel.

### 1b. Tasks summary card (top-right)
- The four tiles (Open / Due today / Overdue / Done this week) become buttons. Clicking each:
  - Scrolls to the My Tasks list and applies a filter chip (`status:open`, `due:today`, `overdue`, `done:this-week`).
  - Updates URL query param `?taskFilter=…` so it deep-links.

### 1c. Remove Quick Stats
- Delete the "Quick stats" block entirely (deals count / MRR mini cards). Portfolio overview already covers this.

### 1d. Notifications & mentions → 2 sub-tabs
Inside the existing notifications card, add a `Tabs` with:

- **Activity** — uses existing `user_notifications` table. New event types we'll start writing:
  - `client.assigned`, `client.removed`
  - `staffing.added`, `staffing.removed`, `staffing.pct_changed`
  - `rgy.update_reminder` (Monday 9 AM)
  - `mbr.schedule_due`, `mbr.summary_overdue`
  - `task.assigned`, `task.due_soon`
- **Slack mentions** — query `slack_messages` where `text ILIKE '%@<slack_user_id>%'` for the current user's `staffing_people.slack_user_id`. Show channel, snippet, timestamp, link to thread. Realtime via existing channel subscription.

---

## 2. Portfolio Overview section (rendered below Home tasks)

### 2a. Attainment %
- Tile recomputes against the **selected target type** (Annual / Monthly) coming from `user_quotas`, not just monthly MRR.

### 2b. Clickable target boxes (Invoicing / Delivery / Contraction / Receivables)
- Each tile in `FinanceTargetsCard` opens a dialog showing a table:
  
  | Deal ID | Deal Name | Account | Target Set | Achieved | % |
  
- Data source: `deal_financial_targets` joined with running `deal_financials` aggregates for the selected month.
- Scoped to BOPM's visible deals.

### 2c. RGY summary — replace with admin Insights table
- Reuse `RGYInsightsTab` (the table currently shown in admin RGY page). Drop the `vsdRollup` table.
- For BOPM persona, pre-filter to her visible deals before passing to the component (add an optional `dealIdScope?: Set<string>` prop).

---

## 3. Clients & Deals — bigger summary header

- Promote the top "Your deals" strip into a real header card (full-width):
  - Larger heading "Your deals" + subtitle with date range
  - Big stat cards in a 4-up grid: # Active Deals, Total MRR, Total TCV, # Clients
  - Add small split-bar showing deal status mix (Active / Disputed / New)
  - RGY mini-strip (counts of R / Y / G across her deals)
- Keep the existing table below; tighten its top-padding so the new header stands out.

---

## 4. Staffing & Capacity — table-first redesign

Replace the current matrix-only BOPM view with a clean two-table layout:

### Table A — "Your deals"
Rows: each deal she owns. Columns:

| Deal | Account | People staffed | Total weekly hrs | Bandwidth used (% of 160) | Revenue capacity handled |

- "People staffed" expands inline to show per-person rows.
- "Bandwidth used" = sum of weekly hours / 160 * 100 across all people on that deal, rolled up monthly. Color-coded green/amber/red using existing thresholds (60/85).
- "Revenue capacity" = pro-rated MRR/TCV per person allocation.

### Table B — "Your people" (when expanded)
Rows: each person staffed across her deals. Columns:

| Person | Role | Deals | Hrs/week | % bandwidth (160h) | Revenue handled |

- Hours per week pulled from `staffing_weekly_allocations` (current week).
- All cells stay editable — but in BOPM mode every save still routes through the existing approval pipeline (no change to gating logic).
- The current Matrix view is moved behind an "Advanced view" toggle for power users.

Drop `BopmStaffingSummary` (replaced by Table A's roll-ups).

---

## 5. RGY Health — BOPM insights

- Show the existing `RGYInsightsTab` to BOPM persona (currently admin-only). Pass her `visibleDealIds` so charts and rankings are scoped.
- Place it as the first sub-tab; matrix becomes second sub-tab.

### Stale-RGY flag
- Compute `last_rgy_update_at` per deal from `deal_rgy_weekly.created_at`.
- If now − last_update > 30 days, render an amber "Stale RGY" badge wherever a deal appears (RGY Health, Deal detail, Clients table, Home alerts).
- Centralized helper `getStaleRGY(dealId)` so all surfaces stay consistent.

### Auto-task: deals without an RGY entry
- Daily edge function `rgy-task-generator`:
  - For each Active deal with no `deal_rgy_weekly` row in last 7 days, find the responsible BOPM (deal.bopm/senior_bopm/principal_bopm).
  - Insert a `deal_tasks` row: `title="Update RGY status"`, `assignee=<bopm name>`, `phase="RGY"`, `urgency="High"`, `end_date=today+2`, `auto_regen=true`.
  - Also write a `user_notifications` row of type `rgy.update_reminder`.
  - Dedupe: skip if an open auto-gen RGY task exists for that deal+person.

---

## 6. MBR Tracker — auto nudges

Two new triggers, wired via a daily edge function `mbr-task-generator` (extends existing `mbr-reminders`):

1. **Scheduling pending** — deal Active for ≥ 30 days with no `mbr_entries.scheduled_date` for current month → create `deal_tasks` row "Schedule MBR" (auto-regen weekly until scheduled) + notification + Slack DM via existing slack-send.
2. **Update overdue** — `mbr_entries.scheduled_date` is in the past by > 24h AND `status != 'Done'` AND `notes` empty → create task "Update MBR notes/sentiment" + notification.

Both tasks dedupe on `deal_id + reminder_type` against `mbr_reminder_log`.

---

## Technical details

### Schema additions (migration)
- `user_recent_views (id, user_id, entity_type, entity_id, entity_name, viewed_at)` — referenced by Home but missing in DB. Add with RLS `auth.uid() = user_id`.
- `user_pins (id, user_id, entity_type, entity_id, entity_name, pinned_at)` — same pattern.
- New notification types: just text fields, no schema change.
- Add `notification_category text default 'activity'` to `user_notifications` so we can split Activity vs Slack-mentions counts cleanly.

### Files to create
- `src/pages/Home.tsx` — extend with sub-tabs + portfolio embed (or new `src/components/home/PortfolioSection.tsx` rendered inside).
- `src/components/home/TargetDrillDialog.tsx` — clickable finance-target dialog.
- `src/components/home/SlackMentionsTab.tsx` — mentions feed.
- `src/components/staffing/BopmDealTable.tsx` + `BopmPeopleTable.tsx` — new table-first views.
- `src/lib/staleRgy.ts` — stale-RGY helper.
- `supabase/functions/rgy-task-generator/index.ts`
- `supabase/functions/mbr-task-generator/index.ts`
- Cron rows (via insert tool) to trigger both functions daily 09:00 IST.

### Files to edit
- `src/App.tsx` — redirect `/` → `/home?view=portfolio`.
- `src/pages/Home.tsx` — sub-tabs, monthly/annual quota, clickable task tiles, remove quick stats, mentions tab.
- `src/pages/Index.tsx` — keep as embedded portfolio component (or delete after extraction).
- `src/pages/Clients.tsx` — bigger header card.
- `src/pages/Staffing.tsx` + `BopmStaffingSummary.tsx` — swap to new tables for BOPM.
- `src/pages/RGYHealth.tsx` — show `RGYInsightsTab` for BOPM with scoped IDs; add stale badges.
- `src/pages/MBRTracker.tsx` — surface new tasks/badges.
- `src/components/rgy/RGYInsightsTab.tsx` — accept optional `dealIdScope` prop.
- `src/components/dashboard/DealDrawer.tsx`, `src/components/rgy/DealDetailDialog.tsx` — render Stale-RGY badge.

### Approval pipeline
- All staffing edits in the new Bopm tables continue routing through `submitApprovalRequest`. No new approval types needed.

### Realtime
- Subscribe BOPM Home to `user_notifications` (already done), add subscription to `slack_messages` filtered server-side by user's `slack_user_id`.

---

## Out of scope (explicitly)
- No changes to admin-only views except adding the optional `dealIdScope` prop to `RGYInsightsTab`.
- No changes to the existing approval pipeline contract.
- No edits to `src/integrations/supabase/types.ts` (auto-regenerated).

