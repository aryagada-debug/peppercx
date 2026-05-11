## 1. Compulsory phases for auto-generated tasks

Today the RGY and MBR generators leave `phase` empty, so those tasks fall into a synthetic "General" bucket. Replace with two dedicated, **always-present phases** that every deal gets in its phase rail:

- **RGY Issues** — receives tasks created by `rgy-task-generator` and the resolve-issues flow.
- **MBR** — receives tasks created by `mbr-task-generator`.

Changes:
- In `PhaseTasksView.tsx`: add `RGY Issues` and `MBR` to the in-memory phase list (after the onboarding phases). They are always rendered in the left rail with their task counts, even when empty. Tasks whose `phase` is missing/empty continue to fall back to "General" so legacy ad-hoc rows stay visible, but new auto-tasks land in the right phase.
- In `supabase/functions/rgy-task-generator/index.ts` and `supabase/functions/mbr-task-generator/index.ts`: set `phase: "RGY Issues"` / `phase: "MBR"` on the inserted `deal_tasks` rows.
- In any frontend code that creates RGY/MBR follow-up tasks (e.g. `ResolveIssuesDialog`, MBR action items): pass the matching `phase` value.
- These two phases are excluded from `ONBOARDING_PHASES` so they're **not** included when seeding from a template — they're populated only by the auto-generators.

## 2. Template Editor — match the attached UI + multi-phase selection

Rebuild the editor body in `TemplateEditorDialog` (inside `PhaseTasksView.tsx`) to match the screenshot:

### Left "Phases" panel
- Header: "PHASES" label + purple round **+** button to add a phase.
- **Search phases** input below the header (filters the phase list by name).
- Phase rows show: drag handle, colored dot (cycled palette per phase), phase name, task-count badge on the right.
- Active phase row gets a left purple border and light-purple fill (current style is fine; just tighten spacing).
- New: a **checkbox** appears on each row on hover or when any row is checked, letting the user pick **multiple phases** to seed. Clicking the row body still selects it for editing on the right; clicking the checkbox toggles inclusion in the multi-seed set. A "select all visible" checkbox sits in the header next to the search.
- Footer of the panel shows a summary chip: `N tasks · ~D days` (sum across all phases; days = naive task count / 1.5 rounded).

### Right panel
- Row at top: colored dot + large editable phase-name input + ↑ / ↓ / trash buttons (already present — restyle to match the bordered icon-buttons in the screenshot).
- "TASKS (N)" label + **+ Add task** outlined button on the right.
- Each task card keeps title input, description textarea (multi-line, replace the current `Input`), and a tag-chip row showing **assignee role**, **tag chips**, optional **timeline chip** (`Day X → Y`), **hours chip**, **urgency chip**. The fields driving these chips remain the existing `assigneeRole`, `tags`, plus two new optional template fields described below.
- Up / down / trash icon buttons on the right of each task (existing, restyled to vertical column like screenshot).
- A dashed **+ Add another task** button at the bottom of the task list.

### New optional task-template fields (UI only, persisted in `task_templates.phases` JSON)
- `dayStart`, `dayEnd` (numbers) → drives the `Day X → Y` chip.
- `estimatedHours` (number) → drives the `N hrs` chip.
- `urgency` ("Low" | "Medium" | "High" | "Critical") → drives the urgency chip.

When seeding into a deal, `dayStart`/`dayEnd` map to `startDate`/`endDate` offset from today, and `estimatedHours` + `urgency` flow into the `deal_tasks` insert. No schema change — `phases` is already JSONB.

### Footer actions
- Left: **Save as Template**, **Reset to Default**.
- Right: **Cancel**, **Seed This Phase** (seeds the currently focused phase), **Seed Tasks**.
- New behavior for **Seed Tasks**: when one or more phase checkboxes are ticked, this button seeds **all checked phases**. When none are checked, it seeds every phase (current behavior). Button label switches to `Seed N Phases` when a multi-selection is active.

Wire-up:
- Extend the `onSeed` callback signature to also accept `{ onlyPhaseIdxs?: number[] }`; update `handleSeedFromEditor` in `PhaseTasksView` to honor an explicit phase-index list before falling back to the existing `onlyPhaseIdx` / "all phases" branches.

## Technical notes

- All changes are in `src/components/deals/PhaseTasksView.tsx` plus the two edge functions (`rgy-task-generator`, `mbr-task-generator`) and any RGY/MBR follow-up insert sites in the frontend.
- No DB schema change. `task_templates.phases` is JSONB, so the extra task fields ride along.
- The "RGY Issues" and "MBR" phases are constants in the frontend — they always render in the rail, so deals automatically display them with a count of 0 until the generators populate them.
- Reset-to-Default continues to load `ONBOARDING_PHASES` only (RGY/MBR are not user-seedable).
