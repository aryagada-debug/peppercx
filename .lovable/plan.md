## Hierarchy-aware filtering for the staffing person dropdown

### Where the dropdown gets its data today

- **Source:** `staffing_people` table (Supabase), loaded by `useStaffingData` and passed in as `allPeople`.
- **Filter:** `resolvePeopleForRole()` in `src/components/staffing/BopmStaffingFlatTable.tsx` strict-matches each person's `roleTitle` against the canonical labels in `ROLE_TO_PEOPLE_FILTER` (`src/data/staffingData.ts`). Nothing else is considered — no manager chain, no pod scoping.

### What we'll change

Replace the flat global match with a **two-stage filter**:

1. **Stage 1 — Role match** (unchanged): person's `roleTitle` ∈ `ROLE_TO_PEOPLE_FILTER[roleKey]`.
2. **Stage 2 — Hierarchy / pod scope** (new):
   - **If a senior is already staffed on this deal**, only show people whose reporting line rolls up to that senior (i.e. they appear in the descendants set of any senior already staffed on the deal).
   - **If no senior is staffed yet**, fall back to the **deal's pod / business_unit** scope — only people whose `pod` matches the deal's pod (or `business_unit` for BU-scoped roles).

### Defining the hierarchy

We already have `reportingManager` (a name string) on each `staffing_people` row. We'll build a transitive "reports-to" map once per render:

```text
buildReportsToSet(seniorPersonId, allPeople) -> Set<personId>
  // BFS down the tree: person.reportingManager === senior.name
```

### What counts as a "senior" for a given role slot

Define a `ROLE_SENIORITY_PARENTS` map: for each role slot, list the role keys whose currently-staffed people on the deal define the in-scope subtree. Examples:

```text
seo_manager        -> [seo_group_head, seo_leader, vsd]
sr_seo_analyst     -> [seo_manager, sr_seo_manager, seo_group_head, seo_leader, vsd]
seo_analyst        -> [seo_manager, sr_seo_manager, seo_group_head, seo_leader, vsd]
bopm               -> [senior_bopm, principal_bopm, vsd]
senior_bopm        -> [principal_bopm, vsd]
jr_designer        -> [sr_designer, art_director, acd_art, sr_cd_art]
jr_copywriter      -> [sr_copywriter, acd_copy, cd_copy]
... etc.
```

VSD / Principal BOPM / Strategy CD / SEO Leader (top-of-tree slots) have no parents → they fall through to **Stage 2 fallback** (pod / BU scope).

### Stage 2 fallback (no senior staffed yet)

Use the deal record (already in scope as `deal`):
- Match `person.pod` to `deal.pod` (primary), OR
- Match by category-to-BU mapping already present (`BU_ROLE_CATEGORIES`) when `pod` is empty/Unassigned.

Soft sort: keep the existing manager-of-already-staffed soft-sort so direct reports float to the top of whatever set Stage 2 returns.

### Files to edit

- `src/data/staffingData.ts`
  - Add `ROLE_SENIORITY_PARENTS: Record<string, string[]>`.
  - Add a small helper `getDescendantPersonIds(rootName: string, allPeople: Person[]): Set<string>` that walks the `reportingManager` graph.
- `src/components/staffing/BopmStaffingFlatTable.tsx`
  - Update `resolvePeopleForRole()` signature to accept `(rk, allPeople, ctx)` where `ctx = { deal, dealAssignments }`.
  - Implement the two-stage logic above.
  - Threading: pass `deal` + the deal's current `assignments` everywhere `resolvePeopleForRole` / `peopleForRole` is invoked (3 call sites already identified — lines 953, 1280, plus inside `peopleForRole`).
  - Keep the `PersonGroups` shape; populate only `exact` (no tier UI). Empty-state copy: "No one in this reporting line yet — staff a senior first or check the pod."

### What stays the same

- Strict `roleTitle` matching as the first filter (today's behavior the user confirmed they liked).
- `useStaffingData` single-source-of-truth wiring, realtime listeners, inline date pickers — untouched.
- No DB migration. `reportingManager` and `pod` already exist on `staffing_people`.

### Caveat to flag

`reportingManager` is currently a free-text **name** (not an ID). That works for the BFS but can break if names collide or are misspelled. If/when you want bullet-proof matching, the follow-up is to add a `reporting_manager_id` column and backfill. We won't do that in this pass.
