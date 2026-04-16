

# Central Cx Tasks — Match Deal Tasks Functionality

## What Changes

Upgrade Central Cx tasks to have full feature parity with deal tasks (from Clients & Deals):

1. **Rich text description** — replace plain textarea with the same toolbar editor (bold, italic, lists, links)
2. **Subtasks** — add/remove subtasks with checkbox, assignee, and expandable description
3. **Hours tracking** — estimated hours, logged hours, progress bar on cards
4. **Urgency levels** — Low / Medium / High / Critical (matching deal tasks, replacing current None/Low/Normal/High/Urgent)
5. **Auto-regenerate** — checkbox to auto-recreate task when marked Done
6. **Drag-and-drop** — @dnd-kit on board view for moving tasks between columns
7. **Enhanced card UI** — show urgency badge, subtask count, hours progress bar, description preview (matching deal task cards)

## Database Migration

```sql
ALTER TABLE cx_tasks ADD COLUMN estimated_hours numeric NOT NULL DEFAULT 0;
ALTER TABLE cx_tasks ADD COLUMN logged_hours numeric NOT NULL DEFAULT 0;
ALTER TABLE cx_tasks ADD COLUMN subtasks jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE cx_tasks ADD COLUMN urgency text NOT NULL DEFAULT 'Medium';
ALTER TABLE cx_tasks ADD COLUMN auto_regen boolean NOT NULL DEFAULT false;
```

## Files Modified

| File | Change |
|------|--------|
| `src/pages/CentralCx.tsx` | Extend `CxTask` interface with new fields. Update `addTask`/`updateTask` to handle new columns. |
| `src/components/cx/CxTaskFormDialog.tsx` | Full rewrite — import and reuse the rich text editor and subtask components from `TaskFormDialog`. Add stages (from space statuses), urgency selector, estimated hours, logged hours display, subtasks section, auto-regen checkbox. |
| `src/components/cx/CxBoardView.tsx` | Add @dnd-kit drag-and-drop (DndContext, DragOverlay, useDroppable, useSortable). Enhance card UI with urgency badge, subtask count, hours progress bar, description preview — matching `TaskKanban` card style. |
| `src/components/cx/CxListView.tsx` | Add urgency and hours columns to the table. |
| `src/components/cx/CxOverview.tsx` | Show hours summary stats if available. |

### Key Details

- The `CxTaskFormDialog` will replicate `TaskFormDialog`'s layout: rich text editor, stage + urgency row, assignee, dates + estimated hours row, logged hours display, auto-regen checkbox, subtasks section with add/delete/expand
- Board view cards will match `DraggableTaskCard` from `TaskKanban`: urgency initial badge, title, description preview, subtask count, hours progress bar, assignee + date footer
- DnD uses same pattern: `PointerSensor` with 5px distance, `useDroppable` per column, `useSortable` per card, `DragOverlay` for ghost

