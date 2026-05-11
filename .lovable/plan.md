## 1. Wipe existing tasks

- Run a one-off SQL `DELETE FROM public.deal_tasks;` (≈44.3k rows) so every deal starts with an empty Tasks tab and falls into the "Customize & Seed Template" empty state.

## 2. Always-on "Seed from template" entry point

In `src/components/deals/PhaseTasksView.tsx`:

- Lift `templateEditorOpen` state (already present) and surface a **Seed from template** button in the Tasks-tab header next to **+ Add Task**, available whenever the user can view the tab.
- The button opens the existing `TemplateEditorDialog`, which already supports:
  - editing phases/tasks before seeding
  - loading any previously saved template
  - saving the current set as a new template (`task_templates` table)
- After seeding into a deal that already has tasks, the new tasks append (existing `onAddBulk` keeps current rows).

## 3. VSD / BOPM access

No permission gate currently blocks VSDs or BOPMs from the Tasks tab, from creating tasks, or from `task_templates` (RLS is open). No additional role checks are needed — once #1 + #2 ship, both roles can:

- seed the template into any deal
- add tasks per phase via the existing **+ Add Task** flow
- save / load / delete templates via the template editor dialog  
donot allow to delete the current template. Only the templated created by them. Allow them to seed particular phases. Allow them to create and delete and edit phases, create tasks within them and save it as template

## Technical notes

- Single SQL delete via the insert/data tool (no schema change).
- Pure frontend change in `PhaseTasksView.tsx` — add a header button mirroring the empty-state button; reuse the existing `TemplateEditorDialog` and `handleSeedFromEditor`.
- No changes to `DealDetail.tsx`, no new tables, no RLS changes.