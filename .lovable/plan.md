

# Tasks Tab — Click-to-Edit, Kanban View Toggle, Per-Task Auto-Regen

## What Changes

1. **Clicking a task row opens the TaskFormDialog** — Currently only the pencil icon opens it. The entire task row should open the edit dialog on click (same as Kanban behavior).

2. **Kanban view toggle** — Add a List/Kanban view switcher in the header. When "Kanban" is selected, render the existing `TaskKanban` component filtered to the current phase's tasks (or all tasks if "All" is selected). The Kanban retains full drag-and-drop functionality.

3. **Per-task auto-regenerate toggle** — Remove the global auto-regen toggle from the header. Instead, add an `auto_regen` boolean column to `deal_tasks`. Each task row shows a small refresh icon/toggle. When a task with `auto_regen = true` is marked "Done", a new copy is created. Default is `false`.

## Implementation

### Migration
```sql
ALTER TABLE deal_tasks ADD COLUMN auto_regen boolean NOT NULL DEFAULT false;
```

### Files Modified

| File | Change |
|------|--------|
| `src/components/deals/PhaseTasksView.tsx` | (1) Make task row clickable to open edit dialog. (2) Add List/Kanban toggle state + render `TaskKanban` when Kanban selected, passing filtered tasks. (3) Remove global `autoRegen` state; read `task.auto_regen` per-task instead. Add per-task regen toggle icon in row actions. |
| `src/components/deals/TaskKanban.tsx` | Accept optional `phase` filter prop so it can work within PhaseTasksView. Wire auto-regen on drag-to-Done using `task.auto_regen`. |
| `src/hooks/useDealDetail.ts` | Add `autoRegen` to `DealTask` interface and handle it in add/update. |
| `src/components/deals/TaskFormDialog.tsx` | Add `auto_regen` checkbox to the form. |

### Key Details

- **Row click**: Wrap the task row `<div>` with `onClick={() => setEditTask(task)}`, remove from pencil-only.
- **View toggle**: Two icon buttons (List, LayoutGrid) in header. State `viewMode: "list" | "kanban"`. When kanban, render `<TaskKanban tasks={visibleTasks} .../>`.
- **Per-task regen**: In the task row actions area, show a `RefreshCw` icon that toggles `auto_regen` via `onUpdate(task.id, { autoRegen: !task.autoRegen })`. In `handleStageChange`, check `task.auto_regen` instead of global toggle.

