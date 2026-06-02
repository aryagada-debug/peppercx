## Goal
Make deal visibility consistent everywhere:
- VSDs: see deals they are tagged on, plus deals where their P/Sr BOPMs/BOPMs under them are tagged.
- P/Sr BOPM, BOPM, and other individual users: see only deals they are tagged on.
- Capability leads: see deals they are tagged on, plus deals tagged to people under them.
- Admins: continue seeing everything.

## Findings
- Most logged-in profiles point to old `staffing_person_id` values such as `p_aamir_khan`, but the current staffing records use IDs like `P112`.
- Because `useDealAccess` starts from `profiles.staffing_person_id`, many users resolve to no current person record, so their visible deal set becomes empty.
- This affects the main Clients/Deals route and also other features that rely on the same person mapping.
- Some pages apply `useDealAccess` only to BOPM personas, so VSD and capability-lead views can be inconsistent across Home, MBR, RGY, Targets, Staffing, and Clients.
- `/deals` currently redirects to `/clients`; the real Deals tab data is the Clients page/table, while `src/pages/Deals.tsx` is a stale static page and not routed.

## Implementation plan

### 1. Repair existing profile-to-person links
Use a safe data update to relink profiles whose `staffing_person_id` points to a non-existent person, matching them to the current `staffing_people` row by normalized display name.

Expected immediate effect:
- VSD profiles for Aditya Shaw, Neema Jayadas, Aamir Khan, Sneha Iyer, and Sumit Shekhawat will resolve to current person IDs.
- Most BOPM/capability-user profiles with matching current people will start resolving correctly.
- Profiles that cannot be safely matched by name will be left unchanged rather than guessed.

### 2. Add a resilient current-person resolver in code
Centralize user identity resolution so every feature uses the same logic:
1. Try `profiles.staffing_person_id` if it exists in current `staffing_people`.
2. If stale/missing, match by authenticated email.
3. If still unresolved, match by normalized profile display name.
4. Return the current person row: ID, name, role title, role category, designation, email, reporting manager.

This prevents future imports/syncs from breaking visibility if IDs drift again.

### 3. Rebuild `useDealAccess` around assignments + hierarchy
Update the shared deal-access hook to use current staffing assignments as the source of truth, with deal-ID sibling expansion for `d_{id}` and `PC..._{id}` records:
- Direct users: visible deals = their own assignment deal IDs and matching active sibling records.
- VSDs: visible deals = their own assignment deals + deals where people in their reporting chain are assigned as `principal_bopm`, `senior_bopm`, or `bopm`.
- Capability leads: visible deals = their own assignment deals + all assignment deals for direct/indirect reportees.
- Admins: unchanged, all deals.

This avoids relying only on cached text columns like `vsd`, `principal_bopm`, and `senior_bopm`, while still keeping the existing name-cell matching as a fallback where useful.

### 4. Apply the same scope across app pages
Update pages/components that currently perform their own partial scoping:
- Clients/Deals: keep using `useDealAccess`, but rely on the fixed resolver/scope.
- Staffing: keep the same scoped behavior, now backed by correct access IDs.
- Home dashboard: use the shared access set consistently; remove stale-profile dependency for own staffed deals.
- MBR Tracker: scope all non-admin users via `useDealAccess`, not only BOPMs.
- RGY Health: keep non-admin scoping, but ensure VSD summary/AI deal logic uses the same visible deal set.
- Targets: keep using `useDealAccess`; it will inherit the corrected scope.
- BOPM/VSD filters: resolve the current viewer through the shared resolver so VSD filter options don’t disappear because of stale IDs.

### 5. Verify with database diagnostics and app checks
After changes:
- Confirm stale profile links drop for all safely matchable users.
- Confirm each named VSD has a non-zero visible PC/active deal count.
- Confirm sample P/Sr BOPM/BOPM users only get directly assigned deals.
- Confirm sample capability leads include self + reportee assigned deals.
- Check Clients, Staffing, MBR, RGY, Home, and Targets use the same visible deal set for non-admin personas.

## Technical details
- Data repair will use the data-change tool, not a schema migration.
- No new tables are needed.
- No changes to generated Lovable Cloud client/type files.
- The central resolver will be a small reusable frontend helper/hook, then existing repeated profile lookups will be replaced where they affect visibility or filters.