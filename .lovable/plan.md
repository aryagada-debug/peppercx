# Reorderable Columns + Retainer Filter

## 1. Drag-to-reorder columns (Clients & RGY Health)

**Interaction:** Grab any column header to drag it horizontally and drop it into a new position. A subtle drag handle (⋮⋮ icon) appears on hover at the left of each header label. Order persists in `localStorage`. A "Reset column order" button is added inside the existing column-visibility popover.

**How it works (technical):**
- Refactor both pages from hardcoded JSX header/cell chains into a data-driven model:
  - Add `cellRender: (deal) => ReactNode` to each entry in `ALL_COLS`, moving the existing inline cell JSX into these renderers.
  - Render headers and `<td>`s by iterating `visibleCols` (which already stores order) instead of hardcoded `isVisible(k) && <ColHeader ...>` lines.
- Wrap the `<thead>` row in `@dnd-kit`'s `DndContext` + horizontal `SortableContext`; each `<th>` becomes a `useSortable` item. On drop, reorder `visibleCols` and persist.
- Required columns (`account`, `dealName` on Clients; `account`, `deal_name` on RGY) stay draggable but their visibility toggle remains locked.
- `@dnd-kit/core` and `@dnd-kit/sortable` are already in the stack.

**Out of scope:** RGY Health's 8 RGY dimension columns and surrounding fixed cells (Reviewed-No-Change, Overall RGY, AI Summary, Last Updated) remain in their current fixed order. Only the left-side metadata columns (Client, Deal Name, Deal ID, Status, …) are reorderable on RGY Health. On Clients, all columns in `ALL_COLS` are reorderable.

## 2. Retainer / Non-Retainer filter on RGY Health

Add a new pill-style toggle next to the existing R/Y/G filter in the toolbar:

```text
[All] [Retainer] [Non-Retainer]
```

- State: `dealTypeFilter: "All" | "Retainer" | "Non-Retainer"`.
- Applied inside `filteredDeals` using the existing `isRetainerDeal` helper from `src/hooks/useMBRData.ts` (reads `deal_type`, falls back to `customer_type`).
- Matches the visual style of the existing RGY filter buttons (same flat pill, semantic colors not required — neutral selected state).

No DB changes; no impact on Clients page filters.

## Files touched
- `src/pages/Clients.tsx` — refactor cells to renderers, add DnD on `<thead>`, reset-order button.
- `src/pages/RGYHealth.tsx` — same DnD refactor for left-side metadata columns, add Retainer/Non-Retainer filter pill + filter logic.
