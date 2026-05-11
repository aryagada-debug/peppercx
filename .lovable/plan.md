## Goal

Improve Home → Tasks so tasks show their deal/client context, support multiple assignees, allow VSDs to view everyone's tasks (like Clients & Deals), and stay visible on Home + Deal Tasks even when assigned to someone else.

## Scope (4 changes)

### 1. Show deal + client name on task cards and in edit dialog (Home)
- In `src/components/deals/TaskKanban.tsx` (compact card render path used by Home), accept an optional `dealMeta?: Record<string, { dealName: string; account: string }>` prop. When present, render a small two-line context above the title: `<account> · <deal name>` in muted text. Clicking the chip navigates to `/deals/<dealId>?tab=tasks`.
- In `src/pages/Home.tsx`, build that map from the existing `deals` state and pass it to `TaskKanban`. Also append the context to the Edit dialog title (`Edit Task — <account> · <deal name>`).
- Deal-detail Tasks tab is unaffected (no `dealMeta` passed → no chip).

### 2. Show client + deal name in the Create-Task form (Home)
- `src/pages/Home.tsx` `AddTaskDialog`: once `dealId` is picked, the inner `TaskFormDialog` title already shows the deal name; extend it to `New Task — <account> · <deal name>` and add a small read-only context strip ("Client: X · Deal: Y") at the top of the dialog body so it's visible while scrolling.
- Implemented by passing an optional `headerSubtitle?: string` prop to `TaskFormDialog` rendered above the Title field. Default unchanged for existing callers.

### 3. Multiple assignees
- DB migration: add `assignees text[] not null default '{}'` to `deal_tasks` and `cx_tasks`. Keep existing `assignee text` as a denormalized "primary assignee" (first of `assignees`) for backward compatibility with existing filters/triggers/edge functions; backfill `assignees = ARRAY[assignee]` when assignee is non-empty.
- `TaskFormDialog.tsx`: replace the single `AssigneeCombobox` for the top-level Assignee field with a multi-select variant (chips + searchable popover, same staffed/other grouping). Subtask assignee stays single-select. `TaskData` gains `assignees: string[]`; `assignee` derived as `assignees[0] || ""` on submit.
- All write paths (`handleDealTaskSave`, `handleAddTaskSubmit`, `handleKanbanUpdate`, Deal-detail PhaseTasksView/TaskKanban) write both `assignees` and `assignee`.
- All read paths that filter by "mine" check membership against `assignees` (fallback to `assignee` if empty). This is the key fix for issue #4 below — a task assigned to multiple people will appear in every assignee's Home.

### 4. VSD "View everyone's tasks" filter + always-visible after assigning to others
- In `src/pages/Home.tsx`, add a filter control above the Tasks card matching the Clients page pattern: a `Select` "View tasks for" with three modes — `Me` (default), `Everyone` (admin or VSD only), or a specific person (searchable). Allowed when `isAdmin` or the user appears as a VSD on any `staffing_deals` row.
- The "mine" predicate becomes: `Me` → current aliases, `Everyone` → all, `<person>` → that person's aliases. Tasks list and KPI counts use this predicate.
- Fix the "task assigned to others disappears" bug independently of the filter: after creating a task, optimistically add it to local `dealTasks` if the creator is also a watcher (creator selected themselves in `assignees`) OR if the new task's deal is one of the creator's deals — show under a "Created by me" tab so they aren't lost. Concretely: add a `taskScope` tab `Mine | Created by me | Watching` next to the existing `taskFilter` (today/overdue/upcoming/all). "Created by me" reads from a new lightweight `deal_tasks.created_by_name text` column (added in the same migration, backfilled `''`) populated on insert.
- Deal-detail Tasks tab already shows all tasks for that deal, so once the task is written the assignee on another deal sees it there (issue #4 part b) — verified by the existing PhaseTasksView fetch which does not filter by assignee.

## Technical details

```text
deal_tasks
  + assignees     text[]   not null default '{}'
  + created_by    uuid     null               -- auth.uid() at insert
  + created_by_name text   not null default ''
cx_tasks
  + assignees     text[]   not null default '{}'
  + created_by    uuid     null
  + created_by_name text   not null default ''
```

Backfill:
```sql
update public.deal_tasks set assignees = array[assignee] where assignee <> '' and (assignees is null or array_length(assignees,1) is null);
update public.cx_tasks   set assignees = array[assignee] where assignee <> '' and (assignees is null or array_length(assignees,1) is null);
```

Files touched:
- `supabase/migrations/<ts>_task_multi_assignee.sql` (new)
- `src/components/deals/TaskFormDialog.tsx` — multi-select assignee, header subtitle prop
- `src/components/deals/TaskKanban.tsx` — render deal/client chip + multi-assignee avatars on cards
- `src/pages/Home.tsx` — VSD/everyone filter, taskScope tabs, dealMeta wiring, write `assignees`/`created_by_name`
- `src/components/deals/PhaseTasksView.tsx` — write/read `assignees`, render multi-assignee chips
- `src/hooks/useDealDetail.ts` — include `assignees` in select and updates

## Out of scope
- No changes to RLS (tables already have permissive policies).
- No change to RGY-task-generator edge function payload (it can keep writing `assignee`; trigger-free backfill handles `assignees`).
- No redesign of the Tasks card layout beyond the new chip + filter row.