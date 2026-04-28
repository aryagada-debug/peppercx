# Use Reporting Hierarchy for VSD Filtering

## What changes
The VSD chip filter on **MBR Tracker** and **RGY Health** will use the **reporting hierarchy from Settings → People & Reporting** (the `staffing_people` table) instead of the deal's free-text `vsd` cell.

A deal will count as "under" a VSD if its `principal_bopm` (or `senior_bopm` / `bopm`, in that order) is a person whose `reporting_manager` chain rolls up to that VSD.

## Behavior

### Selecting a VSD chip (e.g. "Aditya Shaw")
Shows every deal whose **principal/senior/junior BOPM reports to Aditya Shaw** (directly or transitively), e.g. all deals owned by Shreshtha Pathak / Mitchelle Joseph + anyone reporting to them.

The deal's `vsd` text field is no longer consulted for filtering.

### "Unassigned" chip
Deals where no BOPM is set, or the BOPM exists but doesn't roll up to any of the 5 VSDs.

### "Other" chip
Removed — it becomes redundant with Unassigned under the hierarchy model.

### BOPM Insights / BOPM RGY Summary (second table when a VSD is selected)
Buckets stay grouped by raw BOPM name (current behavior — already fixed last turn). With the new filter these will only show BOPMs whose chain rolls up to the selected VSD.

## Technical details

### New helper: `useVsdHierarchy()` (in `src/hooks/useAppUsers.ts`)
- Loads `staffing_people` (id, name, reporting_manager).
- Builds a map: `personName → topVSD` by walking `reporting_manager` upward until it hits one of `VSD_NAMES` (max 6 hops, cycle guard).
- Caches result; refreshes when `staffing_people` changes (existing realtime channel already covers this).
- Exposes:
  - `vsdForPerson(name) → "Aditya Shaw" | null`
  - `peopleUnderVsd(vsdName) → Set<string>` (lowercase-keyed)

### Filter change in `src/pages/MBRTracker.tsx` and `src/pages/RGYHealth.tsx`
Replace the existing branch:
```ts
} else if (activeVsd !== "All") {
  d = d.filter(deal => canonVsd(deal.vsd) === activeVsd);
}
```
with:
```ts
} else if (activeVsd !== "All") {
  d = d.filter(deal => {
    const bopm = deal.principal_bopm || deal.senior_bopm || deal.bopm;
    return bopm && vsdForPerson(bopm) === activeVsd;
  });
}
```

`Unassigned` branch: deal has no BOPM, OR `vsdForPerson(bopm) === null`.
`Other` chip removed from `VSD_FILTERS`.

### Insights aggregation
The VSD Insights panel (left side) will also bucket by `vsdForPerson(bopm)` instead of `deal.vsd` so the totals match the chip filter.

## Tradeoffs to confirm
1. **Deals where `vsd` is filled correctly but no BOPM is set** will move from their VSD's bucket to **Unassigned**. From the data sample, every active deal under a VSD does have a `principal_bopm`, but a few have placeholder values like "To be assigned" — those will land in Unassigned.
2. **Sneha Iyer's reports include Sales/Strategy directors** (Aditya Joshi, Debdeep Banerjee, etc.), not just BOPMs. If any of them appear as a `principal_bopm` on a deal, those deals will now roll up to Sneha. This matches the org chart — confirming this is intended.

## Files
- `src/hooks/useAppUsers.ts` — add `useVsdHierarchy` hook
- `src/pages/MBRTracker.tsx` — swap filter + drop "Other" chip + update VSD Insights bucketing
- `src/pages/RGYHealth.tsx` — same three changes

## Open question
Should I **also remove the "Other" chip**, or keep it to surface deals whose BOPM is in the directory but doesn't report up to any VSD (e.g. someone reporting to Sumitha Shetty who herself reports to Sneha — these *do* roll up, so "Other" would be empty in practice)?
