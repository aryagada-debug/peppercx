## 1. Phase rail — show only seeded phases

**File:** `src/components/deals/PhaseTasksView.tsx`

- Rewrite the `allPhases` memo (~L1079) so it only includes phase names that actually have tasks in `tasksByPhase`, plus the mandatory generators (`RGY Issues`, `MBR`) **only if they have tasks too** (currently they are force-added). The `General` bucket stays only when it has tasks (already the case).
- Order: preserve the order tasks were seeded in. We'll track this by using the order phases first appear in `phaseTasks` (sorted by `created_at` / `sort_order`), falling back to `ONBOARDING_PHASES` order for ties.
- If `allPhases.length === 0`, fall through to the existing `!hasPhaseData` empty state ("Customize & Seed Template"). Update `hasPhaseData` to mean "has at least one phase task" so deleting the last phase brings the empty state back.

## 2. Delete a seeded phase (and return to seed empty state)

**File:** `src/components/deals/PhaseTasksView.tsx`

- In the left phase rail row, add a small `Trash2` button that appears on hover (next to the count). Mandatory phases (`RGY Issues`, `MBR`) remain non-deletable — they regenerate.
- Clicking it opens an `AlertDialog`: "Delete phase X? This will remove N tasks." On confirm:
  - `supabase.from("deal_tasks").delete().eq("deal_id", dealId).eq("phase", phaseName)`
  - If the deleted phase was the active one, switch to `All Tasks`.
- Because `allPhases` is now derived from existing tasks, the row disappears automatically. When the last phase is removed, the empty state renders, exposing **Customize & Seed Template** again.

## 3. Home → Add Task: support "Internal" task type

**Files:** `src/pages/Home.tsx`, new migration on `personal_todos`.

### UI change (Add Task picker, ~L1572)
Add a segmented toggle at the top of the deal-picker dialog:
- **Client deal** (default — current behavior, then opens `TaskFormDialog` for `deal_tasks`)
- **Internal**

When **Internal** is selected, the picker shows:
- Title input
- Optional notes
- Assignee picker (reuse the existing `assignees` list from staffing people — same component pattern as `TemplateAssigneePicker`)
- Priority (Low/Medium/High) + Due date

Submit inserts into `personal_todos` with the assignee as `user_id` (so it lands in their personal todos) and `assigned_by_user_id` / `assigned_by_name` set to the current user.

### Display change
- **My Personal Todos panel** on Home: when `assigned_by_user_id` is set and isn't the current user, show a small "from {assigned_by_name}" line under the title.
- **My Tasks list** (the combined kanban/list on Home): include `personal_todos` rows where `assigned_by_user_id = me OR user_id = me`. Internal items assigned by me to others show up here with parent label "Internal · to {assignee_name}".

### Schema change (migration)
On `personal_todos` add:
- `assigned_by_user_id uuid` (nullable)
- `assigned_by_name text default ''`
- `assignee_name text default ''` (cached display for the owner — so the assigner can read it via index without joining auth)

Update RLS `Own todos select` to also allow `auth.uid() = assigned_by_user_id`. Insert policy widened: a row can be inserted when either `auth.uid() = user_id` (self-todo) **or** `auth.uid() = assigned_by_user_id` (assigning to someone else). Update/delete stay owner-only, except the assigner can delete a row they created (add `auth.uid() = assigned_by_user_id` to the delete policy as well).

How users are picked: we resolve the staffing person → app user by joining `profiles.staffing_person_id`. If no profile exists yet, the row is inserted with a placeholder `user_id` only when the picked person has a linked profile; otherwise we surface a toast "User has not signed in yet — can't assign internal task."

## 4. Staffing — replace "Add member" with "Request staffing"

**File:** `src/components/staffing/BopmStaffingFlatTable.tsx` (and any other surface that mounts `AddStaffingMemberDialog`).

- Remove the three `AddStaffingMemberDialog` mount points used for adding new staffing rows (the `addForDeal` and `addCell` cases; edit-mode mount stays).
- Replace every "Add Staffing Member" / "+" affordance (the deal-row plus button and the empty-cell plus) with a **Request Staffing** button.
- Clicking opens a small dialog with:
  - Deal name (prefilled, readonly)
  - Role / category (prefilled from the cell context when applicable)
  - **Request notes** — a `Textarea` for the user to describe the request (e.g. "Need 1 mid-level SEO analyst for 40% from Jan").
  - Submit → inserts into the existing `staffing_review_requests` table (already used by `RequestStaffingReviewButton`) with `request_type = 'new_staffing'`, `payload = { roleKey, category, allocationPct?, notes }`, `requester_note = notes`.
- The existing `StaffingReviewRequests` reviewer panel already lists and approves these, so nothing else needs to change downstream. Approved requests are the only path that creates an actual `staffing_assignments` row going forward.
- The dialog stays available in **edit mode** (capacity admins) so existing assignments can still be modified — only the "create new from scratch" entrypoint is removed for everyone.

## Out of scope

- Bulk import of internal tasks.
- Notifications/email when an internal task is assigned (we can wire `notify-assignment` later — flagged but not in this change).
- Reordering of seeded phases.
