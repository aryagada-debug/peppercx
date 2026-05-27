Single-file change in `src/components/settings/PeopleReportingTable.tsx`.

## 1. Make the left chevron clickable

The name cell uses `onClick={(e) => e.stopPropagation()}` to protect inline editing, which also kills the row-click toggle when you hit the chevron. Wrap the `ChevronRight`/`ChevronDown` in a real `<button>` that calls the expand/collapse setter directly (and stops propagation itself). Add `hover:bg-secondary` and `rounded` for affordance.

## 2. Expanded "Deals tagged" sub-table

Replace columns:

```text
Before: Deal | Type | Role | Alloc % | MRR
After:  Deal ID | Deal | Status | Type | Alloc % | MRR
```

- **Deal ID** → `d.id` in `font-mono text-[11px] text-muted-foreground`
- **Deal** → `d.dealName || d.account` (medium weight)
- **Status** → `d.dealStatus` rendered as a small colored pill via a `statusTone(status)` helper:
  - Active / Live / Running → `bg-positive/15 text-positive border-positive/30`
  - Pitch / Proposal / Negotiation → `bg-info/15 text-info border-info/30`
  - Paused / On Hold → `bg-warning/15 text-warning border-warning/30`
  - Lost / Closed / Churned → `bg-destructive/10 text-destructive border-destructive/30`
  - default → `bg-muted text-muted-foreground border-border`
- **Type** → keep as-is, but as a subtle outline pill
- **Alloc %** → right-aligned, tabular; tint >100 with `text-destructive`, ≥85 with `text-warning`
- **MRR** → unchanged formatting

## 3. Subtle color polish on the expanded panel

- Wrap the panel content in a card: `rounded-lg border border-primary/20 bg-primary/[0.03] p-3`.
- Header row: `text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60`.
- Body rows: `hover:bg-secondary/40`, zebra via `even:bg-secondary/20`.
- Title chip "Deals tagged (N)" gets `text-primary` accent.
- Empty state gets a soft muted card instead of bare text.

## Out of scope

No changes to data fetching, the main row layout, or other files.
