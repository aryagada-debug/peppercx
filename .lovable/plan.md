## Goal

Two UI-only tweaks for the task dialog and a small audit footer for tasks in both Home and Clients & Deals.

## Change 1 — Task dialog header (Home → Tasks, Deal Detail → Tasks)

In `src/components/deals/TaskFormDialog.tsx`, replace the static "Edit Task" / "Create Task" `DialogTitle` text with an inline editable title field, and show the client + deal name as a read-only line below it.

- The current "Title *" input inside the body (around line 435) is removed; its value/onChange are wired into a new large-text input rendered inside `DialogHeader` instead.
- Directly under the title input, render the existing `headerSubtitle` (already passed as `Client: X · Deal: Y`) as small muted text. No edit affordance.
- Keep the same `title` prop API (used for screen-reader / aria), but visually hide the static label so the dialog still has an accessible name. Defaults still work for the Create flow (title input is empty with placeholder).
- No other field reordering.

This affects every caller of `TaskFormDialog` automatically:
- `src/pages/Home.tsx` (Home → My Tasks edit/create) — already passes `headerSubtitle`.
- `src/components/deals/TaskKanban.tsx` — already passes `headerSubtitle` via `dealMeta`.
- `src/components/deals/PhaseTasksView.tsx` — does not currently pass `headerSubtitle`. Pass it from the deal context (`account` + `dealName`) so the read-only line also shows on the Deal Detail → Tasks dialog.

## Change 2 — Created-at / Created-by audit footer

Add a small one-line muted footer to the bottom of `TaskFormDialog` (visible only when editing, i.e. when `initial` is provided):

```
Created by <name> · <DD MMM YYYY, HH:mm>
```

- New optional props on `TaskFormDialog`: `createdAt?: string | null`, `createdByName?: string | null`.
- Rendered just above the action row (Cancel / Save Changes).
- Formatted with `date-fns` (`format(parseISO(createdAt), "d MMM yyyy, HH:mm")`).
- If both values are missing, the footer is not rendered.

Wire data through callers:

- `src/pages/Home.tsx` — `loadTasks()` already selects `created_by_name`; extend the `deal_tasks` select to also include `created_at`, add both to the `DealTaskRow` interface, and pass them to `TaskFormDialog` when opening the edit dialog.
- `src/components/deals/TaskKanban.tsx` — extend `DealTask` interface with `createdAt?: string` and `createdByName?: string`, forward them into `TaskFormDialog` when editing.
- `src/components/deals/PhaseTasksView.tsx` — already gets tasks from `useDealDetail`; extend that hook's select + mapping for `deal_tasks` to include `created_at` and `created_by_name`, then forward them into `TaskFormDialog`.
- `src/hooks/useDealDetail.ts` — add `created_at` and `created_by_name` to the `deal_tasks` select, map onto the local task object as `createdAt` / `createdByName`.

No changes to `cx_tasks` paths (the user's request is scoped to Home + Clients & Deals deal-tasks dialogs; CX board uses a different dialog).

## Out of scope

- No DB migration — `created_at`, `created_by`, and `created_by_name` already exist on `deal_tasks` and `cx_tasks`.
- No changes to task cards / kanban tiles themselves — the audit log lives only inside the dialog.
- No changes to `CxTaskFormDialog`.
- No business-logic changes (filters, assignment rules, RLS).

## Files touched

- `src/components/deals/TaskFormDialog.tsx` — header restructure + audit footer + new props.
- `src/components/deals/TaskKanban.tsx` — extend `DealTask`, pass new props.
- `src/components/deals/PhaseTasksView.tsx` — pass `headerSubtitle`, `createdAt`, `createdByName`.
- `src/hooks/useDealDetail.ts` — include `created_at`, `created_by_name` in select + mapping.
- `src/pages/Home.tsx` — include `created_at` in select, pass `createdAt` / `createdByName` to the dialog.
