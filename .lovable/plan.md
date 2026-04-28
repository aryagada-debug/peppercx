## Goal

Make **Settings → Users** the single source of truth for every people picker, filter, and grouped report in the app. Anyone referenced on a deal but not a registered user shows under **"Other"** in RGY and MBR tables. No separate people directory.

## Current state (why this needs care)

- `profiles` table has only **2 registered users** (Shashwat Sood, Sneha Iyer).
- `staffing_people` has **186 active people**, but only **1** has an email recorded.
- Deals reference **13 distinct VSDs** and **~30 distinct BOPMs** by free-text name.
- "Provision from People" already exists in Settings → Users but is blocked when emails are missing.

If we flip the source today without fixing emails, virtually everyone collapses into "Other". So the plan is **emails → provision → refactor → cleanup**, in that order.

## Plan

### 1. Email collection in Settings → Users (one-time prep)

- In the existing "People needing email" panel in `UsersTab.tsx`, surface **all 185 people without emails** (not just on demand) with a clear banner: *"185 people need an email before they can be synced as users."*
- Pre-populate a reasonable guess (`firstname.lastname@peppercontent.io`) as a placeholder the user can accept or edit.
- Add a **"Save all guessed emails"** bulk action and a CSV import option (paste/upload `name,email` pairs) so the user can fill 100+ emails in one go instead of one-by-one.
- Sort the list to put **VSDs and BOPMs that appear on active deals first** so the highest-value names get emails first.

### 2. Bulk provisioning (existing flow, sharpened)

- Re-use the existing `admin-user-mgmt` `bulk_provision` action — no new edge function needed.
- After provisioning, the new auth users automatically get a `profiles` row via the existing `handle_new_user` trigger.
- A name-matching back-fill fills `profiles.staffing_person_id` so we can map deal text fields ("Neema Jayadas") to the new user IDs.

### 3. Single people hook

Create `src/hooks/useAppUsers.ts` — the only place anything reads people from. It returns:

```ts
{ users: AppUser[]; byName: Map<string, AppUser>; byId: Map<string, AppUser>; loading }
```

Backed by `profiles` + `user_roles` (with realtime subscription so adding a user in Settings instantly updates every dropdown). All other code stops reading `staffing_people` for picker/filter purposes.

### 4. Refactor all pickers + filters to use `useAppUsers`

Replace hard-coded name lists and `staffing_people` reads in:

- **RGY Health** (`src/pages/RGYHealth.tsx`) — `VSD_FILTERS`, BOPM tabs, dropdowns. Hard-coded list of 5 VSDs is removed.
- **MBR Tracker** (`src/pages/MBRTracker.tsx`) — VSD/BOPM filters, drill dialog, insights table.
- **Deals & Clients** (`DealFormWizard.tsx`, `Clients.tsx`) — VSD/BOPM/owner pickers.
- **Staffing** (`MatrixTab.tsx`, `AddStaffingMemberDialog.tsx`, `PeopleLevelView.tsx`, etc.) — assignment pickers.
- **Tasks** (`TaskFormDialog.tsx`, `CxTaskFormDialog.tsx`, `CxAssigneePopover.tsx`) — assignee pickers.
- **Home / Index** dashboard groupings.

`staffing_people` is **kept** as the operational table for HR-style metadata (band, hourly rate, reporting manager, capacity allocations) but no longer drives any picker UI. It becomes "extended attributes" on a user.

### 5. "Other" bucketing in RGY & MBR tables

In the VSD and BOPM grouping logic for `RGYHealth.tsx`, `MBRTracker.tsx`, and `useMBRData.ts`:

- Build the row set from `useAppUsers` (registered users only).
- Any deal whose `vsd` / `bopm` text doesn't match a registered user's display name is grouped under a single **"Other"** row.
- Empty / "Not Assigned" / "To Be Assigned" stays under **"Unassigned"** (existing bucket).
- Drill-downs on the "Other" row show which raw names contributed, so the user can see exactly who still needs to be added.

### 6. Cleanup pass

- Remove the `NAMED_VSDS` hard-coded set in `RGYHealth.tsx`.
- Delete unused mock arrays in `src/data/dashboardMocks.ts` related to people.
- Update memory `mem://features/people-management` to reflect Users as source of truth.

## Open question handled inline

The 185 missing emails is the real blocker. Step 1 (bulk paste/CSV + guessed defaults) lets you fill them in minutes rather than one at a time. If you'd rather skip that and accept that everyone except the 2 current users lives under "Other" until provisioned individually, say the word and I'll skip step 1.

## Files touched (technical)

- New: `src/hooks/useAppUsers.ts`
- Edited (pickers/filters): `src/pages/RGYHealth.tsx`, `src/pages/MBRTracker.tsx`, `src/hooks/useMBRData.ts`, `src/pages/Clients.tsx`, `src/components/deals/DealFormWizard.tsx`, `src/components/staffing/MatrixTab.tsx`, `src/components/staffing/AddStaffingMemberDialog.tsx`, `src/components/staffing/PeopleLevelView.tsx`, `src/components/deals/TaskFormDialog.tsx`, `src/components/cx/CxTaskFormDialog.tsx`, `src/components/cx/CxAssigneePopover.tsx`, `src/pages/Home.tsx`, `src/pages/Index.tsx`
- Edited (provisioning UX): `src/pages/admin/UsersTab.tsx`
- DB: no schema changes needed; just data inserts (`UPDATE staffing_people SET email = ...`) when you fill emails, and the existing trigger fills `profiles` when accounts are provisioned.
