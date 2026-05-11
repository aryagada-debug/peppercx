## Goal

In Home → My Tasks, change the VSD's "View tasks for…" control from a Select dropdown to a segmented pill group matching the Clients & Deals BOPM filter, with options `Me`, `All`, and one pill per team BOPM. Confirm that selecting a BOPM also shows tasks assigned to that BOPM even when the VSD is not directly on the task. only for the BOPMs under the particular VSD

## Change 1 — Pill UI for the view-as filter (VSD viewer)

In `src/pages/Home.tsx`, replace the current `<Select>` (around line 898) with a pill group styled identically to the BOPM pills on `src/pages/Clients.tsx` (lines 730–752):

```
<div className="flex gap-0.5 bg-secondary rounded-lg p-0.5 overflow-x-auto max-w-full">
  <button … active={taskViewAs === "me"}>Me</button>
  <button … active={taskViewAs === "all"}>All</button>
  {viewAsPeople.map(p => (
    <button key={p.id} active={taskViewAs === p.id}>{p.name}</button>
  ))}
</div>
```

- Active pill: `bg-primary text-primary-foreground shadow-sm`.
- Inactive pill: `text-muted-foreground hover:text-foreground`.
- Pill text size `text-[11px]`, padding `px-2.5 py-1`, rounded-md (matches Clients).
- Remove the "Created by me" option entirely (per the user's spec).
- The existing `viewAsPeople` memo already returns just the VSD's team BOPMs, so no logic change.

For admin users (not VSD viewer), keep the existing Select dropdown but also drop the "Created by me" option so the option set stays consistent (Me / All / specific person). The admin list can be too long for pills.

## Change 2 — Confirm BOPM-selected task visibility

The current `taskScopePredicate` in `Home.tsx` (lines 519–545) already filters tasks where the task's `assignees[]` contains the selected person's name, regardless of whether the VSD is on the deal or the task. `loadTasks` selects all `deal_tasks` / `cx_tasks`, so the data is present.

No logic change needed — the pill simply sets `taskViewAs = <personId>` and the existing predicate matches by assignee name.

A small comment will be added above the predicate clarifying that "specific person" view is intentionally unscoped to VSD-team deals so the VSD can see that BOPM's tasks across every deal.

## Files touched

- `src/pages/Home.tsx` — swap the Select for pill buttons (VSD-viewer branch), remove the "Created by me" SelectItem in the admin branch, and add a clarifying code comment.

## Out of scope

- No data-loading changes (the dropdown already drives the in-memory filter).
- No changes to the Clients & Deals BOPM filter or its data source.
- No changes to `taskFilter` (overdue/today/upcoming chips).  
  
In the task - also show the Due date while in kanban. If no due date is mentioned - subtly highlight that. if it is approaching, show it accordingly