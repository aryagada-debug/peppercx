## Goal

Replace the per-cell inline RGY editing in the **RGY Health → Table** view with a deal-level "Mark RGY" flow. Cells become read-only; updates happen through a single modal that walks through every dimension card for that deal. Any **Red** marking automatically opens the existing combined-issues prompt.

## Behaviour

### 1. Table cells become read-only
- Remove the inline Select / click-to-edit affordance from each dimension cell in `src/pages/RGYHealth.tsx`.
- Cells still render the colour pill (G/Y/R/NA) or a muted "Pending" chip — no dropdown, no save spinner, no per-cell save.
- Hover still shows the history popover (read-only).

### 2. "Mark RGY" entry point per row
- Status column gets a single primary action:
  - `Mark RGY` (default state, when any dimension is `Pending` / unmarked for the current week) — purple button.
  - `Update RGY` (when all dimensions already have a value this week) — secondary outline button.
- The row-level **Status** badge logic changes:
  - `Pending` — one or more dimensions missing for the current week.
  - `Done` — all dimensions marked.
  - `Red Open` — all marked but at least one is Red and no combined issue logged / resolved.
- KPI tiles (`Done / Not Done / Pending / Compliance`) recompute against the new "all dimensions marked" definition.

### 3. Mark-RGY modal (new `MarkRGYDialog`)
- Opens centred dialog scoped to one deal.
- Shows the 8 dimension cards (reuses the visual language of `EditableRGY`):
  - One row per dimension with label, owner, R / Y / G / ⊘ / ⋯ buttons.
  - Pre-filled with current week's values.
- Footer: `Cancel` / `Save & continue`.
- On Save:
  - Persists to `deal_rgy_weekly` for the current ISO week (single upsert).
  - Logs history (`logRGYChange` for changed dims, `logRGYReviewedNoChange` for untouched).
  - If any saved value is `R`, the existing `RGYCombinedIssuesDialog` opens immediately, pre-loaded with all Red (and Yellow) dimensions for that deal. Closing it returns to the table.
  - If no Red, dialog just closes with a "Saved" toast.

### 4. Combined-issues prompt on Red
- Reuses `src/components/rgy/RGYCombinedIssuesDialog.tsx` (already built).
- Modal title becomes `Action required — <deal>` when triggered automatically from a Red marking, vs `Edit combined issue` when re-opened from the status bar later.
- Saving creates/updates the single `[RGY Health]` task as today.

### 5. Deal Detail page parity
- `src/pages/DealDetail.tsx`: the Overview tab keeps the inline `EditableRGY` cards (that's where editing lives by design). No change there — the table is the only surface that loses inline editing.
- The RGY Health tab inside Deal Detail mirrors the new flow: a "Mark RGY" button at the top opens the same `MarkRGYDialog`; the card grid below is shown read-only until marked.

## Out of scope
- No schema changes (`deal_rgy_weekly` already supports per-week dim values).
- No change to the green-gate `ResolveIssuesDialog` (still triggers when moving R/Y → G).
- No change to Insights / Flags / Weekly Compliance tabs.
- No bulk-mark across multiple deals.

## Files

**New**
- `src/components/rgy/MarkRGYDialog.tsx` — wizard-style modal listing 8 dimension cards + footer save.

**Edited**
- `src/pages/RGYHealth.tsx` — strip inline Select per cell; render read-only pills; add `Mark RGY` / `Update RGY` button per row; wire `MarkRGYDialog` + `RGYCombinedIssuesDialog`; update KPI + row-status logic.
- `src/pages/DealDetail.tsx` (RGY Health tab section only) — add `Mark RGY` entry point and read-only card view; Overview tab unchanged.

## Open question (one)
Should the **Deal Detail → Overview** inline `EditableRGY` cards also become read-only with a single "Mark RGY" entry (full parity with the table), or stay inline-editable as today? My current plan keeps them inline because that's where focused editing happens — confirm if you want them read-only too.
