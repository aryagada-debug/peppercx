## Goal

1. Make the entire left sidebar collapsible (full ↔ icon-only mini rail), with the toggle persisted.
2. Add a new **Home** tab under **Core** that acts as a "plan-your-day" hub (ClickUp-style), unifying overdue/today tasks, meetings, flags, and a personal to-do tracker.

---

## Part 1 — Collapsible Sidebar

**File:** `src/components/layout/AppSidebar.tsx`, `src/components/layout/AppLayout.tsx`

- Add a `sidebarCollapsed` state lifted to `AppLayout` (persisted in `localStorage` under `pepper.sidebar.collapsed`).
- Sidebar widths: `w-60` expanded → `w-14` collapsed (icon-only mini rail; tooltips on hover for labels).
- Add a chevron toggle button in the sidebar header (next to "Pepper OS" logo) that flips the state. Also expose a small floating trigger in the top header so it remains reachable.
- When collapsed:
  - Hide section labels and item text; show icons only, centered.
  - Hide the bottom user card text (keep avatar circle).
  - Section group toggles collapse into a divider.
- Smooth `transition-all duration-200` on width.
- Wrap nav items in `Tooltip` (right-side) when collapsed.

---

## Part 2 — Home Tab (Daily Planner)

**Routing & Sidebar**

- Add route `/home` in `src/App.tsx` with `routeKey="home"`, before `/` (Dashboard stays at `/`).
- Add `Home` (lucide `Home` icon) as the **first item** under Core in `AppSidebar.tsx`, label "Home".
- Add `home` to default `route_visibility` for all roles via migration (visible by default).

**New page:** `src/pages/Home.tsx` (uses `AppLayout`)

Layout: 12-col grid, ClickUp-inspired, dense but airy.

**Top strip — "Good morning, {name}"**

- Greeting with current date and a small KPI row: Overdue (red), Due Today (amber), This Week (blue), Open Flags (red).

**Main grid:**

1. **My Tasks** (col-span 8) — Tabs: `Overdue` · `Today` · `Upcoming (7d)` · `Completed`.
  - Source: `deal_tasks` + `cx_tasks` filtered by `assignee = current user's display_name / email`.
  - Each row: checkbox to mark Done (updates `stage`/`status`), title, deal/space chip, due date, urgency pill, quick "Open" link to deal/space.
  - Drag-to-reorder within a day (updates `sort_order`).
2. **Today's Meetings & MBRs** (col-span 4)
  - MBRs scheduled today/this week from `mbr_entries.scheduled_date` for deals where the user is on the team.
  - Section for "Upcoming MBRs (next 7 days)".
  - Click → opens MBR detail dialog (reuse existing `MBRDetailDialog`).
3. **Flags & Alerts** (col-span 6)
  - Active RGY issues assigned to / owned by user from `deal_rgy_weekly` where `issue_status = 'Open'` and resolution_due_date ≤ today+7.
  - Slack inactivity flags from `slack_inactivity_nudges` (last 7 days) for deals user works on.
  - Each card shows deal name, flag type, severity, due date, "Resolve" link.
4. **Personal To-Do Tracker** (col-span 6)
  - Standalone personal list, **not** tied to deals — new table `personal_todos`.
  - Quick-add input (Enter to add). Inline edit, drag-reorder, check to complete, delete on hover.
  - Optional fields: due date, priority (Low/Med/High).
  - Filter chips: All · Active · Completed.
5. **My Allocation This Week** (col-span 12, slim strip)
  - Bar showing total % allocation for current week from `staffing_weekly_allocations` for the user's `staffing_person_id` (linked via `profiles.staffing_person_id`).
  - Color: green 60–85%, amber >85%, red <60% (per existing dashboard rules).

---

## Part 3 — Database

**New migration:**

```sql
-- Personal todos (per-user, not tied to deals)
create table public.personal_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null default '',
  notes text not null default '',
  done boolean not null default false,
  due_date date,
  priority text not null default 'Medium', -- Low | Medium | High
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.personal_todos enable row level security;

create policy "Users manage own todos select" on public.personal_todos
  for select to authenticated using (auth.uid() = user_id);
create policy "Users manage own todos insert" on public.personal_todos
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users manage own todos update" on public.personal_todos
  for update to authenticated using (auth.uid() = user_id);
create policy "Users manage own todos delete" on public.personal_todos
  for delete to authenticated using (auth.uid() = user_id);

create trigger personal_todos_updated_at
  before update on public.personal_todos
  for each row execute function public.update_updated_at_column();

-- Seed Home route visibility for every role
insert into public.route_visibility (role, route_key, visible)
select r, 'home', true
from unnest(array['admin','member','user','view_only']::app_role[]) r
on conflict do nothing;
```

---

## Part 4 — Hooks

- `src/hooks/useHomeData.ts` — composes:
  - `myTasks` from `deal_tasks` + `cx_tasks`, partitioned into overdue / today / upcoming / completed.
  - `myMeetings` from `mbr_entries` filtered by user's deals.
  - `myFlags` from `deal_rgy_weekly` + `slack_inactivity_nudges`.
  - `myAllocation` from `staffing_weekly_allocations` joined via `profiles.staffing_person_id`.
- `src/hooks/usePersonalTodos.ts` — CRUD + realtime subscription on `personal_todos`.

User identity: derive `displayName` from `profiles` row + `staffing_person_id` to match `assignee` strings on deal/cx tasks.

---

## Files Touched

- `src/App.tsx` (add `/home` route)
- `src/components/layout/AppSidebar.tsx` (collapse + Home item)
- `src/components/layout/AppLayout.tsx` (collapse state + header trigger)
- `src/pages/Home.tsx` *(new)*
- `src/hooks/useHomeData.ts` *(new)*
- `src/hooks/usePersonalTodos.ts` *(new)*
- `src/hooks/useUserRole.ts` (include `home` in default visible set)
- `supabase/migrations/...sql` *(new)*

---

## Open suggestions (additive, not in v1 unless you want)

- Pin tasks to the top.
- "Focus mode" timer per task (Pomodoro).
- Weekly digest email of overdue items.
- Drag tasks from "Upcoming" → "Today" to re-schedule (updates `start_date`).

Tell me if you want any of those folded into v1 or to drop one of the 5 home modules.  
1. Weekly digest  
2. Financial summary of their projects   
3. RGY - Red accounts - highlisht it somehow