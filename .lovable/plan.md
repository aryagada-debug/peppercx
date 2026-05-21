
## 1. Activity in my accounts — show who performed each action

File: `src/hooks/useAccountActivity.ts`

- **RGY**: select `updated_by_name` from `deal_rgy_weekly`. Use it as `actor` (fallback to `"RGY"`). Move the current "Issue logged / Health updated…" text into `text` (already does). Result: row reads `Aamir Khan · Issue logged …` instead of `RGY · Issue logged …`.
- **MBR**: keep `updated_by` lookup but also pull a name field. Currently `m.updated_by` is a uuid string. Switch the select to also fetch a display name. Easiest: select via a join-style lookup — fetch `mbr_entries` rows then resolve `updated_by` uuids against the `profiles` table in one batched query and map to display_name. Fallback to `"MBR"` only when truly unknown.
- **Tasks**: today `actor = t.assignee`, but the screenshot shows "Disha Suratwala · Task …" which is who it's *assigned to*, not who performed the change. Add `updated_by_name` (if column exists) or fall back to `assignee` as today. Verify the column on `deal_tasks` before adding; if not present, leave as-is.
- **Slack**: already uses `user_name`. No change.

Render in `src/pages/Home.tsx` (line ~1362) already shows `{a.actor}` — no UI change needed beyond the hook returning the real name.

## 2. My Tasks filter — searchable + alphabetical

File: `src/pages/Home.tsx` (lines 916–955)

- **Alphabetical**: sort `viewAsPeople` by `name` (case-insensitive) before rendering, in both the admin Select and the VSD pill row. Keep "Me" and "All" pinned at the top.
- **Searchable dropdown** (admin): replace the plain `Select` with a Combobox = `Popover` + `Command` (`CommandInput`, `CommandList`, `CommandItem`) using existing shadcn components. Trigger button mirrors current `SelectTrigger` styling (`h-7 w-[180px] text-[12px]`). Items: `Me`, `All`, then sorted people. Selecting sets `taskViewAs`. Same component reused for the VSD viewer when the people list is long (>8) — otherwise keep the pill segmented row but sorted.

No backend or business-logic changes.

### Technical notes

- `useAccountActivity.ts`: extend MBR fetch to also call `supabase.from("profiles").select("user_id, display_name").in("user_id", uniqueUuids)` and build a lookup map before pushing items.
- Combobox pattern already used elsewhere in the codebase (e.g., `AttendeeMultiSelect.tsx`) — reuse same `Command` import shape.
