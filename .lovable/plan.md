## Goal
Home tabs (Overdue / Today / Upcoming) become a true working surface for the user's deal & CX tasks. Every change made on Home writes straight into the same `deal_tasks` / `cx_tasks` rows used by Clients & Deals — and any change made elsewhere appears on Home in realtime.

## Scope of two-way sync

| Where | Current | After |
|---|---|---|
| Mark complete | ✅ writes back | ✅ unchanged |
| Change stage / status | ❌ | ✅ inline dropdown |
| Reschedule due date | ❌ | ✅ inline date popover |
| Change urgency | ❌ | ✅ inline select |
| Edit title, dates, subtasks, assignee, tags, hours | ❌ | ✅ click row → opens existing `TaskFormDialog` (deal tasks) / a CX equivalent |
| Updates from Clients & Deals appear on Home | ❌ requires reload | ✅ realtime |
| Personal to-dos | ✅ already in own table | ✅ realtime added |

## 1. Better assignment matching (so the right tasks actually appear)
Right now Home matches assignee strictly by `ilike(displayName)`. That misses people whose `staffing_people.name` differs from their auth `display_name`.

- Use `profiles.staffing_person_id` to look up the canonical `staffing_people.name`.
- Query `deal_tasks` / `cx_tasks` with `assignee.in.(displayName, staffingName, email)`.
- Falls back gracefully if `staffing_person_id` is null.

## 2. Inline quick-edit row (Home)
Replace the read-only row in `TaskList` with a compact editor:
- **Checkbox** → toggles stage to `Done` (deal) or status to `Done` (cx). Already works.
- **Stage/Status pill** → small `Select` with the 5 deal stages or the space's `cx_statuses`.
- **Due date pill** → `Popover` + `Calendar`; writes `end_date`.
- **Urgency badge** → `Select` of Low/Medium/High/Critical.
- **Row click** → opens the full edit dialog (see §3).
- **External-link icon** → still jumps to the deal/CX page (preserved).

All writes go through tiny helpers (`updateDealTask(id, patch)`, `updateCxTask(id, patch)`) that do a single `supabase.from(...).update(patch).eq("id", id)` and optimistically update local state, with toast + rollback on error.

## 3. Full edit dialog
- **Deal tasks**: reuse the existing `src/components/deals/TaskFormDialog.tsx` directly. Home will fetch the deal's staffed assignees + the wider people list (same shape `DealDetail.tsx` already passes) on demand when the dialog opens, so the searchable assignee combobox works identically.
- **CX tasks**: reuse `src/components/cx/CxTaskFormDialog.tsx` (already exists for Central Cx).
- After save, the realtime channel (§4) will push the change back into Home automatically — no manual refetch needed.

## 4. Realtime subscriptions
Add a single `useEffect` in `Home.tsx` that opens one Supabase channel with three postgres_changes listeners — all scoped client-side to the current user:

```ts
supabase.channel("home-sync")
  .on("postgres_changes", { event: "*", schema: "public", table: "deal_tasks" },
      (p) => applyDealTaskChange(p))
  .on("postgres_changes", { event: "*", schema: "public", table: "cx_tasks" },
      (p) => applyCxTaskChange(p))
  .on("postgres_changes", { event: "*", schema: "public", table: "personal_todos",
      filter: `user_id=eq.${user.id}` },
      (p) => applyTodoChange(p))
  .subscribe();
```

`applyDealTaskChange` / `applyCxTaskChange` handle INSERT/UPDATE/DELETE and re-check whether the row's `assignee` matches the current user before adding/keeping it in state — so we react correctly when someone is reassigned to or off a task.

A migration enables realtime publication for the three tables (idempotent):
```sql
alter publication supabase_realtime add table public.deal_tasks;
alter publication supabase_realtime add table public.cx_tasks;
alter publication supabase_realtime add table public.personal_todos;
```
(Wrapped in a `do $$ ... exception when duplicate_object then null; end $$;` block so re-runs are safe.)

## 5. Small UX upgrades that come along
- **Empty buckets** show a "Browse all my tasks" link to `/deals` filtered to my name.
- **Overdue + Today counters** in the KPI strip update live from realtime state.
- **Personal to-do**: due-date picker + priority picker added inline (currently the schema supports them but the UI doesn't expose them).

## Files touched
- `src/pages/Home.tsx` — the bulk of the work (assignee resolution, inline editor, dialog hookup, realtime channel, todo enhancements).
- `src/components/deals/TaskFormDialog.tsx` — no behavior change; just imported from Home.
- `src/components/cx/CxTaskFormDialog.tsx` — same; imported as-is.
- `supabase/migrations/<timestamp>_home_realtime.sql` — enable realtime publication for the 3 tables.

## Out of scope (intentionally)
- Meetings & Flags stay read-only links to their owning tabs (MBR, RGY Health) — they're already the source of truth there; editing from Home would duplicate complex forms.
- No new tables or RLS changes; existing permissive policies on `deal_tasks` / `cx_tasks` already allow the writes.