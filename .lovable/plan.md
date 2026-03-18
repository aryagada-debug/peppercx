# Business Unit → Role Category Mapping + Filters

## What Changes

### 1. Define BU-to-Category mapping in `staffingData.ts`

```typescript
export const BU_ROLE_CATEGORIES: Record<string, RoleCategory[]> = {
  "Pepper Creative": ["Operations", "Creative Strategy", "Creative Copy", "Creative Art", "Video"],
  "Pepper SEO/GEO + Content": ["Operations", "Content", "SEO"],
  "Integrated": ROLE_CATEGORIES, // all categories
  "Content Studios": ["Operations", "Content", "Video"],
  "Others": ROLE_CATEGORIES, // all by default
};
```

### 2. Filter visible role columns per deal's Business Unit

In `Staffing.tsx`, update `visibleSlots` logic:

- When categoryFilter is "All", filter `ROLE_SLOTS` to only categories allowed by the **active BU filter** (if a single BU is selected) or show union of all BU categories in the filtered deals
- Per-deal row rendering: only render role cells for categories matching that deal's `businessUnit` via the mapping; show empty/disabled cells for non-applicable categories

### 3. Add Business Unit and Capability Line filter dropdowns

Add two new filter dropdowns to the Accounts tab filter bar (alongside existing VSD, Staffing Status, Deal Type filters):

- **Business Unit** filter — derived from unique `deal.businessUnit` values
- **Capability Line** filter — derived from unique `deal.capabilityLine` values

These filter the deals list AND drive which role columns are visible.

### 4. Expanded deal row respects BU mapping

The expanded staffing panel (`renderDealExpand`) only shows role categories applicable to that deal's BU, so the staffing dropdown only lists relevant role groups.

### Files Modified

- `src/data/staffingData.ts` — Add `BU_ROLE_CATEGORIES` mapping
- `src/pages/Staffing.tsx` — Add BU/Capability filters, update `visibleSlots` to respect BU mapping, update per-deal row rendering and expanded row to filter by BU categories  
  
Also, enhance the UI of this entire section like it is for @Kindred - right now this looks very drab
- &nbsp;