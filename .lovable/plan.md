## Scope

Three changes inside the Deal Detail page (`/deals/:id`).

### 1. Add Phase in Tasks tab

In `src/components/deals/PhaseTasksView.tsx`, the left "Phases" rail currently lists only phases derived from existing tasks. Add an **+ Add Phase** button at the bottom of the rail.

- Clicking it appends a new entry with an editable name (auto-focused inline input, default `New Phase N`).
- The phase is held in local component state (`customPhases: string[]`) and merged into `allPhases` so it shows up immediately.
- Selecting it sets it as the active phase; any task added via the existing "Add Task" UI inherits this phase name (existing `onAdd({ ...task, phase: activePhase })` path), which persists it via `deal_tasks.phase`.
- The new phase is deletable via the existing trash button (it's not in `MANDATORY_PHASES`); deleting also removes it from local custom list.
- Renaming an existing custom phase (pencil icon next to name) updates all `deal_tasks` rows where `phase = oldName` for the deal via a single Supabase update, then refreshes locally.

No DB schema change — phases live on `deal_tasks.phase`. Empty custom phases live only in session until a task is added.

### 2. Remove Overall RGY block from MBR tab

In `src/pages/DealDetail.tsx`, delete lines ~911–991 inside `DealMBRTab` (the entire `{/* Overall RGY — comprehensive weighted score breakdown */}` IIFE). The "Overall RGY" KPI tile in `mbrKpis` (line ~765) stays since the user only asked to remove the comprehensive block; if they meant the KPI too they can confirm. Imports of `computeOverallCustomerScore` / `getOverallCustomerRGY` / `RGY_WEIGHTS` remain because they are still used in the RGY Health tab.

### 3. New "Requests" top-level tab

Add `"Requests"` to the `TABS` tuple in `src/pages/DealDetail.tsx` (after `"MBR"`).

- Visible only to **VSD** and **BOPM** personas. Use the existing role/persona hook (`useUserRole` / persona detection used elsewhere); when the current user isn't VSD/BOPM, hide the tab button and block the section.
- Render a new `DealRequestsTab` component that queries `approval_requests` filtered by `deal_id = currentDealId` ordered by `created_at desc`. Reuse `useApprovals`-style realtime subscription scoped to this deal.
- Columns: Created · Type (`request_type`) · Title (`batch_title` or derived) · Status badge (pending/under_review/approved/rejected/cancelled) · Requester · Reviewer · Note. Row click opens the existing approval detail dialog if available, otherwise an inline drawer with `requester_note`, `reviewer_note`, and `approval_comments` (already in schema).
- Empty state: "No requests sent to Central CX for this deal yet."
- Tab badge shows count of `pending` + `under_review` requests.

### Technical notes

- No migrations required. Existing `approval_requests` RLS already allows requesters and admins/members to read.
- Persona check: read current user's role via `useUserRole`; treat `VSD` and `BOPM` (incl. Senior/Principal BOPM) as eligible — match on `staffing_people.designation` of the linked profile, mirroring how other tabs gate visibility.
- For phase rename, single statement: `update deal_tasks set phase = newName where deal_id = X and phase = oldName`.

### Files touched

- `src/components/deals/PhaseTasksView.tsx` — add phase button, rename support, custom-phase local state.
- `src/pages/DealDetail.tsx` — remove Overall RGY block from MBR tab; add `Requests` to `TABS`, persona-gate it, render new tab section.
- `src/components/deals/DealRequestsTab.tsx` — new component for the Requests tab.
