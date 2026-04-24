## RGY Trend — NA/TBU handling + new statuses

**Add two new RGY statuses** alongside R/G/Y:
- **NA** — "Not Required" — symbol: `⊘` (slashed circle), neutral grey
- **TBU** — "To Be Updated" — symbol: `⋯` (ellipsis), muted/dotted style

### Files & changes

**`src/components/deals/EditableRGY.tsx`**
- Extend `RGY_BUTTONS` with two more buttons:
  - `NA` — slashed-circle icon, grey palette (`bg-muted text-muted-foreground border-border`)
  - `TBU` — ellipsis icon, dashed border + muted bg (`bg-secondary/40 border-dashed text-muted-foreground`)
- Update `dotColor()` to return grey for `NA` and a striped/dashed indicator for `TBU`.
- Add the two new entries to the legend strip.
- Make the toggle row wider (it currently fits 3 buttons; will need `flex-wrap` or smaller buttons `w-7 h-7`).

**`src/pages/DealDetail.tsx`**
- Extend `rgyColors` map: `NA: "rgy-na"`, `TBU: "rgy-tbu"`.
- Extend `rgyScore` so NA/TBU are treated as **non-comparable** (use `null` instead of a number).
- In `RGYTrendView` — **fix Movers + Δ logic**:
  - Skip transition if `prev` OR `current` is `NA` or `TBU` (i.e. either side is non-comparable). No mover badge, no Δ arrow — show `— stable` (or `— n/a`) instead.
  - Only compare R↔Y↔G transitions for "improved/worsened".
- In the heatmap cell, render the symbol when value is NA (`⊘`) or TBU (`⋯`) instead of the letters.

**`src/index.css`**
- Add utility classes `.rgy-na` (grey bg, muted fg) and `.rgy-tbu` (dashed border, transparent bg, muted fg) — mirror existing `.rgy-green/.rgy-red/.rgy-yellow` conventions.

---

## MBR Tab — KPI redesign

**File:** `src/pages/DealDetail.tsx` (`DealMBRTab`, lines ~497–516)

### New KPI set (3 cards instead of 4)

Compute total contract months from `deal.startDate`/`deal.endDate` (fall back to `deal.duration` parsing if dates missing). Use `differenceInCalendarMonths` from `date-fns` (already a dep via existing `format` import).

| KPI | Value | Icon (lucide) |
|---|---|---|
| MBR Coverage | `{doneCount}/{totalMonths}` (e.g. `4/12`) with small caption `MBRs done` | `CalendarCheck` |
| Last Sentiment | Sentiment badge or `—` | `Smile` (or `Activity`) |
| MBR Health | Computed: `On Track` if `doneCount >= elapsedMonths`, else `Behind by N` | `TrendingUp` / `AlertTriangle` |

### Visual style — modern, smaller
- Container: `grid grid-cols-3 gap-2` (down from `gap-3` and 4 cols).
- Card: `rounded-lg border border-border bg-card px-3 py-2.5 flex items-center gap-2.5` (compact, ~half current height).
- Left: `h-8 w-8 rounded-md bg-secondary/60 grid place-items-center` containing the lucide icon (`h-4 w-4 text-primary`).
- Right: stacked label (`text-[10px] uppercase tracking-wider text-muted-foreground`) + value (`text-sm font-semibold` — bigger emphasis on the `x/y` number using `font-mono tabular-nums`).
- Drop the heavy `bg-[#E8E6DF]` and `border-l-4 border-l-[#534AB7]` styling.

### Removed
- "Next MBR Date" card — already shown in the banner below.
- "Last Mode" card — low value at-a-glance.

The "Next MBR scheduled" banner and "No MBR recorded for {month}" warning remain unchanged.

---

## Acceptance
- RGY editor shows 5 status options (G, Y, R, NA-⊘, TBU-⋯) with legend.
- Switching from NA→G (or anything→TBU, TBU→anything) does **not** appear as "improved/worsened" in Movers strip or Δ column.
- MBR tab shows 3 compact KPI tiles; first reads e.g. "3/12 MBRs done".
