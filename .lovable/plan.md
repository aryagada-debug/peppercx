## Goal
Hide the "Suggested Staffing" panel on locked (Staffed) deals in the Staffing & Capacity module.

## Change
In `src/components/staffing/DealStaffingCard.tsx`, conditionally render `<SuggestedStaffingPanel />` only when `!locked`. The panel already knows `locked = !!deal.staffingLockedAt`.

```tsx
{!locked && (
  <SuggestedStaffingPanel ... />
)}
```

Everything else (KPIs, assignments table, lock toggle) stays unchanged. Once a deal is unlocked, suggestions reappear automatically.

## Out of scope
No change to suggestion generation logic, DealHandover suggestions, or other pages.