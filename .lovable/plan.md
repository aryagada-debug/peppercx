## Goal
Fix deal visibility so every persona sees the right deals consistently across the app, and harden the underlying schema so this class of bug stops recurring.

## Why the numbers don't match today
- Admin view of Aditya Shaw: 15 deals → from active deals where the text cell `staffing_deals.vsd` contains "Aditya Shaw" (12 Active + 1 SLA/PO + 2 Disputed).
- Aditya's own login: 6 deals → because `useDealAccess` filters those same deals through additional client-side guards that drop legitimate matches:
  1. The conflict guard inside `dealCellMatchesPerson` rejects matches when another person in `staffing_people` shares a first name (e.g. multiple "Aditya"/"Shreshtha" variants in registry).
  2. The Geo filter on Clients also culls deals before they reach the UI.
  3. VSD pod expansion (deals where his P/Sr BOPMs like Shreshtha Pathak are tagged but his `vsd` cell is blank) depends on `staffing_people.reporting_manager` being an exact name string — many rows don't match cleanly, so the team set comes back partial.
- Compounding data issue: Aditya has two `auth.users` rows (`adityashaw@…` and `aditya.shaw+demo@…`) both pointing to person `P437`, and other users still have legacy `staffing_person_id` slugs like `p_aditya_p` that don't exist in `staffing_people`.

The real fix is to stop deriving visibility from free-text deal cells + name matching, and instead drive it from a normalized assignment + hierarchy model on the server.

## Implementation plan

### 1. Schema hardening (migration)
- Add `staffing_people.manager_person_id text` (nullable, FK-style reference to `staffing_people.id`).
- Backfill `manager_person_id` from current `reporting_manager` text using normalized name match, and log unresolved rows.
- Add `profiles` uniqueness/repair:
  - Ensure unique index on `profiles.user_id` (verify; add if missing).
  - Add partial index on `lower(email)` in `auth.users` lookups via a helper view (no change to auth schema).
- Add a `staffing_deal_access` SQL view (security_invoker) that returns one row per `(deal_id, person_id, access_reason)` derived from:
  - direct `staffing_assignments` rows (role-aware: vsd / principal_bopm / senior_bopm / bopm / capability roles), and
  - normalized matches of `staffing_deals.vsd|principal_bopm|senior_bopm|bopm` text cells against current `staffing_people.name` (kept as a transitional fallback only).
- Add a `SECURITY DEFINER` function `public.visible_deal_ids_for_user(uid uuid) returns setof text` that:
  - Resolves the user's person via fallback chain: `profiles.staffing_person_id` → `auth.users.email` → normalized `profiles.display_name`.
  - Walks `manager_person_id` to collect the full reporting subtree.
  - Returns deal IDs based on persona:
    - Admin → all deals.
    - VSD (detected by role title/category OR by being a manager in the subtree of known VSD names) → own assigned deals + every deal assigned to anyone in their subtree.
    - Capability lead → own + subtree assigned deals (same shape as VSD).
    - P/Sr BOPM, BOPM, capability member, other → only deals where this person is in `staffing_assignments` for the matching role, plus deals where their canonical name appears in the corresponding text cell.
- Grant `EXECUTE` on the function to `authenticated`.

### 2. Data repair (insert tool, not migration)
- Backfill `staffing_people.manager_person_id` from `reporting_manager`.
- Relink stale `profiles.staffing_person_id` values that no longer exist in `staffing_people` to the current person by `lower(email)` then by normalized `display_name`. Leave unresolved rows untouched and surface a diagnostic count.
- Collapse the duplicate Aditya Shaw login: keep the canonical `adityashaw@peppercontent.io` row, mark the `+demo` profile as inactive (do not delete auth user; just clear `staffing_person_id` and flag in display_name).

### 3. Replace client-side access logic
- Rewrite `src/hooks/useDealAccess.ts` to:
  - Call `visible_deal_ids_for_user` once via RPC (cached by React Query, 5 min stale).
  - Drop the conflict-guard name matching, first-name VSD heuristic, and `dealCellMatchesPerson` dependency for visibility purposes.
  - Keep the same `DealAccessState` shape so consumers don't change.
- Remove the parallel VSD-name resolution effect in `src/pages/Clients.tsx` (lines 199–219) and source `isVsdViewer` from the hook.

### 4. Apply the same scope everywhere
- `Clients.tsx`, `Staffing.tsx`, `MBRTracker.tsx`, `RGYHealth.tsx`, `Targets.tsx`, `Home.tsx`: keep using `useDealAccess`; verify each gates non-admin views by `!access.isAdmin` (not by persona-specific flags). Fix any that still branch on `isBopm` only.
- Ensure Geo filter is applied after access filter and never widens it.

### 5. Verification
- DB checks: for each of the 5 VSDs, `visible_deal_ids_for_user` should return all active deals where (a) their `vsd` cell matches OR (b) any subtree person is in `staffing_assignments`. Compare to admin counts and ensure they reconcile.
- Spot-check a P/Sr BOPM (Shreshtha Pathak) and a regular BOPM see only their tagged deals.
- Spot-check a capability lead sees their own + reportees' deals.
- App check on `/clients`, `/staffing`, `/mbr`, `/rgy`, `/home`, `/targets`: same deal set for the same logged-in user.

## Technical notes
- No changes to generated Supabase client/types files; the RPC will appear automatically after migration.
- The new view + function are additive; existing read paths keep working during rollout.
- Text-cell matching remains as a transitional fallback inside the view so deals that have not been migrated to `staffing_assignments` still show up. Once assignments are the single source of truth, the fallback can be dropped.
- `reporting_manager` text column is kept for display; `manager_person_id` is the authoritative link.

Reply "approve" to run the migration + data repair and apply the code changes.