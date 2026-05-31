## Diagnosis

The **Revenue Capacity** column in the All People table reads from the static DB field `revenueTargetPerPerson`, which is still `0` for every person. The new mapping you set up lives in `src/lib/revenueCapacity.ts` (`getPersonRevenueCapacity`) and is computed live from `designation` + `region` (plus the headcount of base roles in the region for VSDs / Capability Leaders). It was wired into the Staffing → People view but never wired into the People Ops "All people" table — so the column keeps showing the unset DB number.

## Fix

In `src/components/settings/PeopleReportingTable.tsx`:

1. Import `getPersonRevenueCapacity` from `@/lib/revenueCapacity`.
2. Build a per-person derived capacity once per render:
   `const capacityById = useMemo(() => new Map(people.map(p => [p.id, getPersonRevenueCapacity(p, people)])), [people])`.
3. Replace every read of `p.revenueTargetPerPerson` in:
   - the sort comparator (`case "revType"`),
   - the numeric filter (`fRev`),
   - the Revenue Utilisation calc at line ~383 (`const cap = ...`),
   - the Revenue Utilisation hint at line ~929,
   - the Revenue Capacity cell display at line ~918,
   with the derived value from `capacityById`.
4. Make the Revenue Capacity cell read-only — render the formatted derived value (with currency symbol) instead of the editable `<Input>`. Keep the currency selector visible but disable it, since the capacity formula is INR-only. Add a small "auto" hint so it's obvious the number is rule-driven, not a free field.

No DB changes, no migration, no other files affected.
