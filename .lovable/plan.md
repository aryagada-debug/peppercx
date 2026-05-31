## Goal

Replace the existing per-(department, designation) "target deal value per person" with a region+role formula that drives the **Target MRR / Revenue Capacity** number used in the Staffing → People view (and any other place that reads `revenueTargets`).

## Capacity Rule (single source of truth)

Per-region base values:

| Role (designation) | US capacity | India capacity |
|---|---|---|
| Senior BOPM | ₹60,00,000 | ₹30,00,000 |
| SEO Growth Lead | ₹60,00,000 | ₹30,00,000 |
| Content Lead | ₹60,00,000 | ₹30,00,000 |

Derived (sum across the whole region, not just direct reportees):

- **VSD (region R)** = (count of Senior BOPM in region R) × Senior-BOPM capacity for R
- **Content Capability Leader (R)** = (count of Content Lead in R) × Content-Lead capacity for R
- **SEO Capability Leader (R)** = (count of SEO Growth Lead in R) × SEO-Growth-Lead capacity for R

All other designations → revenue capacity = **0** for now.

Region is read from `Person.region` and normalized: `US/USA/U.S./United States → "US"`, `IN/India → "India"`. Anything else → no capacity.

## Implementation

1. **New helper** `src/lib/revenueCapacity.ts`
   - `getPersonRevenueCapacity(person, allPeople): number`
   - Internal table of base values per (role, region).
   - For VSD / Capability Leader designations, count active (`!leaving && !tbh`) people of the corresponding role in the same region from `allPeople` and multiply.
   - Returns 0 for any other designation or unknown region.

2. **Replace `getTarget()` call sites** (currently `revenueTargets.find(department, designation)`):
   - `src/components/staffing/PeopleLevelView.tsx`
   - `src/components/staffing/PeopleViewTab.tsx`
   - Any other usage of `targetDealValuePerPerson` surfaced by a follow-up search.
   - Pass `people` array (already available in both components) into the helper.

3. **Deprecate the old `revenueTargets` plumbing for capacity display** — leave the `staffing_revenue_targets` table and `useRevTargetsQuery` in place (other code may still read it), but stop using its value for the Target MRR column. Mark `RevenueCapacityTarget` lookup as unused at the call sites with a short comment so we don't reintroduce it.

4. **No DB migration required** — the rule is computed client-side from existing `staffing_people.region` and `designation` fields.

5. **Memory** — add a small note under `mem://data/staffing-model` (or new file) capturing the new region+role capacity formula so it stays the single source of truth.

## Out of scope

- Changing the Settings UI for the legacy designation→target table (kept untouched; can be cleaned up in a later pass once we confirm nothing else relies on it).
- Bandwidth / hours logic — only revenue capacity changes.
- Reporting-line based sums (explicitly chose region-wide sums).
