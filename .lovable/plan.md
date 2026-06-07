## Changes to `src/pages/RGYHealth.tsx`

### 1. Remove "AI Summary" column from the table
- Drop `{ key: "ai_summary", label: "AI Summary" }` from `ALL_COLS`.
- Remove `"ai_summary"` from both `DEFAULT_VISIBLE` arrays.
- Delete the `<th>AI Summary</th>` header and matching `<td>` cell (the two `isColVisible("ai_summary")` blocks).

### 2. KPI tiles (Red / Yellow / Green / Pending) become table filters
- Extend `rgyFilter` state to include `"Pending"`.
- Extend the `filteredDeals` memo so `rgyFilter === "Pending"` keeps deals with no worst-RGY (unmarked).
- Change each tile's `onClick` to:
  - switch `activeTab` to `"table"`,
  - toggle `rgyFilter` to the matching value (or back to `"All"` if already active).
- Add an active visual state on tiles via a `ring` using semantic tokens (destructive / warning / positive / muted) when that tile's filter is on.
- Remove the `red | yellow | green | pending` branches from the existing `kpiDrill` dialog (keep `score` only). Update the `kpiDrill` state type.
- Keep the existing "All / Red / Yellow / Green" pill row in sync with the new `"Pending"` value (add a `Pending` pill).

### 3. New "Segment" filter that modifies the table
- Add `segmentFilter` state (default `"All"`), values are `DIMENSIONS[].key` plus `"All"`.
- Render a `Select` next to the RGY pills labelled "Segment" with options: All segments, Overall Customer, Internal, Content, SEO, Supply, Copy, Design, Video.
- In `filteredDeals`, when `segmentFilter !== "All"`:
  - if `rgyFilter === "All"`, keep deals where `deal[segmentFilter]` is non-empty;
  - otherwise, keep deals whose `deal[segmentFilter]` matches the active `rgyFilter` code (R/Y/G, or empty for Pending).
- This composes with existing VSD/BOPM/search/deal-type/closed filters; no other state changes needed.

### Out of scope
- Insights tab, Weekly Compliance tab, Mark RGY flow, RGY combined-issues dialog, per-column header filters in the table — all untouched.
- No DB / schema changes.
