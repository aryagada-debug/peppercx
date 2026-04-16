# Fix MBR Status Mapping & Add Month-on-Month View

## Status Mapping Fix

Current logic already handles this mostly correctly (`entry?.status || "Pending"` on line 292 of MBRTracker.tsx). The issue is that "Not Done" was likely mis-mapped during the original sheet import. The fix:

- Verify existing DB data is correct (1 "Not Done", 184 "Done", 4 "Pending" — looks right)
- Ensure the display logic treats all statuses as-is from the DB: "Done", "Not Done", "Not Required" render with their labels; only deals with **no entry at all** show as "Pending"
- No code change needed for mapping — the current code is correct

## Month-on-Month View

Add a monthly tab/toggle to MBR Tracker that shows a grid of months vs deals, so you can see MBR compliance trends over time.

### Implementation

`**src/hooks/useMBRData.ts**`

- Already loads `allEntries` (all months). Add a computed `entriesByMonth` map: `Map<string, Map<string, MBREntry>>` keyed by month string (e.g. "2026-02") then deal ID
- Add a `availableMonths` computed array from distinct `week_start` months

`**src/pages/MBRTracker.tsx**`

- Add a view toggle: "Current, select month) (existing view) vs "Month-on-Month"
- Month-on-Month view: a table with rows = deals (grouped by client), columns = months (e.g. Jan, Feb, Mar...)
- Each cell shows a colored dot/badge: green for Done, red for Not Done, amber for Pending, gray for Not Required
- KPI strip updates to show compliance % per month
- Keep existing filters (pod, search, show closed) working in both views

### Technical Details

- Group `allEntries` by month using `week_start.substring(0, 7)` — take the latest entry per deal per month
- Month columns are auto-generated from available data
- Cell click opens the MBR detail dialog for that deal/month

## Files Modified

- `src/hooks/useMBRData.ts` — Add `entriesByMonth` and `availableMonths` computations
- `src/pages/MBRTracker.tsx` — Add view toggle and month-on-month grid view