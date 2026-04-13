# Enhanced RGY Health Tab — Historic View, Issue Tracking, and Auto-Task Creation

## Summary

Replace the current RGY Health tab (simple table) with a full-featured view: same 5 RGY parameters as the Overview tab, a historical timeline of all weekly entries, an issue tracker for Red/Yellow statuses with structured fields, and automatic task creation in the Tasks bucket labeled as "RGY Health" tasks.

## Database Migration

Add 6 columns to `deal_rgy_weekly` for issue tracking on non-green statuses:

```sql
ALTER TABLE deal_rgy_weekly
  ADD COLUMN issue_date date,
  ADD COLUMN issue_details text DEFAULT '',
  ADD COLUMN discussed_action_plan text DEFAULT '',
  ADD COLUMN action_plan text DEFAULT '',
  ADD COLUMN resolution_due_date date,
  ADD COLUMN issue_status text DEFAULT 'Open';
```

## Changes

### 1. Update `RGYWeekly` interface and data mapper (`src/hooks/useDealDetail.ts`)

Add `issueDate`, `issueDetails`, `discussedActionPlan`, `actionPlan`, `resolutionDueDate`, `issueStatus` to the `RGYWeekly` interface, the load mapper, and `addRGYWeek` / `updateRGYWeek` functions.

### 2. Rebuild the RGY Health tab (`src/pages/DealDetail.tsx`)

Replace the current simple table with:

**a) Current Week RGY Editor** — Same `EditableRGY` component as Overview, showing the 5 dimensions (Account Health, Delivery, Finance/Billing, Capability-SEO, Capability-Creative) with toggle buttons. Save creates/updates the current week entry.

**b) Issue Capture Form** — When any dimension is set to R or Y, show an inline form below the editor with fields:

- Issue Date (date picker, defaults to today)
- Issue Details (textarea)
- Action Plan (textarea)
- Resolution Due Date (date picker)
- Status (select: Open / In Progress / Resolved)
- Assignee (select from deal team members)
- A "Save & Create Task" button  
Have a feature to create multiple Tasks and a single task can be assigned to multiple assignees

**c) Auto-Task Creation** — On submit, besides saving the RGY entry with issue fields, automatically create a task in `deal_tasks` with:

- Title: `[RGY Health] {dimension} — {issue summary}`
- Description: Full issue details + action plan
- Urgency: "High" for Red, "Medium" for Yellow
- Assignee: The selected assignee from the form
- Stage: "To Do"

**d) Historic Timeline** — Below the editor, show a table of all `rgyWeekly` entries sorted descending by `weekStart`. Each row shows: Week, the 5 dimension badges, Issue Details (truncated), Action Plan, Resolution Due Date, and Status badge. Rows with R/Y values are subtly highlighted.  
  
e) Add the summary of the status tasks made from the RGY. Eg To Do 1, Done 3. If all the tasks are in Done and still it is R or Y, show a warning like Update RGY

### 3. No changes to Overview tab

The Overview tab already shows the same 5 RGY parameters via `EditableRGY`. Both tabs read/write the same `deal_rgy_weekly` data.

## Files Modified


| File                         | Change                                                                   |
| ---------------------------- | ------------------------------------------------------------------------ |
| Migration                    | Add 6 issue-tracking columns to `deal_rgy_weekly`                        |
| `src/hooks/useDealDetail.ts` | Extend `RGYWeekly` interface + mapper + CRUD with new fields             |
| `src/pages/DealDetail.tsx`   | Rebuild RGY Health tab with editor, issue form, auto-task, historic view |
