## Plan

### 1. Fix VSD deal visibility immediately
- Update the central deal-access logic so a VSD like Aditya Shaw sees every deal where the deal rolls up to that VSD.
- Use the same VSD hierarchy logic already used in MBR/RGY filters: principal BOPM / senior BOPM mapping first, then fallback to the deal's VSD field.
- Keep BOPMs restricted to only their directly tagged/staffed deals.
- Ensure VSDs are read/view scoped by their pod and not accidentally treated like BOPMs.

### 2. Make role/persona access configurable from Settings → Access Controls
- Expand the Access Controls page from “visibility toggles + descriptive summaries” into actual enforced access settings.
- For every app section, admins will be able to set access for:
  - Admin
  - VSD
  - BOPM
  - View Only
- Each section will support real modes:
  - Hidden
  - View only
  - Editable
- The page will clearly show VSD and BOPM defaults for Clients & Deals, Staffing, MBR Tracker, RGY Health, Dashboard, Revenue, Targets, etc.

### 3. Persist access changes so the whole app reflects them
- Store section access changes in the existing backend access tables where possible.
- Add/use `access_mode` for role-level route access, not only per-user overrides.
- Update `useUserRole` so route access uses the configured mode directly:
  - hidden → page hidden/redirected
  - read → page visible but read-only
  - edit → page visible and editable
- Add realtime/subscription refresh or explicit cache refresh so admin changes apply without needing hard reload where practical.

### 4. Enforce read-only/edit permissions in key app areas
- Apply route-level edit permissions to major editable pages:
  - Clients & Deals
  - Staffing & Capacity
  - MBR Tracker
  - RGY Health
  - Home tasks where applicable
- If a role is set to “View only,” hide/disable edit buttons and block edit handlers with a clear toast.
- Preserve current deal-level scoping:
  - VSD sees their VSD pod deals
  - BOPM sees only their own deals
  - Admin sees all

### 5. Add VSD/BOPM access diagnostics inside Access Controls
- Add a compact “Role scope preview” section for admins:
  - shows key demo/real users such as Aditya Shaw, Neema, Ritu, Tiffany, Shreshtha
  - shows linked staffing person, role title, route mode, visible deal count
  - flags broken mappings, e.g. duplicate profiles or missing `staffing_person_id`
- Add a quick repair path for demo accounts so Aditya/VSD demo logins are linked to the correct staffing person and role.

### 6. Clean up duplicate/incorrect demo profile issue
- The database currently has duplicate Aditya profile rows, including one with no staffing person mapping; this can cause a login to have zero visible deals.
- Update demo provisioning to always:
  - create/reset demo users
  - link the profile to the correct `staffing_person_id`
  - assign the correct access persona
  - avoid leaving duplicate unlinked demo profiles in a broken state

## Technical details

- Files to update:
  - `src/hooks/useDealAccess.ts`
  - `src/hooks/useUserRole.ts`
  - `src/pages/admin/AccessControlsTab.tsx`
  - `src/pages/admin/UsersTab.tsx` if needed for per-user overrides consistency
  - key editable screens: `Clients.tsx`, `Staffing.tsx`, `MBRTracker.tsx`, `RGYHealth.tsx`
  - `supabase/functions/admin-user-mgmt/index.ts` for demo repair
- Backend changes:
  - Add `route_visibility.access_mode` if missing.
  - Backfill existing rows: visible=true becomes edit/read depending on role defaults; visible=false becomes hidden.
  - Keep roles in `user_roles`; do not store roles on profiles.
  - Maintain admin-only write policies for access-control tables.

## Expected result

- Aditya Shaw and other VSDs can see their VSD pod deals.
- BOPMs still only see their assigned/tagged deals.
- Admins can change Viewer/View-only and broader VSD/BOPM access from Settings → Access Controls.
- Changes in Access Controls affect navigation visibility and editability across the app instead of being only descriptive text.