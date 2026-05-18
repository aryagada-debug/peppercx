# Capability Lead = VSD-style, Capability IC = BOPM-style

Goal: a clean role matrix where Capability roles mirror the existing VSD/BOPM viewing patterns, scoped to the deals their capability team is tagged on.

## Behaviour

**Capability Lead (`capability_lead`)** — like a VSD, but scoped to the union of deals their capability team is staffed on:
- Sees every deal where any member of their capability is staffed (already returned by `useDealAccess` via `myTeamDealIds`).
- Sees every person on those deals.
- In Clients & Deals, gets the **VSD filter pills** (All / each VSD / Other / Unassigned) and a **BOPM filter** next to it. BOPM options narrow to BOPMs tagged on the currently visible (team-scoped) deals; when a VSD is picked, BOPM list narrows to that VSD's BOPMs.
- Same admin-style filter UI on Staffing, MBR Tracker, RGY Health, Dashboard — VSD + BOPM filter applied on top of their team-scoped deal set.
- Read-only on Clients & Deals fields (Type / Status / MRR / Total Revenue) — same lock as BOPM.

**Capability IC (`capability_member`)** — like a BOPM:
- Sees only deals they are personally tagged/staffed on (already correct in `useDealAccess`).
- Gets the BOPM persona UX everywhere: BOPM empty state, scoped tabs on Staffing, "current month only" lock on MBR, no Flags tab, no VSD pills, etc.

VSD and BOPM personas are untouched — they already work as the user confirmed.

## Technical changes

1. **`src/pages/Clients.tsx`**
   - Add `const isCapLead = role === "capability_lead";`
   - Treat `isCapLead` as admin-like for filter UI: gate the VSD pills on `access.isAdmin || isCapLead` and keep the BOPM filter visible for cap leads (skip the `isVsdViewer` branch).
   - `BopmFilter` already auto-narrows to BOPMs on the visible deals — confirm it uses the scoped `deals` list (it does via `dealMatchesBopm`), so team-scoping is implicit.
   - Extend `isBopm` / `isBopmViewOnly` to include `capability_member` so cap ICs get the same view-only locks + KPI strip the BOPM persona has. Cap leads also remain non-editable on those fields (already true because `isDealEditable` returns `access.isAdmin`).

2. **`src/pages/Staffing.tsx`**
   - Change `isBopmPersona` to `role === "user" || role === "capability_member"`.
   - Leave `isVsdPersona` as-is and add `isCapLead = role === "capability_lead"`. Treat `isCapLead` like admin for tab visibility (full deals/people/matrix/etc.), but keep deal scoping driven by `useDealAccess` so they only see team-scoped deals.

3. **`src/pages/MBRTracker.tsx`**
   - `isBopmPersona = role === "user" || role === "capability_member"`.
   - Cap leads get the full admin-style UI; VSD/BOPM filters operate on their team-scoped deals (already filtered through `useDealAccess`).

4. **`src/pages/RGYHealth.tsx`**
   - Same persona widening: BOPM persona includes `capability_member`; cap leads see the standard VSD-style filter UI.

5. **`src/pages/Index.tsx` (Dashboard)**
   - Keep dedicated `CapabilityLeaderDashboard` / `CapabilityMemberDashboard` routes (they already exist) — no change unless the user wants cap leads on the main admin-style dashboard later.

6. **No changes** to `useDealAccess` (already returns the correct deal sets for both capability roles) or to `RoleSwitcher`.

## Out of scope

- Settings → Access Controls defaults for these roles (existing route_visibility rows are kept as-is).
- Editing rights for capability roles on Clients/Deals fields — remain read-only.
