## Problem

In the Staffing → Table view (used by BOPMs and admins), the **Principal BOPM** and **Senior BOPM** columns appear empty for most deals. They are populated only from rows in `staffing_assignments` where `role_key = 'principal_bopm' / 'senior_bopm'`, and those rows are sparse (verified: out of Shreshtha's 18+ tagged deals, only 2 have a `senior_bopm` assignment row).

However, the **deal sheet itself** has these fields filled in (`staffing_deals.principal_bopm`, `staffing_deals.senior_bopm`). They are the canonical source of truth — used by access scoping, MBR, account activity, etc. — but the Staffing table doesn't display them, so the BOPM grid feels "broken" to people like Shreshtha who know they're tagged on those deals.

## Goal

1. **Fill Principal/Senior BOPM cells** in `BopmStaffingFlatTable` from the deal record when no explicit assignment row exists, so the column is never blank for a deal that names a BOPM on the sheet.
2. **Keep one source of truth**: deal sheet text fields (`principal_bopm`, `senior_bopm`, `bopm`, `vsd`) drive the mapping. Assignment rows for those role keys are an *override only* (i.e., when somebody has explicitly staffed an additional / different BOPM with an allocation).
3. Use the same name-resolution logic everywhere (the existing `dealCellMatchesPerson` from `useAppUsers.ts`) so identity stays consistent across Staffing, Capacity, Clients, Deals, MBR, and Access.

## Approach

### A. Virtual assignments derived from the deal sheet

In `BopmStaffingFlatTable.tsx`, when building `dealRoleMap`, after collecting real assignments + drafts, **synthesize read-only virtual entries** for `principal_bopm`, `senior_bopm`, and `bopm` whenever:

- the deal has a non-blank value in that field, AND
- no real assignment already exists for that `(dealId, roleKey, personId)` pair.

For each comma-separated name in the cell:
- Resolve it to a `Person` via `dealCellMatchesPerson(cellName, person.name, allPersonNames)` against `allPeople`.
- If resolved → create a virtual entry `{ assignmentId: "virtual:{dealId}:{roleKey}:{personId}", personId, allocationPct: 0, isVirtual: true }`.
- If unresolved → still render the raw text as a non-clickable chip so the user sees it ("Shreshtha P" → grey chip, hover tooltip "No matching profile in People").

Virtual entries:
- Render with the regular cell layout but slightly muted, no edit affordances, no draft staging.
- Allocation hours appear as "—" (no `allocation_pct`, since it's not really a workload claim).
- Ignored from drag/drop, removal, draft submission paths.

This keeps the existing approval / direct-edit flow untouched for real assignments, while filling the visible gap.

### B. Same data shown in DealViewTab drill-down

In `DealViewTab` (Deals view, used by Admins/VSDs), expand the deal drill-down row to show **Principal BOPM**, **Senior BOPM**, and **BOPM** columns (currently only Deal/Account/Type/Status/MRR/Staffing/Team are shown). Source: deal record fields directly. This makes the same identity visible across the two staffing views.

### C. Sync identity resolution

Confirm a single resolver path is used everywhere a deal-cell name needs to map to a Person:

- `useDealAccess.ts` — already uses `dealCellMatchesPerson`.
- `useAppUsers.ts › vsdForDeal` — already uses canonical resolution.
- `BopmStaffingFlatTable` (new virtual assignments) — will use `dealCellMatchesPerson`.
- `DealViewTab` drill-down — pure text display, no resolver needed.
- `PeopleViewTab` (Capacity) — already filters via `dealMatchesBopm` (which uses the same resolver).

No new resolution logic; the four callsites that touch BOPM matching all funnel through `dealCellMatchesPerson` with the `useAllPersonNames()` registry as the ambiguity guard.

### D. Audit / verification step (post-implementation)

Run a quick database read for ~3 BOPMs (Shreshtha Pathak, Preet Desai, Eshika Joshi) listing:
- deals where they appear in the deal sheet (`vsd / principal_bopm / senior_bopm / bopm`),
- vs. deals where `useDealAccess` would grant them visibility,
- vs. deals where they appear in `BopmStaffingFlatTable` (virtual + real).

These three sets should be identical for each tier. Document mismatches (if any) in a follow-up note.

## Files to edit

- `src/components/staffing/BopmStaffingFlatTable.tsx` — synthesize virtual `principal_bopm` / `senior_bopm` / `bopm` cell entries from the deal record; render as read-only chips; gate edit handlers on `isVirtual`.
- `src/components/staffing/DealViewTab.tsx` — add Principal BOPM / Senior BOPM / BOPM columns to the expanded deal sub-table.
- (No changes to `useAppUsers.ts`, `useDealAccess.ts`, `BopmFilter.tsx` — the resolver and scoping are already correct after the previous round.)

## Out of scope

- Backfilling actual `staffing_assignments` rows from deal-sheet BOPM text. The deal sheet stays the single source of truth; assignments are the override layer.
- Changing how non-BOPM roles (designers, editors, etc.) are sourced — those continue to come from `staffing_assignments` only.
