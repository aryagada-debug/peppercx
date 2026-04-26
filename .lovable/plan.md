## Goal
Add a third access layer: **per-user permission overrides** that change a user's effective access (Hidden / Read-only / Editable) on a per-section basis, while keeping their role label unchanged.

Today the system has:
- **Layer 1**: Role default visibility (`route_visibility` — show/hide per role)
- **Layer 2**: Per-user route overrides (`user_route_overrides` — show/hide per user)

This adds:
- **Layer 3**: Per-user *access mode* per section: `hidden` | `read` | `edit` | `inherit`

`inherit` falls back to the role's default behavior. `read` keeps the section visible but disables all writes for that user on that section. `edit` grants editing even if the role is otherwise read-only.

---

## 1. Database changes (new migration)

**Extend `user_route_overrides`** to carry an access mode instead of just a boolean:

```sql
-- Add access_mode column ('hidden' | 'read' | 'edit')
ALTER TABLE public.user_route_overrides
  ADD COLUMN access_mode text;

-- Backfill from existing visible flag so nothing breaks:
--   visible=true  -> 'edit' (current behavior preserves write access)
--   visible=false -> 'hidden'
UPDATE public.user_route_overrides
SET access_mode = CASE WHEN visible THEN 'edit' ELSE 'hidden' END
WHERE access_mode IS NULL;

ALTER TABLE public.user_route_overrides
  ALTER COLUMN access_mode SET NOT NULL,
  ADD CONSTRAINT user_route_overrides_access_mode_chk
    CHECK (access_mode IN ('hidden','read','edit'));

-- Make (user_id, route_key) unique so upserts work cleanly
ALTER TABLE public.user_route_overrides
  ADD CONSTRAINT user_route_overrides_user_route_uniq UNIQUE (user_id, route_key);
```

`visible` stays for backward compatibility (kept in sync: `visible = (access_mode <> 'hidden')`).

RLS policies stay as-is (admin manage, user reads own).

---

## 2. `useUserRole.ts` — compute effective access

Add a new `routeAccess: Map<string, 'hidden' | 'read' | 'edit'>` to the hook's return value.

Logic:
1. Start from role defaults: each route in the role's `route_visibility` set → `'edit'` if role is admin/member/user, `'read'` if role is `view_only`. Routes not in the role's visible set → `'hidden'`.
2. Apply `user_route_overrides`: for each row, set `routeAccess[route_key] = access_mode`.
3. `visibleRoutes` = routes whose effective access is not `'hidden'`.
4. Add helpers:
   - `canEditRoute(routeKey)` → `routeAccess.get(routeKey) === 'edit'`
   - `isRouteReadOnly(routeKey)` → `routeAccess.get(routeKey) === 'read'`

Keep existing `canEditAll` / `canEditOwn` / `isReadOnly` flags for back-compat (derived from role), but new code should use the per-route helpers when enforcement matters.

---

## 3. UI — "Customize Access" dialog in `UsersTab.tsx`

Replace the current 2-state (Inherit / Show / Hide) per-route control with a **3-state segmented control per section**:

| Section | Inherit | Hidden | Read-only | Editable |
|---|---|---|---|---|
| Dashboard | ● | ○ | ○ | ○ |
| Clients & Deals | ○ | ○ | ● | ○ |
| Revenue | ○ | ○ | ○ | ● |
| … | | | | |

- **Inherit** → delete the override row (falls back to role default).
- **Hidden / Read-only / Editable** → upsert `user_route_overrides` with corresponding `access_mode` (and `visible = access_mode !== 'hidden'`).

Header of the dialog shows the user's role + a hint: *"Role default shown in grey. Pick a custom access to override."*

Each row shows the role's default mode in muted text under the section name (e.g. "Default: Editable") so admin sees what they're overriding.

---

## 4. Enforce read-only in the UI

Read-only enforcement is opt-in per page. As a first pass:
- `ProtectedRoute` keeps using `visibleRoutes` for hide.
- New helper `useRouteAccess(routeKey)` returns `{ mode, isReadOnly, canEdit }` — pages already checking `isReadOnly` (the global flag) can switch to the per-route version where it matters most:
  - **Clients & Deals**, **Revenue**, **Targets**, **Staffing**, **MBR Tracker**, **RGY Health** — wrap their primary edit buttons / inline-edit triggers with `disabled={isRouteReadOnly}`.
- Full enforcement across every dialog is out of scope for this change; we'll wire the high-traffic edit surfaces and leave a follow-up note for niche editors.

---

## 5. AccessControlsTab — small clarifying tweak

Add a help banner: *"These are role defaults. To grant a single person edit access on a section their role can only read (or vice-versa), use Users & Roles → Customize Access."*

No schema/logic change here — it's still the global role show/hide matrix.

---

## Files touched

- **New migration**: `user_route_overrides.access_mode` + unique constraint + backfill
- `src/hooks/useUserRole.ts` — add `routeAccess`, `canEditRoute`, `isRouteReadOnly`
- `src/pages/admin/UsersTab.tsx` — 3-state segmented control in Customize Access dialog
- `src/pages/admin/AccessControlsTab.tsx` — add help banner
- A handful of high-traffic edit surfaces (Clients, Revenue, Targets, Staffing, MBR, RGY) — disable edit affordances when `isRouteReadOnly` for that route

---

## Out of scope
- Per-action permissions (delete vs edit vs admin-action) — the new layer is mode-per-section only.
- Server-side RLS enforcement of read-only — current tables use permissive RLS; read-only is enforced in the UI. Hardening RLS would be a separate, larger effort.