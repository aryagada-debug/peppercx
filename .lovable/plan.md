## 1. Gate RGY edit by role + staffing title

**New hook** `src/hooks/useCanEditRgy.ts`:

- Returns `true` if `actualRole` is `admin`, `member` (VSD) or `capability_lead`.
- Otherwise resolves the signed-in user's `staffing_people.role_title` (via `profiles.staffing_person_id` → `staffing_people`) and returns `true` when the normalized title is one of: `principal_bopm`, `senior_bopm`, `vsd`, or matches "group bopm".
- Plain "BOPM" → `false`.

**Apply in:**

- `EditableRGY` (Deal Detail RGY tab) — disable status buttons + "Raise intervention" prompt when read-only; show a small "Read-only — only Sr/Principal/Group BOPM, VSD or Admin can edit" hint.
- `MarkRGYDialog` trigger in `RGYHealth.tsx` — hide/disable the "Mark RGY" button per row for non-editors.
- `RGYCombinedIssuesDialog` save button — disable when read-only.

## 2. Show all staffed people in assign-issue popup

In `RGYCombinedIssuesDialog` usages, replace the 4-name (VSD + 3 BOPM) `assigneeNames` list with everyone staffed on the deal:

- **RGYHealth.tsx (combinedIssuesDeal block):** fetch the deal's `staffing_assignments` joined with `staffing_people.name` once when the dialog opens, dedupe, and pass to `assigneeNames`. Fall back to the 4 BOPM/VSD names if there are no assignments.
- **DealDetail.tsx:** already merges `dealPeople`; verify `dealPeople` includes everyone in `staffing_assignments` (not just BOPM roles) and broaden the query if it filters.

No schema change.

## 3. Flag leadership intervention — make deal clickable (both places)

- `**RaiseInterventionDialog`:** when `dealId` is pre-filled, replace the locked `<div>` with a row that shows the deal label and a small "Change" link that swaps to the existing searchable picker. Selected deal still defaults to `dealId`.
- `**LeadershipInterventions.tsx`:** wrap the deal cell `<td>` content in a `<Link to={`/deals/${r.deal_id}`}>` (stop row click propagation) so clicking the deal label opens the deal in a new tab, while clicking elsewhere on the row still opens the drawer.
- `**InterventionDrawer`:** turn the `SheetDescription` deal label into a `Link` to `/deals/:dealId`.

## 4. Org mapping required fields

In `src/components/deals/orgmap/OrgMappingTab.tsx` (`DetailPanel`):

- Mark Name, Role/title, Email, LinkedIn, Function, Seniority as required (red asterisk on `<Field>` labels).
- On blur of any required field, if empty show inline error and revert (don't save empty).
- Add a row-level validity badge in the table: rows missing any required field show an amber "Incomplete" pill.
- Block `add()` from auto-saving "New stakeholder" as final — keep current behaviour (row is created, immediately opened for edit) but show the row as Incomplete until all required fields are filled.
- Block `duplicate()` only if source is complete (it will be — duplicates inherit values).
- Phone stays optional.

Validation helper lives in the same file.

## 5. Google sign-in for all email/password users

**Migration (data update via supabase--insert):**

- Set `email_confirmed_at = now()` on every `auth.users` row where `email_confirmed_at IS NULL` AND `email ILIKE '%@peppercontent.io'`. This lets Lovable Cloud auto-link a Google sign-in to the existing account when emails match.

**Login UX (`src/pages/Login.tsx`):**

- After `lovable.auth.signInWithOAuth("google", …)` returns, if `result.error` includes "User already registered" / "Email link" / generic failure, show a precise toast: "Your account exists with email/password. Please sign in with your password, or contact admin to enable Google for your account."
- On success, verify `supabase.auth.getSession()` and route to `/home`.

No `hd:` domain restriction (per user choice).

---

### Technical notes

- `useCanEditRgy` caches the result per user (single fetch on mount). Uses `useAuth` + a small `useQuery` against `profiles` joined to `staffing_people`.
- `staffing_assignments` query for assignees: `select person_id, staffing_people(name) where staffing_deal_id = eq.<id>`.
- No new tables, no RLS changes.
- Existing `normalize_staffing_role_key` DB function already maps "Group BOPM" → `principal_bopm`; we'll mirror that mapping client-side in `useCanEditRgy` so the check is one round-trip.

### Files touched

- new: `src/hooks/useCanEditRgy.ts`
- edit: `src/components/deals/EditableRGY.tsx`, `src/components/rgy/MarkRGYDialog.tsx` (trigger guards in pages), `src/components/rgy/RGYCombinedIssuesDialog.tsx`, `src/components/rgy/RaiseInterventionDialog.tsx`, `src/components/rgy/InterventionDrawer.tsx`, `src/pages/RGYHealth.tsx`, `src/pages/DealDetail.tsx`, `src/pages/LeadershipInterventions.tsx`, `src/components/deals/orgmap/OrgMappingTab.tsx`, `src/pages/Login.tsx`
- data migration: bulk `UPDATE auth.users SET email_confirmed_at = now() …` via insert tool.