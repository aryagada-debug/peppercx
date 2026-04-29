
# People & Reporting — overhaul

Replace today's flat People table with a richer workspace that has **three sub-views** sharing the same source data (`staffing_people`):

1. **Tree** — team → sub-team → people, with drag-and-drop and full CRUD
2. **Org Chart** — visual reporting tree (style of the screenshot)
3. **Email Mapping** — focused table to audit/fix emails per person

The view switcher sits at the top of the People & Reporting tab; the three other Settings tabs are untouched.

---

## 1) Tree view (default)

Hierarchical list grouped first by **Team (department)**, then **Sub-team**, then individual people, with reporting structure visible inside each sub-team.

```text
▾ Capability — Creative Team           [+ Sub-team] [+ Person]   24 people
   ▾ Strategy                          [+ Person]                 8 people
       Sneha Iyer · Senior Director              [edit] [leaving] [×]
         └ Nikhil Somani · Creative Director     [edit] [leaving] [×]
             └ Ansh Bhansali · AGH — Strategy    [edit] [leaving] [×]
       Avantika Jain · Associate CD              [edit] [leaving] [×]
   ▸ Copy                                                          5 people
   ▸ Art                                                           11 people
▸ Capability — SEO Team                                            18 people
```

Capabilities (per the user request):
- **Add Team** — header-level button opens a dialog (name + description). Stored as a new department value; persists when at least one person is assigned.
- **Add Sub-team** — appears on each team row; a sub-team is a free-text grouping stored on each person (new optional field `subTeam`, see Technical section).
- **Add Person** — opens an "Add person" dialog (name, email, designation, band, team, sub-team, reports-to). Saves into `staffing_people`.
- **Delete person** — row-level trash icon → confirm → cascades exactly like today's `deletePerson`.
- **Mark / unmark as Leaving** — a flag toggle on each row (no dialog). Visually dims the row and shows a "Leaving" pill, identical to current behavior.
- **Drag-and-drop** (using existing `@dnd-kit`):
  - Drop a person onto a **Team** header → sets `department`, clears `subTeam` if no longer valid.
  - Drop onto a **Sub-team** header → sets `subTeam` (and `department` if cross-team).
  - Drop onto **another person row** → sets `reportingManager` to that person's name (with self-loop guard, mirroring the existing `handleReportingChange`).
  - Tiny drag handle on each row, identical visual style to the existing Revenue Capacity table.
- Search box filters across name / department / designation / sub-team / email and auto-expands matching branches.
- Each person row shows: name, designation, band pill, reports-to (small caption), and email on hover.

## 2) Org Chart view

A horizontally scrollable, indented tree built from `reportingManager` relationships, modeled on the attached screenshot:

```text
[CEO]──178──┬──[Aashay Shah · Principal Engineer]──9──[Naomi Silveira · Mgr Gen AI]
            ├──[Apurva Dalmia · VP Finance]──13
            ├──[Sneha Iyer · VP Enterprise]──30
            ├──[Meghana D · Sr Director · AI]──1
            └──...
```

Specifics:
- Built entirely from existing data — no schema needed for the chart itself.
- Roots = anyone with no `reportingManager` (or whose manager isn't in the people list).
- Each card shows avatar (initials fallback), name, designation. A small badge on the right shows **direct-report count**; clicking it expands that person's subtree.
- Click a card → side drawer with the same edit fields as Tree view (name, team, sub-team, designation, band, email, reports-to, leaving toggle, delete).
- Pan/zoom not required for v1; horizontal scroll + collapse/expand badges (like the screenshot's blue chips) is enough.
- Same search box at the top; matched nodes are highlighted and ancestors auto-expand.

## 3) Email Mapping view

Focused audit table so the admin can quickly fix wrong emails:

| Name | Team | Designation | Email | Linked login? | Status |
|---|---|---|---|---|---|
| Sneha Iyer | Creative | VP Enterprise | sneha@pepper... | Yes (sneha@…) | OK |
| Vasudha Sharma | HR & TA | Sr Mgr Talent | (empty) | — | Missing |
| Mariana Cornejo | Marketing | — | maraina@…  | Mismatch | Fix |

- Inline-editable Email column with validation (`name@domain.tld`).
- "Linked login?" derived from `profiles.staffing_person_id` — read-only, just for context.
- "Status" pill: **OK** (matches profile email), **Mismatch** (profile linked but address differs), **Missing** (no email), **Unlinked** (no profile yet).
- Saving an email writes to `staffing_people.email`. Because every personal dashboard / Home / staffing-aware view already resolves the current user via `profiles.staffing_person_id` → `staffing_people.*`, updating this field automatically flows through to the BOPM's personal dashboard, "My tasks", staffing rows, etc. No extra plumbing needed beyond a single cache refresh.
- Bulk filter: "Show issues only" toggle to surface just rows with Mismatch / Missing / Unlinked.

---

## Cross-cutting behavior

- All three views share the same `useStaffingData()` state — drag/drop, deletes, edits in any one view are reflected live in the others.
- Optimistic UI for every mutation (matches the existing `addPerson` / `updatePerson` / `deletePerson` pattern), with toast confirmation.
- The existing **Revenue Capacity drag-drop table** further down the Settings page is unchanged.

---

## Technical details

- **Schema change** — add a single nullable column `sub_team text` to `public.staffing_people` (migration). This is what powers the "Add Sub-team" capability without overloading existing fields. Type regenerates automatically.
- Map it on the client as `Person.subTeam?: string` and add it to `personToDb` / `personFromDb` in `src/data/staffingData.ts`.
- New components in `src/components/settings/`:
  - `PeopleTreeView.tsx` — recursive collapsible tree with `@dnd-kit` (PointerSensor reused from Settings.tsx). Drop targets: team headers, sub-team headers, and individual person rows.
  - `OrgChartView.tsx` — recursive horizontal layout built from a `Map<reportingManagerName, Person[]>`. Uses simple flex-column children with connector lines (CSS borders, no graph lib).
  - `EmailMappingTable.tsx` — table reusing the existing `InlineEdit` pattern; cross-references `profiles` (read-only fetch, same query already used in `useAppUsers`).
  - `AddPersonDialog.tsx` and `AddTeamDialog.tsx` — small shadcn dialogs.
- Refactor `src/pages/Settings.tsx` so the People & Reporting block becomes a thin shell with a 3-button view switcher (Tree / Org Chart / Email Mapping) and renders the appropriate component. Existing inline-table view is removed.
- Drag rules:
  - person → team header: `updatePerson(id, { department: T, subTeam: "" })`
  - person → sub-team header: `updatePerson(id, { department: T, subTeam: S })`
  - person → another person row: `updatePerson(id, { reportingManager: target.name })` with the self-loop guard
- Email edit propagation: writing `staffing_people.email` is enough — `useStaffingData`'s realtime subscription already broadcasts the update to every screen that reads people, including Home / personal dashboard.
- All semantic colours stay on the existing tokens (foreground / muted-foreground / destructive); leaving = `destructive`, OK = `success`/green token, mismatch = `warning`/amber, missing = `muted`.
