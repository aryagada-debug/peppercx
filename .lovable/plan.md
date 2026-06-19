## 1. Auto-seed staffing assignments on deal creation

When a new deal is created via the Deal Wizard (`handleCreateDeal` in `src/pages/Clients.tsx`), immediately after `staffing_deals` insert succeeds, insert one row per filled BOPM-family role into `staffing_assignments` with **`allocation_pct = 0`** (no % mapping) and no week / start / end date so they appear on the Staffing tab but don't consume capacity:

For each of `vsd`, `principalBopm`, `seniorBopm`, `bopm` in the wizard data:
- Look up the person id in the already-loaded `people` list by name (case-insensitive match).
- If found, insert `{ staffing_deal_id: newId, person_id, role_key: <vsd|principal_bopm|senior_bopm|bopm>, allocation_pct: 0 }`.
- Skip silently if the name is empty or no person matches (no toast spam).

The existing `sync_bopm_fields_from_assignment` trigger keeps the deal's BOPM columns in sync, so no extra recompute is needed. The same seeding will also be applied in the approval-execute path so deals created via approval get the same rows (mirror logic into `supabase/functions/approval-execute/index.ts` for the `deal.create` branch).

## 2. RGY: assignee mandatory + edit existing issue

### Make assignee compulsory in `RGYCombinedIssuesDialog`
- In `submit()`: add a guard — if `taskAssignees.length === 0`, `toast.error("Please assign at least one person")` and return.
- Disable the Save button when assignees are empty (in addition to existing disabled conditions); show a small helper line under the chips: "At least one assignee is required."
- Keep existing issue-details + action-plan required guards.

### Block RGY save until issue is logged
Currently a Red/Yellow is persisted first and the issue dialog opens after. Change the flow so RGY can't stay R/Y without a logged issue:

- In `src/pages/RGYHealth.tsx` `handleMarkRGYSave`: if any dim ends up R/Y, persist the RGY change then open the combined-issues dialog as today, BUT if the user cancels/closes that dialog without saving, revert the affected dims back to their prior value (snapshot the pre-save values before persisting; on cancel, write the snapshot back via the same update path and show a toast "RGY reverted — issue is mandatory for R/Y").
- Same revert wiring in `src/pages/DealDetail.tsx` where R/Y is set inline via `EditableRGY`. Track the pre-change value, open `RGYCombinedIssuesDialog` (mode `"create"`), and on close-without-save revert the dimension.
- Existing weekly rows that already have `issue_details` filled don't trigger the dialog — only newly-introduced R/Y values do.

### Edit existing issue
- `DealDetail` already has an "Edit issue" entry via `combinedIssuesMode === "edit"`. Make sure the status-bar "Review issues" button stays visible whenever the deal has any R/Y dim and opens the dialog in edit mode pre-filled with `issue_details`, `action_plan`, `due_date`, `issue_status`, and the assignees (read existing `deal_tasks` row tagged `[RGY Health]` for the current week to pre-fill the assignees chip selection).
- In `RGYHealth.tsx`, add an "Edit issue" link/button on each row that has R/Y + an existing issue, opening `RGYCombinedIssuesDialog` with `initial` pre-filled from `rgy_issue_details / rgy_action_plan / rgy_issue_date` and the matching `deal_tasks` row's `assignees`. Save path updates the same `deal_rgy_weekly` row and updates (not re-inserts) the matching task.

## Technical notes

- Files changed: `src/pages/Clients.tsx`, `supabase/functions/approval-execute/index.ts`, `src/components/rgy/RGYCombinedIssuesDialog.tsx`, `src/pages/RGYHealth.tsx`, `src/pages/DealDetail.tsx`.
- No schema migration required — `staffing_assignments`, `deal_rgy_weekly`, and `deal_tasks` already support all needed columns.
- The 0% allocations will be visible in `WeeklyStaffingGrid` / `DealStaffingCard` but won't count toward person capacity (capacity sums `allocation_pct`).