## Goal

Slim down the RGY "Issue Tracker" popup so it reads as a single task to assign, instead of a form-plus-per-dimension task builder.

This dialog exists in two places with identical structure and both will be updated:
- `src/pages/DealDetail.tsx` (lines ~1421–1578)
- `src/pages/RGYHealth.tsx` (lines ~382–537)

## New layout (top → bottom)

1. **Issue Date** (date picker — kept)
2. **Status** (Open / In Progress / Resolved — kept)
3. **Issue Details** (textarea — kept)
4. **Action Plan** (textarea — kept; this is treated as the task description/title source)
5. **Assignees** (chip multi-select — moved here from the per-dimension card)
6. **Due Date** (date picker — replaces the old "Resolution Due Date" up top, now positioned under Assignees)
7. **Subtasks** (lightweight list: add row → text input + remove button; no urgency, no per-row assignees)

## Removed

- "Discussed Action Plan" field
- Standalone "Resolution Due Date" field at the top (its picker is reused as the new "Due Date" under Assignees)
- Entire "Tasks to Create" section (per-dimension cards with urgency, summary, and assignees)

## Submit behavior

`onSave` currently emits one task per non-green dimension. New behavior:
- Emit a **single task** built from the form:
  - `title`: Action Plan text (fallback to Issue Details if empty), prefixed with `[RGY Health]` to stay compatible with existing filters in `ResolveIssuesDialog.tsx` and the description parser in `DealDetail.tsx` (~line 2811).
  - `description`: `Issue Details: …\nAction Plan: …` (drop the `Discussed Action Plan:` line).
  - `assignees`: from the new top-level Assignees field.
  - `dueDate`: from the new Due Date field.
  - `subtasks`: array of `{ title }` items.
- The non-green-dimension Badges row at the top of the dialog stays (context only); it no longer drives task generation.
- `issueTasks` state and helpers (`addNewTask`, `removeTask`, `updateIssueTask`) are removed.

## Caller updates

`onSave` payload shape changes from `tasks: IssueTask[]` to a single `task: { title, assignees, dueDate, subtasks }`. Update the two call sites that consume it:
- `DealDetail.tsx` ~line 2330 (and ~2920) — replace the loop that inserts a `deal_tasks` row per dimension with a single insert + child `deal_subtasks` inserts.
- `RGYHealth.tsx` ~line 1051 — same change.

Subtask persistence uses the existing `deal_subtasks` table (already referenced by `TaskKanban.tsx` / `TaskFormDialog.tsx`); no schema migration required. If a subtask row insert ever fails, the parent task still saves.

## Out of scope

- No changes to how RGY Green-gating reads open issues/tasks (`ResolveIssuesDialog.tsx` keeps working because the `[RGY Health]` title prefix is preserved).
- No changes to the RGY history table columns or the "Action Plan" column there.
- No visual redesign beyond the field reordering above.
