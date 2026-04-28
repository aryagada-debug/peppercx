# Approval Pipeline for Staffing & Creation Requests

Today, anyone with access can directly add/remove/edit staffing assignments, create clients, and create deals. We will switch these to a **request-and-approve** model. Requests are queued in **Central Cx**, where Admin/Central Cx reviewers see a pipeline-style board (Pending → Under Review → Approved → Rejected). Only on approval are the actual changes applied.

## What changes for the user

- **Staffing changes** (add member, remove member, change %, change dates, change role) — across Deal Detail → Staffing tab, Clients page deal drawer, People view, Weekly Staffing grid: all become **"Request change"** instead of direct edits.
- **Create Client** and **Create Deal** flows: same treatment — submitting the wizard creates a **request**, not the actual record.
- The requester sees their pending request inline (badge + "Awaiting approval"), and can cancel it before review.
- **Admins / Central Cx role** retain a "direct edit" override (toggleable from the request dialog) so they aren't blocked.
- New **Approvals pipeline** in Central Cx with:
  - Kanban columns: **Pending**, **Under Review**, **Approved**, **Rejected** (drag to move)
  - List view with filter by request type, requester, deal, status, date
  - Request detail drawer showing diff (before vs. after), requester note, comments, and Approve / Reject / Request changes actions
  - Notification badge in top nav for reviewers  
  Also for a single deal, let them request a single change rather than multiple. Also once a request is sent, they should be able to only view their own request and any duplicate request should not be allowed

## Technical changes

### Database (new table — single source for all approval requests)

`approval_requests`

- `id uuid pk`
- `request_type text` — `staffing.add | staffing.update | staffing.remove | client.create | deal.create`
- `target_kind text` + `target_id text` (nullable for create requests)
- `deal_id text` (nullable, for staffing requests + deal creation)
- `payload jsonb` — the proposed values (full assignment, client fields, deal fields)
- `previous jsonb` — current values for update/remove (for diff)
- `status text` default `'pending'` — `pending | under_review | approved | rejected | cancelled`
- `requested_by uuid`, `requested_by_name text`, `requester_note text`
- `reviewer_id uuid`, `reviewer_name text`, `reviewer_note text`
- `decided_at timestamptz`, `created_at`, `updated_at`
- RLS: authenticated insert (own), select all authenticated, update only admins (via `has_role`)

A second table `approval_comments` for back-and-forth discussion (id, request_id, author_id, author_name, body, created_at).

### Frontend — request submission

- New helper `src/lib/approvals.ts` with `submitRequest({ type, payload, previous, dealId, note })` and `cancelRequest(id)`.
- New hook `useApprovalForTarget(targetKey)` returning `{ pending, status }` so UI can show "Awaiting approval" pills.
- **Wrap existing mutations**:
  - `AddStaffingMemberDialog` — replace `onAdd` callback to submit a `staffing.add` request (admins keep a "Apply directly" toggle).
  - `DealLevelView` / `PeopleLevelView` / `WeeklyStaffingGrid` — convert allocation/% edits and remove buttons to request flows.
  - `ClientFormDialog` — submit `client.create` request.
  - `DealFormWizard` — submit `deal.create` request.
- All affected components show inline "Pending review" state and disable further edits while a request is open for that target.

### Approval execution

Single edge function `approval-execute` (admin-only via JWT + `has_role`) that:

- Reads the request, validates payload, performs the actual DB write (insert into `staffing_assignments` / `clients` / `staffing_deals` / update / delete), then marks request `approved`.
- Rejection just sets `status='rejected'` with reviewer note.
- Idempotent: refuses if already decided.

### Central Cx UI revamp

- Add new top-level tab in `src/pages/CentralCx.tsx`: **Approvals** (alongside existing Spaces/Overview/List/Board).
  - `src/components/cx/ApprovalsBoard.tsx` — Kanban with 4 columns; drag uses `@dnd-kit`.
  - `src/components/cx/ApprovalsList.tsx` — table view with filters + bulk approve.
  - `src/components/cx/ApprovalDetailDrawer.tsx` — diff view (JSON-friendly key/value compare), comments thread, Approve/Reject/Request-changes buttons, link to deal/client/person.
- Realtime subscription on `approval_requests` so the board updates live.
- Top-nav badge component `ApprovalsBadge` showing pending count for admins/reviewers, links to the new tab.

### Migration of existing `staffing_review_requests`

- Keep the old "Review request" flow (it's a flag/comment, not a change). New `approval_requests` is the actual change-approval pipeline. Optionally surface old review requests as a separate column/filter inside Approvals board for unified visibility.

### Files to add

- `supabase/migrations/<ts>_approval_requests.sql` — new tables + RLS
- `supabase/functions/approval-execute/index.ts`
- `src/lib/approvals.ts`, `src/hooks/useApprovals.ts`
- `src/components/approvals/PendingBadge.tsx`, `RequestChangeDialog.tsx`
- `src/components/cx/ApprovalsBoard.tsx`, `ApprovalsList.tsx`, `ApprovalDetailDrawer.tsx`

### Files to edit

- `src/pages/CentralCx.tsx` (add Approvals tab + revamp header)
- `src/components/staffing/AddStaffingMemberDialog.tsx`
- `src/components/staffing/DealLevelView.tsx`, `PeopleLevelView.tsx`
- `src/components/deals/WeeklyStaffingGrid.tsx`
- `src/components/deals/ClientFormDialog.tsx`, `DealFormWizard.tsx`
- `src/pages/Clients.tsx`, `src/pages/DealDetail.tsx` (route mutations through approvals helper)
- `src/components/layout/AppLayout.tsx` (top-nav approvals badge)

## Out of scope

- Changing edit flows that are not people-assignment or entity-creation (e.g. RGY notes, MBR entries, financials still edit directly).
- Email/Slack notifications for approvals (can be added later via `notify-assignment` pattern).