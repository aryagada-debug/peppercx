# Enhanced Task Board — Drag & Drop, Rich Text, Subtasks, Ideal Hours

## Summary

Upgrade the Task Kanban board to match the reference screenshot: add HTML5 drag-and-drop between columns, rich text description editing (bold, italic, bullets, checklists), subtask support, ideal/estimated hours field, and improved log-hours UX.

## Changes

### 1. Install `@dnd-kit` for drag-and-drop

Install `@dnd-kit/core` and `@dnd-kit/sortable` — lightweight, accessible, and React-native. No heavy dependencies like `react-beautiful-dnd`.

### 2. Extend `DealTask` interface (`src/components/deals/TaskKanban.tsx`)

Add new fields to the `DealTask` interface:

- `estimatedHours: number` — ideal/budgeted hours set at creation
- `subtasks: SubTask[]` — array of `{ id, title, completed, assignee?, description? }`
- `parentTaskId?: string` — if this task is a subtask (for flat storage alternative)

### 3. Rich Text Description (`src/components/deals/TaskFormDialog.tsx`)

Replace the plain `<Textarea>` with a mini toolbar + contentEditable div or a lightweight approach:

- Toolbar buttons: **Bold** (B), *Italic* (I), Bullet list, Checklist
- Store description as HTML string
- Use `document.execCommand` for formatting (simple, no extra library needed)
- Render description in task cards using `dangerouslySetInnerHTML` with sanitization  
Should also have the option to add url

### 4. Add Estimated Hours field (`src/components/deals/TaskFormDialog.tsx`)

- Add "Estimated Hours" numeric input alongside the date fields
- Display on task cards as `{loggedHours}/{estimatedHours}h` with a small progress bar
- Add to `TaskData` interface

### 5. Log Hours improvements (`src/components/deals/TaskFormDialog.tsx`)

- In the edit dialog, show logged hours with a "+ Log" button that adds to the cumulative total
- Show estimated vs logged comparison

### 6. Subtasks (`src/components/deals/TaskFormDialog.tsx`)

- Add a "Subtasks" section in the edit/create dialog
- Each subtask has: title, assignee (dropdown), status checkbox, description (same rich text)
- "+ Add subtask" button appends to the list
- Subtasks are stored as part of the parent task object (JSON array)
- Subtask cards shown nested under the parent in the Kanban column (indented, smaller)

### 7. Drag & Drop Kanban (`src/components/deals/TaskKanban.tsx`)

- Wrap board in `<DndContext>` from `@dnd-kit/core`
- Each column is a `useDroppable` zone
- Each task card is `useDraggable`
- On `onDragEnd`, call `onUpdate(taskId, { stage: newStage })` to move the task
- Add visual feedback: drop zone highlight, dragging card opacity
- Remove the hover-based "move to stage" buttons (drag replaces them)

### 8. Update `useDealDetail.ts`

- Extend `addTask` to include `estimatedHours` and `subtasks` fields
- Extend `updateTask` to handle subtask updates

### 9. Task card layout update (`TaskKanban.tsx`)

Match the reference screenshot:

- Card shows: title, description preview, category badge (from task tags/labels), assignee name, due date, urgency badge
- Cleaner layout with category color coding
- "+ Add task" button at bottom of each column  
  
10. Add an attachthment option for any type of attachments like PPT, PDF, Word, Etc

## Files Modified


| File                                      | Change                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `package.json`                            | Add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`                                          |
| `src/components/deals/TaskKanban.tsx`     | DndContext wrapping, draggable cards, droppable columns, extended DealTask interface, subtask rendering |
| `src/components/deals/TaskFormDialog.tsx` | Rich text toolbar, estimated hours input, subtasks section, log hours in edit mode                      |
| `src/hooks/useDealDetail.ts`              | Extended task fields (estimatedHours, subtasks)                                                         |
