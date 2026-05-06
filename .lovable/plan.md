## What's already done vs. what's missing

The full `AddStaffingMemberDialog` already shows the proposed person's **Current Engagements** panel, free capacity, and **Start / End date** pickers (with hints showing the deal's own start/end). It is already used by Clients & Deals (`/clients`, `/deals/:id`) and the Staffing Table view's "+" buttons.

Two gaps remain:

1. **Quick-pick paths in the BOPM/VSD/Admin Staffing Table bypass the dialog.** In `BopmStaffingFlatTable.tsx` the inline `PersonPickerPopover` lets a user (a) add someone to a role cell or (b) swap one assigned person for another — both go straight to `stageAdd` / `stageUpdate` with **no engagement view, no start/end picker, default 10%**. This is the main thing the user is reporting on /staffing.
2. **Central CX approval drawer** (`ApprovalsPipeline.tsx`) only exposes raw JSON textareas for editing. Reviewers can't see the proposed person's current engagements, and editing dates/allocations means hand-editing JSON.

## Plan

### 1. Make every "add / change person" path go through `AddStaffingMemberDialog`

`src/components/staffing/AddStaffingMemberDialog.tsx`
- Add two optional props:
  - `initialAllocationPct?: number`
  - `editingAssignmentId?: string` (when set, dialog title becomes "Change assignment" and the confirm button calls a new `onUpdate` callback instead of `onAdd`).
  - `onUpdate?: (assignmentId: string, patch: Partial<StaffingAssignment>) => void`
- When `editingAssignmentId` is provided, prefill role / allocation / dates from the existing assignment, but still recompute `Current Engagements` + free capacity for the **newly selected** person.

`src/components/staffing/BopmStaffingFlatTable.tsx`
- Replace the in-cell "+ Add ROLE" `PersonPickerPopover` (around line 1075) with a button that opens `AddStaffingMemberDialog` for that deal, pre-filtered to the role's category (`initialCategory`) so the user lands on Step 2 with the right shortlist. The dialog handles engagements + dates + allocation; on confirm it calls `stageAdd`.
- Replace the inline name-change `PersonPickerPopover` (around line 782) with a click that opens the same dialog in **edit mode** (`editingAssignmentId` set, `initialCategory` from the column, `initialAllocationPct` from the row). On confirm it calls `stageUpdate(deal.id, assignmentId, { personId, allocationPct, startDate, endDate, roleKey })`.
- Keep direct allocation% inline edit as-is (no dialog) — that's just a number change and isn't what the user is asking for.

`src/components/staffing/DealLevelView.tsx` and `PeopleLevelView.tsx`
- These are read-only today; no changes needed. (Confirmed: all add flows on these pages already route through `AddStaffingMemberDialog` via DealDetail.)

Result: VSD, BOPM, Admin — every persona that can stage a staffing change on /staffing now sees the same Current Engagements card + start/end pickers before submitting.

### 2. Central CX — structured editor with engagement context

`src/components/cx/ApprovalsPipeline.tsx`
- Add a new component `StaffingApprovalEditor` rendered when `active.request_type` is `staffing.add | staffing.update | staffing.remove` and edit mode is on (or always, for staffing). It replaces the JSON textareas with:
  - **Person** picker (typeahead from `staffing_people`, same UX as the dialog's search)
  - **Role on deal** (text)
  - **Allocation %** + auto-derived hrs/wk
  - **Start date** / **End date** pickers, with the deal's start/end shown as hints (looked up from `staffing_deals` by `deal_id`)
  - **Current Engagements** panel for the chosen person — reused via a small extracted component `<PersonEngagementsCard person assignments deals/>` lifted out of `AddStaffingMemberDialog.tsx` so both screens render the identical card.
  - Free-form **Reviewer note** (already exists)
- On Save it builds the same `payload` shape today's edge function expects and calls the existing `updateApprovalRequestDetails(active.id, …)` — no schema or edge-function changes.
- Approve & apply still calls `applyApprovedRequest` with `editSummary: "Central CX edited approval details before approving."` so the existing notification fan-out (already wired in `supabase/functions/approval-execute/index.ts` to email/notify the requester, the deal's VSD, BOPMs, and the staffed person) carries the edited values through unchanged.

Keep the JSON textarea editor as a hidden "Advanced" toggle for non-staffing types (client.create, deal.create, etc.) so nothing else regresses.

### 3. Small data plumbing

- Approvals drawer needs `staffing_people` + `staffing_assignments` + `staffing_deals` to render the engagements card. Use the existing `useStaffingData()` hook (already pulls all three) — call it inside `ApprovalsPipeline` so the drawer has people/deals/assignments available without new fetches.

### 4. QA checklist

- VSD on /staffing > Staffing tab: clicking "+ Add" in any role cell opens the dialog, shows engagements + date pickers; confirming stages the change with the chosen dates.
- Same for swapping a person inline.
- BOPM persona (read-only) is unaffected — they still go through the existing "Request change" flow which already opens the dialog.
- Central CX > Approvals: opening any staffing approval shows the structured editor, the proposed person's engagements card, and editable dates/allocation. Saving + Approving sends the edited payload to the requester, VSD, BOPM, and the staffed person via the existing notify path.

### Files touched

- `src/components/staffing/AddStaffingMemberDialog.tsx` — extract `PersonEngagementsCard`, add `editingAssignmentId` / `initialAllocationPct` / `onUpdate` props.
- `src/components/staffing/BopmStaffingFlatTable.tsx` — route in-cell add and inline person-swap through the dialog.
- `src/components/cx/ApprovalsPipeline.tsx` — new `StaffingApprovalEditor` for staffing requests, reusing `PersonEngagementsCard`.
- (No DB schema changes, no edge-function changes.)