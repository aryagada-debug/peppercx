## Why assignees disappeared for non-admins

In `src/hooks/queries/useHomeBoardQueries.ts` (line ~186) the staffing-people fetch is gated:

```ts
let allPeople: PersonLite[] = [];
if (isAdmin || isVsdViewer) {
  const { data: peopleRows } = await supabase
    .from("staffing_people").select("id, name, designation, tbh")
    .eq("tbh", false).eq("leaving", false);
  allPeople = (peopleRows as PersonLite[]) || [];
}
```

For a regular BOPM (not admin, not a VSD viewer) `allPeople` stays `[]`. Home then passes that empty list as the `assignees` prop into `TaskFormDialog`, so its searchable combobox shows "No people found." — matching exactly what's in the screenshot.

This gate was added during a recent perf pass to avoid loading the full people table for users who didn't need it on their dashboard. The side-effect: the task-edit dialog on Home loses its picker for everyone except admins/VSDs.

## Fix

Drop the role gate and always load the lightweight people list (id/name/designation, active only). It's the same shape used by `TaskFormDialog` elsewhere in the app for all users (e.g. Deal Detail), so there's no new exposure — `staffing_people` RLS already permits authenticated reads of these public-ish columns.

### Change

`src/hooks/queries/useHomeBoardQueries.ts`:

```ts
const { data: peopleRows } = await supabase
  .from("staffing_people")
  .select("id, name, designation, tbh")
  .eq("tbh", false)
  .eq("leaving", false);
const allPeople = (peopleRows as PersonLite[]) || [];
```

(Remove the `if (isAdmin || isVsdViewer)` wrapper; keep the rest of the function untouched.)

No other files need editing — `dialogAssignees` in `Home.tsx` already builds the staffed/others split from `allPeople` + `dealAssignmentsMap`.

## Out of scope

- Re-introducing a role-scoped variant for the "view as" dropdown — that path uses `viewAsPeople` which has its own filter and is unaffected.
- Any RLS changes on `staffing_people`.
