## Goal

In the Template Editor, upgrade each task row so users can assign either a **role** or a **specific person** (grouped by designation), and replace the relative "Day N → Day N" integers with real **Due date** and **End date** pickers.

## Changes

### 1. Assignee picker (replaces the free-text "Assignee" input)

Replace the small text input on each task with a single combobox-style popover trigger that shows the current assignment as a chip ("Senior BOPM" role, or "Priya S. — BOPM" person).

The popover content has two tabs:

- **Role** — list of canonical roles already used in templates (VSD, Senior BOPM, BOPM, SEO Lead, Content Lead, etc.) plus a "Custom role…" free-text option. Picking a role stores it on `assigneeRole` (existing field) and clears `assigneeUserId`.
- **People** — searchable list of users from `staffing_people` (active, non-TBH), **grouped by `designation`** with collapsible group headers. Picking a person stores their id + name on new fields and clears `assigneeRole`.

Ordering inside the People tab:
1. **Already assigned on this deal** (matched against the deal's staffing roster) — pinned section at the top labeled "On this deal".
2. **Everyone else** — grouped by designation, alphabetical inside each group.

A search box at the top filters across both sections by name/email/designation.

### 2. Due date + End date pickers (replace Day N → Day N)

Remove the "Day [start] → [end]" integer chip. Add two date-picker chips side by side:

- **Due date** (start) — calendar icon + formatted date, click to open `CxDatePickerPopover` (already in the codebase, supports quick options + calendar + clear).
- **End date** — same pattern, validated to be ≥ due date (toast warning otherwise).

Both are optional. Empty state shows "Set due / Set end".

### 3. Data model

`PhaseTemplate.tasks[]` gains:

```ts
assigneeUserId?: string | null;   // staffing_people.id when a person is picked
assigneeUserName?: string | null; // denormalized for display + offline reuse
dueDate?: string | null;          // ISO YYYY-MM-DD
endDate?: string | null;          // ISO YYYY-MM-DD
```

`dayStart` / `dayEnd` are removed from the editor UI but kept in the type as deprecated optionals so existing saved templates (`task_templates.phases` JSON) don't break — they're ignored when rendering. New templates only write the date fields.

### 4. Seeding into real tasks

`onSeed(...)` already turns template tasks into `DealTask` rows. The seeding helper is updated so:

- `assigneeUserId` → `deal_tasks.assignee_user_id` (or whichever existing column is used today; we'll match what TaskKanban already writes for the Task Form's assignee).
- `assigneeRole` continues to seed as today when no user is set.
- `dueDate` → `deal_tasks.due_date`, `endDate` → `deal_tasks.end_date` (replacing the day-offset calculation that currently derives dates from `dayStart`/`dayEnd`).

If only `assigneeRole` is set (no user), seeded tasks remain role-stub assignments — same as today.

## Technical Notes

- Add a small hook `useStaffingPeopleByDesignation()` (or extend `useAppUsers`) that returns `{ designation: string; people: { id, name, email, designation }[] }[]` sorted by designation, plus a `Set<string>` of staffing_people ids already on this deal (looked up via existing `useWeeklyStaffing` / staffing roster for the current deal id).
- Pass the current `dealId` into `TemplateEditorDialog` and `<PhaseTasksView>` so the "On this deal" section can be computed. When the editor is opened outside a deal context, the section is hidden.
- Use existing `Popover` + `Command` (`@/components/ui/command`) for the assignee picker — same pattern as `CxAssigneePopover`.
- Reuse `CxDatePickerPopover` for both date chips.
- No DB migration needed: `task_templates.phases` is JSON, so the new task fields just slot in.
- Saved-template backward compatibility: when loading a legacy template that has `dayStart`/`dayEnd`, leave those values untouched but don't render them; user can set dates if desired.

## Out of scope

- Changing the public `ONBOARDING_PHASES` seed data (still has `assigneeRole` only — that's fine, picker shows it as role).
- The Kanban task form (`TaskFormDialog`) — already has assignee + dates.
- Notifications for newly assigned users on seed.
