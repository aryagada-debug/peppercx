# Plan

Four scoped changes across UI, data model, and a scheduled backend job.

---

## 1. Currency toggle (₹/$) — make active state more prominent

**File:** `src/components/ui/currency-input.tsx`

The current toggle uses subtle styling (light gray background, small chevron buttons). Refactor the `ToggleBtn` so the **active** option is visually unmistakable:

- Active button: solid **primary** color background (`bg-primary text-primary-foreground`), bold weight, slightly larger.
- Inactive button: transparent with muted text and clear hover state.
- Increase button width from `w-6` → `w-7`, font size `text-[11px]` → `text-xs font-bold`.
- Add a subtle ring/border around the toggle group so it reads as a control, not decoration.
- Keep the same interaction logic.

This affects every place CurrencyInput is used (Deal Form Wizard MRR, total deal value, retainer/non-retainer values, SoW revenue share).

---

## 2. Targets tab — add Deal Name & Client Name columns

**File:** `src/components/targets/DealTargetsTable.tsx` (used in Targets page "By Deal" tab)

Currently shows a single "Deal" column that contains both name and account stacked. Split into two dedicated columns:

- **Deal Name** (sticky left) — links to `/deals/:id`
- **Client Name** — separate column, plain text, truncated with tooltip on overflow

Update the `<thead>` to add a second sticky header cell, adjust the colSpan/structure of the metric header rows to account for one extra leading column, and split the existing combined `<td>` into two cells. Drop the inline `<div>` for account since it now has its own column.

---

## 3. Staffing — per-assignment Start/End dates + reminders

### 3a. Schema change (migration)

Add to `staffing_assignments`:

- `start_date date` (nullable)
- `end_date date` (nullable)

### 3b. UI

**Files:** `src/hooks/useStaffingData.ts`, `src/components/staffing/AddStaffingMemberDialog.tsx`, `src/components/staffing/MatrixTab.tsx`, `src/components/staffing/DealLevelView.tsx`

- Extend `Assignment` type with `startDate?`, `endDate?`.
- In **Add Staffing Member** dialog (step 3), add two date pickers (default: deal start/end) next to allocation %.
- In **Matrix tab** assignment row, render two compact date inputs alongside the allocation slider.
- In **Deal-Level view**, show start–end as a small caption under the person name.
- Persist via existing `upsertAssignmentByRole` / `updateAssignment` paths.

### 3c. Reminder edge function + cron

**New file:** `supabase/functions/staffing-capacity-reminders/index.ts`

Single function that handles three reminder types based on a `mode` query param (`weekly` | `start` | `end`):

1. **Weekly capacity reminder** (`mode=weekly`, every Monday 9 AM IST): send a Slack DM to every active person in `staffing_people` (via `slack_user_id`) reminding them to fill in/confirm capacity for the current week. Skip people with no `slack_user_id`.
2. **Start-date nudge** (`mode=start`, daily 9 AM IST): query `staffing_assignments` where `start_date = today`, DM that person + the deal's VSD/BOPM with deal context.
3. **End-date nudge** (`mode=end`, daily 9 AM IST): query `staffing_assignments` where `end_date = today` (or yesterday), DM the same set noting the assignment has ended and to update allocation.

Use existing `SLACK_BOT_TOKEN` secret and the same DM pattern as `mbr-reminders`. Add `[functions.staffing-capacity-reminders] verify_jwt = false` to `supabase/config.toml`.

**Cron** (insert via SQL using insert tool, since it contains URL/anon key):

- `0 3 * * 1` (Mon 09:00 IST = 03:30 UTC; use `30 3 * * 1`) → `?mode=weekly`
- `30 3 * * *` daily → `?mode=start`
- `30 3 * * *` daily → `?mode=end`

Log each send into a new `staffing_reminder_log` table (id, person_id, deal_id, assignment_id, reminder_type, sent_at) to prevent duplicates within the same day.

---

## 4. Financial terminology — standardize to Contraction / Delivery / Invoicing / Receivables

**Files:** `src/components/deals/FinancialsTab.tsx` (primary), plus any KPI labels in `src/pages/DealDetail.tsx`, `src/pages/Revenue.tsx`, `src/pages/Home.tsx` referencing "Consumption" or "Recognition".

- Replace every user-visible label "Consumption" → "Contraction" 
- Replace "Total MIS recognition" → "Total Contraction".
- Section headings "Consumption Bucket" → "Contraction Bucket"; "Monthly consumption vs target" → "Monthly contraction vs target".
- Editable monthly table column header "Consumption" → "Contraction".
- Add-row form label "Consumption (₹)" → "Contraction (₹)".
- Pipeline card `title="Consumption"` → `title="Contraction"`.
- **Keep underlying field names** (`consumption`, `deal_financials.consumption`) unchanged — DB column rename is risky and unnecessary; this is a display-layer rename only.
- Verify Delivery / Invoicing / Receivables wording is already consistent (it is in csvTargets METRIC_LABELS).

---

## Technical notes

- No DB rename of `deal_financials.consumption` — display-only relabel keeps migration scope small and safe.
- Reminder function will be idempotent per (person, deal, type, date) via the new log table.
- Dates on assignments are optional; existing rows continue to work unchanged.
- All Slack sends use the existing `slack-send` patterns, no new secrets needed.

## Files touched

Created:

- `supabase/functions/staffing-capacity-reminders/index.ts`
- migrations: add columns to `staffing_assignments`, create `staffing_reminder_log`, register cron jobs.

Edited:

- `src/components/ui/currency-input.tsx`
- `src/components/targets/DealTargetsTable.tsx`
- `src/hooks/useStaffingData.ts`
- `src/components/staffing/AddStaffingMemberDialog.tsx`
- `src/components/staffing/MatrixTab.tsx`
- `src/components/staffing/DealLevelView.tsx`
- `src/components/deals/FinancialsTab.tsx`
- `supabase/config.toml`