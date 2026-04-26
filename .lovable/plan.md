## Goal

Replace the current 2-role system (`admin`, `vsd`) with a **4-role hierarchy** plus **per-user route overrides**, and provision auth accounts for every person in `staffing_people`.

---

## 1. Database changes (migration)

**Expand `app_role` enum:**

- Add `view_only`, `user`, `member` (keep `admin`).
- Migrate existing rows: `vsd` → `user`. Drop `vsd` value at the end (Postgres-safe path: rename old enum, create new, alter column, drop old).

**New table `user_route_overrides`:**

```
user_id uuid, route_key text, visible boolean, PRIMARY KEY (user_id, route_key)
```

RLS: admins manage all rows; users read only their own.

**Update `route_visibility` seed** to include defaults for all 4 roles:

- `admin`: every route visible
- `member`: every route visible (but action-level edit perms still apply via UI)
- `user`: same as today's `vsd` defaults (Clients, RGY, MBR visible)
- `view_only`: same routes as `user` (read-only behavior comes from UI gating)

**Update `handle_new_user()` trigger:** default new signups → `user` (was `vsd`).

**Update `profiles` link:** ensure `staffing_person_id` is populated when we backfill.

---

## 2. Backfill auth accounts for staffing_people (~120)

Extend the existing `admin-user-mgmt` edge function with a `bulk_provision` action:

- For each row in `staffing_people` where `email` is non-empty AND no auth user exists with that email:
  - Create auth user via service-role admin API (random password, email confirmed)
  - Insert/update `profiles` with `display_name = name`, `staffing_person_id = id`
  - Insert `user_roles` with role `user`
- Skip people with blank email; surface a list of skipped names so admin can fill emails first.
- Add a **"Provision all from People"** button at the top of the Users tab that calls this action and reports `{created, skipped, errors}`.

---

## 3. Frontend — `useUserRole.ts`

- Update `AppRole` to `"admin" | "member" | "user" | "view_only"`.
- Compute `visibleRoutes` as: **role defaults from `route_visibility**` ⊕ **per-user overrides** (override wins when present).
- Add `canEditAll` (member+admin), `canEditOwn` (user+), `isReadOnly` (view_only) booleans to consumers — actual edit-gating in components is a follow-up; this PR exposes the flags so the structure is in place.

---

## 4. Frontend — `UsersTab.tsx`

- Replace the 2-state Admin/VSD badge + "Make Admin / Demote" buttons with a **role dropdown** (View Only / User / Member / Admin) per row. Saves by deleting old role row and inserting new one.
- Add **"Provision from People"** button (calls bulk action above).
- Add **"Customize Access"** button per row → opens a dialog showing all `ALL_ROUTE_KEYS` with three states each: **Inherit (role default) / Show / Hide**. Persists to `user_route_overrides`. "Inherit" deletes the override row.

---

## 5. Frontend — `AccessControlsTab.tsx`

- Expand the table from 2 role columns to **4 columns**: View Only, User, Member, Admin. Existing toggle logic works unchanged against `route_visibility`.

---

## 6. Files touched

- **New migration** — enum expansion, `user_route_overrides` table + RLS, trigger update, route_visibility reseed for new roles
- `supabase/functions/admin-user-mgmt/index.ts` — add `bulk_provision` and `set_role` actions
- `src/hooks/useUserRole.ts` — new role union, override merging
- `src/pages/admin/UsersTab.tsx` — role dropdown, provision button, customize-access dialog
- `src/pages/admin/AccessControlsTab.tsx` — 4-column layout
- `src/integrations/supabase/types.ts` — auto-regenerated after migration

---

## Out of scope (call out for later)

- Enforcing **read-only / edit-own** behavior across every page — this plan only adds the role flags; UI-level write gating across Clients, Deals, Staffing, etc. is a separate pass.
- Notifying provisioned users by email with a password reset link — can be added on top of the bulk action if you want. - Do this  
