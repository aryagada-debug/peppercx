## Four changes, scoped per area

### 1. Staffing & Capacity — drop People view, make BOPM read-only, add "Request review" CTA

- For BOPM persona, remove the **People view** tab. Tabs become just **Staffing** (matrix). Default tab → `matrix`.
- Make the entire Staffing & Capacity page **view-only** for BOPMs:
  - In `MatrixTab`, when `isBopmPersona === true`, replace the `onUpdateDeal` and `onUpsertAssignment` callbacks with no-ops and pass a `readOnly` flag down. Disable all role-add buttons, allocation inputs, deal-type/status selects, person pickers, and the "Add staffing member" dialog trigger. Hide the inline `+` chips on the matrix.
  - Render a small read-only badge in the page header (`👁 Read-only`) for BOPMs.
- Add a **"Request staffing review"** button on the deal pane inside the matrix (visible only to BOPMs). Clicking it:
  - Inserts a row into a new `staffing_review_requests` table with `deal_id`, `requested_by` (user_id), `requested_by_name`, `note` (optional textarea), `status = 'open'`, `created_at`.
  - Shows a toast: *"Review requested — Admin & Central Cx have been notified."*
  - Disables itself (and shows "Review pending since {date}") if there's already an open request for that deal.
- Surface incoming requests for admin/Central Cx:
  - Add a small **"Review requests" pill** on the Staffing & Capacity page header for admin/member roles, count = open requests. Click → drawer listing each request: deal name, requester, note, "Mark resolved" button (sets `status='resolved', resolved_at, resolved_by`).
  - Same pill on the Home/Dashboard alerts strip so it's not buried.

### 2. RGY Health — capture "who last updated and when" as a note

`deal_rgy_weekly` has no audit columns today, so we add a lightweight history table instead of bloating that table:

- New table `deal_rgy_notes`:
  - `id`, `deal_id`, `week_start`, `dimension` (e.g. `internal | customer | delivery | consumption | account_health | finance_billing | capability_seo | capability_creative | overall`), `from_value`, `to_value`, `note` (free text), `updated_by` (user_id), `updated_by_name`, `created_at`.
- Whenever a BOPM (or anyone) changes an RGY cell in **RGY Health** or in the **Deal → RGY tab**, append a row to `deal_rgy_notes` with the before/after values and the current user's display_name.
- New **"History"** popover on each deal row in the RGY table (clock icon next to the deal name) showing the last ~20 entries as a feed:
  > **Ritu Shinde** changed Customer from **G → Y** • 2 hours ago — *"Client raised escalation on TAT"*
  > **Aditya Shaw** changed Delivery from **Y → R** • yesterday
- The same feed renders inside the deal-detail RGY tab as a "Recent updates" panel under the matrix.
- When a BOPM changes RGY in the table, prompt for an optional one-line note in a tiny inline textarea before persisting (skippable). Their name is captured automatically — no manual entry needed.

### 3. MBR Tracker & Deal MBR tab — show all deals with Done / Pending status

- Drop the `deal_type = 'Retainer'` filter in `useMBRData.loadDeals` so **all of the user's deals appear** (Ritu currently loses 11 of 22). Keep the existing `customer_type` exclusion (churned / non-retainer-explicit).
- Each row in the MBR tracker already renders a status pill; for deals with **no MBR entry for the selected month**, show **"Pending"** (amber dot) instead of being absent. For deals with an entry, show **"Done"** (green) or **"Not Done"** (red), keeping the existing client-sentiment dot beside Done.
- Each row has a **"Record MBR"** button:
  - If status is Pending → button label "Record MBR", opens the existing `MBRInputDrawer`.
  - If Done → button label "View / Edit MBR", opens detail dialog.
  - For BOPMs the button works on their tagged deals only (it already does, via the existing scoping).
- Same logic on the **Deal Detail → MBR tab**: top of the tab shows the current month's status (Done / Pending) with a single primary CTA ("Record MBR for {Month}") so a BOPM doesn't have to scroll the history table to log this month's MBR.

### 4. Database changes (one migration)

```sql
-- Staffing review requests (BOPM → Admin/Central Cx)
create table public.staffing_review_requests (
  id uuid primary key default gen_random_uuid(),
  deal_id text not null,
  requested_by uuid not null,
  requested_by_name text not null default '',
  note text not null default '',
  status text not null default 'open',  -- open | resolved
  resolved_by uuid,
  resolved_by_name text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.staffing_review_requests enable row level security;
-- Anyone authenticated can read and insert; only admins (or requester) can update/delete.
create policy "Auth read staffing review requests" on public.staffing_review_requests
  for select to authenticated using (true);
create policy "Auth insert own staffing review requests" on public.staffing_review_requests
  for insert to authenticated with check (auth.uid() = requested_by);
create policy "Admins update staffing review requests" on public.staffing_review_requests
  for update to authenticated using (has_role(auth.uid(), 'admin'::app_role));
create policy "Admins delete staffing review requests" on public.staffing_review_requests
  for delete to authenticated using (has_role(auth.uid(), 'admin'::app_role));

-- RGY change history
create table public.deal_rgy_notes (
  id uuid primary key default gen_random_uuid(),
  deal_id text not null,
  week_start date,
  dimension text not null,
  from_value text not null default '',
  to_value text not null default '',
  note text not null default '',
  updated_by uuid not null,
  updated_by_name text not null default '',
  created_at timestamptz not null default now()
);
alter table public.deal_rgy_notes enable row level security;
create policy "Auth read deal rgy notes" on public.deal_rgy_notes
  for select to authenticated using (true);
create policy "Auth insert own deal rgy notes" on public.deal_rgy_notes
  for insert to authenticated with check (auth.uid() = updated_by);
```

### Files to edit

- `src/pages/Staffing.tsx` — remove People view tab for BOPM, default to matrix, add read-only badge.
- `src/components/staffing/MatrixTab.tsx` — accept and respect `readOnly` prop; add **Request review** button + dialog for BOPM.
- `src/components/staffing/StaffingReviewRequests.tsx` (new) — drawer listing open requests for admin/Central Cx.
- `src/pages/RGYHealth.tsx` — log every RGY change to `deal_rgy_notes`; add **History** popover; for BOPMs prompt for optional note.
- `src/components/rgy/DealDetailDialog.tsx` and the deal-detail RGY tab — show "Recent updates" feed.
- `src/components/rgy/RGYHistoryPopover.tsx` (new) — reusable history feed component.
- `src/hooks/useMBRData.ts` — drop the `deal_type='Retainer'` filter.
- `src/pages/MBRTracker.tsx` — explicit Pending/Done status pill + per-row "Record MBR / View MBR" button.
- `src/pages/DealDetail.tsx` (`DealMBRTab`) — top-of-tab "This month" status + single primary CTA.

No changes to `useDealAccess` — scoping is already correct.