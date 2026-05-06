## Goal
1. Make `staffing_assignments` the single source of truth for every staffing read/write across the app, including approval-gated flows.
2. Fix the Staffing & Capacity table dropdown so it actually shows the right people for each role column (today it under-matches because it requires an exact `roleTitle` string).

## What changes

### 1. Accurate role → people mapping (table dropdown)
Rewrite `peopleForRole(roleKey, allPeople)` in `BopmStaffingFlatTable.tsx` with tiered resolution and grouped results:

- **Tier 1 — Exact match**: `roleTitle` ∈ `ROLE_TO_PEOPLE_FILTER[roleKey]` (current behavior).
- **Tier 2 — Designation/keyword match**: per role, match common HRIS designations
  (e.g. SEO roles match "SEO" + seniority keywords like "Director", "Group Head", "Manager", "Analyst";
  Content matches "Editor" / "Managing" / "Content Lead";
  Creative matches "Creative Director" / "ACD" / "Designer" / "Strategy";
  Video matches "Producer" / "Editor").
- **Tier 3 — Same category**: any active person whose `roleCategory` equals the slot's category.
- Always exclude `leaving === true`.

The picker renders three labeled sections:
- **Best match** (Tier 1)
- **Same role family** (Tier 2 ∖ Tier 1)
- **Other team members** (Tier 3 ∖ Tier 2), collapsed by default

Manager constraint becomes a **soft sort**, not a hard filter:
- People reporting to the senior teammate appear at the top of each section.
- Others remain visible (avoids today's "0 candidates" dead-end).

A small footer toggle "Show all team members" expands Tier 3 inline if the user wants the broadest view.

The "+ Add" empty-cell picker uses the same resolver, so both paths benefit.

### 2. Single source of truth for staffing edits
- All UI edits already route through `useStaffingData` → `staffing_assignments`. Audit confirmed no other component writes to `staffing_assignments` directly.
- Approval-gated edits go through `approval_requests` → `approval-execute` edge function, which writes to the same `staffing_assignments` table. The function already persists `start_date` and `end_date` for `staffing.add` and `staffing.update`. No changes needed there.
- Add a realtime listener in `BopmStaffingFlatTable` on `approval_requests`:
  - When a request authored by the current user flips to `approved` / `rejected` / `cancelled`, drop the matching staged drafts so the UI stops showing duplicate "pending" chips next to the now-persisted row.
- Expose `refetchAssignments` from `useStaffingData` (lightweight) so the listener can force a refresh on approval flips even if the realtime row event lags.

### 3. Inline date pickers stay
Already in place. Confirmed they flow `startDate` / `endDate` through staged adds and updates into both the direct-write and approval payloads.

## Files touched
- `src/components/staffing/BopmStaffingFlatTable.tsx` — tiered resolver, grouped picker sections, soft manager sort, approval-status realtime listener.
- `src/data/staffingData.ts` — small helper map: role → designation keywords used by the resolver.
- `src/hooks/useStaffingData.ts` — export `refetchAssignments`.
- (No edits to `approval-execute`; verified it already writes the same table.)

## Out of scope
- No DB schema changes.
- No new tables; staffing_assignments remains the single store.
- No changes to People view, Matrix view, or AccountsTab — they already use the same hook handlers.
