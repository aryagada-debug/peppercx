## Goal

In **People Ops → Capacity**, the "BW Used" column already shows a horizontal mini progress bar + % so you can eyeball who's loaded. The "MRR Fill %" column shows only a number. Add the same meter-style bar so revenue capacity utilisation is visually scannable too.

## Changes

Single file: `src/components/people-ops/PeopleOpsCapacityTab.tsx`

1. **Per-person table — "MRR Fill %" cell**
   - Replace the plain percentage with a flex row: mini bar (same `w-24 h-1.5 bg-border rounded-full`) + colored fill + numeric %.
   - Bar fill width = `Math.min(fillPct, 100)%`; color uses the existing `fillBucket` mapping (overloaded = red when <60%, nearFull = amber 60–<100%, healthy = green ≥100%).
   - When `fillPct == null` (capacity 0), keep showing "—" with no bar.
   - Widen the column slightly so the bar fits without breaking the row.

2. **VSD-Level Capacity table — "Fill %" cell**
   - Same treatment: mini bar + % using the same color rule.

3. **Optional polish**
   - Rename header **"MRR Fill %"** → **"Revenue Utilisation"** (and "Fill %" → "Revenue Util.") so the meter reads as utilisation, consistent with how BW Used is framed.
   - Add a small legend line under the table mirroring the BW legend: `<60% Under • 60–100% Healthy • ≥100% Fully utilised`.

No data/logic changes — only presentation. No other files touched.

## Technical notes

- Reuse `BUCKET_COLOR[...].bar` for the fill color so it stays in sync with the existing palette and dark mode.
- Keep the cell `text-right` alignment by wrapping bar + % in `inline-flex items-center gap-2 justify-end`.
