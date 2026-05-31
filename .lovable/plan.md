# Staffing & Capacity — Overview-first redesign

Merge the two existing analytical tabs (Deal View + Lock Analytics) into one sharper **Overview** tab and make it the default/home screen for Staffing & Capacity. The other tabs collapse to just **Staffing** and **Sheet view**.

## New tab layout (admin / VSD / cap-lead personas)

```
Overview (default)   |   Staffing   |   Sheet view
```

BOPM/cap-IC persona is unchanged: `Staffing | Sheet view | Change requests`.

URL: `/staffing` → `?tab=overview`. Old links keep working: `?tab=deals` and `?tab=lock` both redirect to `overview`.

## New file: `src/components/staffing/OverviewTab.tsx`

A single scrollable analytics page split into four bands. All filters live in one shared bar at the top, so VSD/BOPM/Type/Status/Capability/Lock-state/Account-search/Locked-date apply to every band below.

### 1. KPI strip (7 tiles)

Pulled from both source tabs, computed off the filtered deal set:

- Total deals
- Already staffed (green)
- Staffing needed (red)
- No staffing needed (muted)
- Locked (green) + % locked of "needs staffing"
- Unlocked / open to close out (amber)
- Total MRR (currency-aware via `useCurrencyVersion` + `formatINR`)

### 2. Staffing status pivot (from Deal View)

Same VSD → BOPM → Deals drill behaviour as today's `DealViewTab`, with the staffing-bucket columns (Already Staffed / No Staffing Needed / Staffing Needed). Group mode auto-switches to BOPM when a VSD is picked, and to a flat list when a BOPM is picked — identical to current logic. Inline editors for type/status/staffing bucket are preserved.

### 3. Lock distribution (from Lock Analytics)

Two compact stacked bar charts side-by-side:

- Staffed vs Unstaffed by VSD (horizontal)
- Staffed vs Unstaffed by Capability (vertical)

Uses the same recharts setup as today's `LockAnalyticsTab`. Tightened heights so both fit in one viewport on 1208px.

### 4. Unstaffed action list (from Lock Analytics)

The "Unstaffed deals to close out" table with the inline **Lock** button (admin only). Always shows the unstaffed slice of the filtered deals, sorted by MRR desc.

## Page changes: `src/pages/Staffing.tsx`

- `Tab` type → `"overview" | "staffing" | "table" | "requests"`.
- Default `tab` for non-BOPM personas: `"overview"` (was `"staffing"`).
- Tab list for non-BOPM: `Overview · Staffing · Sheet view`. Drop the `deals` and `lock` entries.
- `normalizedTabParam`: also map `"deals"` and `"lock"` → `"overview"` so existing deep links and bookmarks keep working.
- Replace the two existing panels (`DealViewTab`, `LockAnalyticsTab`) with one `<OverviewTab deals=… people=… assignments=… onUpdateDeal=… bopmFilterScopedVsd=… />` panel, lazy-mounted on first visit just like the others.

## Files left untouched

- `DealViewTab.tsx` and `LockAnalyticsTab.tsx` stay on disk as building blocks — `OverviewTab` reuses their internal helpers (`classifyStaffing`, `dealCapabilities`, the BOPM/VSD grouping memo, the lock mutation) rather than re-importing the full tab shells. We can delete the originals in a follow-up once nothing else links to them.
- No schema, RLS, or data-fetching changes.
- BOPM persona view unchanged.

## Out of scope

- Visual redesign of the underlying tables/charts beyond the new compact layout.
- People-side analytics (that lives on People Ops).
- Editing the `LockAnalyticsTab` lock-mutation behaviour.