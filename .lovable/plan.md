## Goal

Replace the "Invite via signup link" link in Settings → Users & Roles with an **Add user** button that opens a comprehensive dialog. Admins can create a fully working account in one shot — auth login + profile + app role + linked person in the People directory — without sending the user through self-signup.

## UI changes

`src/pages/admin/UsersTab.tsx`
- Remove the `<a href="/signup">Invite via signup link</a>` anchor.
- Add an **Add user** button (primary style, `UserPlus` icon) that opens a new `AddUserDialog`.
- On success, refresh the list and toast `"<name> added. Password: Pepper@2026"` (or custom).

## New component

`src/components/settings/AddUserDialog.tsx` — one dialog with logically grouped sections:

**1. Account (auth)**
- Full name * 
- Work email * (validated, lowercased, uniqueness checked server-side)
- Password (defaults to `Pepper@2026`, editable, "auto-confirm email" always on for admin-created accounts)
- App role * — Admin / Capability Lead / Member / User (uses existing `ROLE_LABELS` / `ROLE_ORDER`)

**2. Link to person directory**
- Radio: *Link to existing person* vs *Create new person*
- If existing: searchable select of `staffing_people` (shows name + current email + designation). Useful when the person already exists from the Google Sheet sync but has no login yet.
- If new: same fields as the existing `AddPersonDialog` — Department (taxonomy), Role type (taxonomy), Legacy team, Sub-team, Designation, Band, Reports to, Region (default India), tbh=false.

**3. Initial access (optional, collapsible)**
- Per-route overrides table (same widget already used in the Overrides dialog) so admin can grant `hidden / read / edit` per route at creation time. Default: inherit from role.

Validation, inline errors, single **Create user** button (disabled while saving). Cancel resets state.

## Backend

Add one new action to `supabase/functions/admin-user-mgmt/index.ts`: **`create_user`**. Already protected by the existing admin-only guard at the top of the file.

Payload:
```ts
{
  action: "create_user",
  email, password, full_name, role,           // auth + role
  link_mode: "existing" | "new",
  person_id?: string,                          // when existing
  new_person?: {                               // when new
    name, email, department, sub_team, designation, band,
    reporting_manager, department_id, role_type_id, region
  },
  overrides?: { route_key, access_mode }[]
}
```

Server flow (all using service-role admin client):
1. Reject if email already exists in `auth.users` (return clear error).
2. If `link_mode === "new"`: insert into `staffing_people` (generate `id` like `p_<slug>`, leaving=false, tbh=false). Capture `person_id`.
3. `auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })`.
4. `profiles.upsert({ user_id, display_name: full_name, staffing_person_id: person_id })` — overrides whatever `handle_new_user` trigger guessed.
5. Replace any auto roles: `delete from user_roles where user_id` → `insert { user_id, role }`.
6. If `overrides` provided, insert into `user_route_overrides`.
7. Return `{ user_id, person_id, email, password }`.

Errors at any step roll back best-effort (delete the auth user if profile/role write fails) and return a 4xx/5xx with a readable message.

## Files touched

- `src/pages/admin/UsersTab.tsx` — swap signup link for Add user button, wire dialog, refresh on success.
- `src/components/settings/AddUserDialog.tsx` — new.
- `supabase/functions/admin-user-mgmt/index.ts` — add `create_user` action.

## Out of scope

- No email-sending invite flow (matches current "Provision from People" behaviour — admin shares the password manually).
- Capability group membership stays in its own Access Controls tab; not duplicated here.