## Clients & Deals — UI Refinements

### 1. VSD Filter Labels
In `src/pages/Clients.tsx`, simplify `VSD_FILTERS` labels by removing the region brackets:
- "Neema Jayadas (US)" → "Neema Jayadas"
- "Aditya Shaw (BFSI)" → "Aditya Shaw"
- "Sneha Iyer (FMCG)" → "Sneha Iyer"

### 2. Modern Compact KPI Cards
Replace the current 5 KPI cards with smaller, icon-driven cards:
- Each card: ~64px tall, gradient/tinted background, lucide icon in a rounded square, label + value stacked compactly.
- Icons & accent colors:
  - Clients → `Building2` (blue tint)
  - Total Deals → `Briefcase` (violet tint)
  - Active Deals → `Activity` (green tint)
  - Total MRR → `TrendingUp` (amber tint)
  - Total Value → `DollarSign` (emerald tint)
- Layout: `grid-cols-2 md:grid-cols-5 gap-2`, each card uses `bg-gradient-to-br from-{color}/10 to-transparent border border-{color}/20`, icon in a `rounded-lg p-1.5 bg-{color}/15` chip.
- Smaller text: label `text-[10px] uppercase tracking-wide`, value `text-base font-semibold`.

### 3. Resizable Table Columns
Add user-adjustable column widths:
- Switch table to `table-fixed` with explicit widths held in state: `colWidths: Record<string, number>`.
- Add a resize handle (`<div>` absolutely positioned on the right edge of each `<th>`) that listens to `mousedown` → tracks `mousemove` to update width (min 60px, max 500px). Persist to `localStorage` key `clients-col-widths`.
- Update `ColHeader` (or wrap it) to include the resize grip — a 4px wide vertical bar with `cursor-col-resize` that highlights on hover.

### 4. Column Picker (Show/Hide Columns)
Add a "Columns" button (next to "Clear filters") that opens a popover with checkboxes:
- **Always-on (disabled checkboxes, locked)**: Client, Deal Name.
- **Toggleable**: Deal ID, Type, Status, VSD, P.BOPM/Sr BOPM, **Content Lead** (new), **SEO Lead** (new), MRR, Total Revenue, RGY.
- Visible columns persist in `localStorage` (`clients-visible-cols`). Default visible: all existing + Content Lead + SEO Lead off by default to avoid surprise.
- Render `<th>` and matching `<td>` conditionally based on `visibleCols` set.

### 5. New Columns: Content Lead & SEO Lead
Compute per-deal from `assignments` + `people`:
- **Content Lead**: highest-allocation person whose `roleCategory === "Content"` (fallback role title contains "content lead/manager").
- **SEO Lead**: highest-allocation person whose `roleCategory === "SEO"`.
- Cell renders the person name (or "— None —"). Clicking opens the existing `AddStaffingMemberDialog` pre-filtered to that category, so the user can assign/change.
- Add a helper `getLeadByCategory(dealId, category)` near the top of the component.

### Technical Notes
- All state additions live in `Clients.tsx`; no DB schema changes (Content/SEO leads derived from existing `staffing_assignments`).
- New imports: `Building2, Briefcase, Activity, TrendingUp, DollarSign, Settings2, GripVertical` from lucide-react; `Popover, PopoverTrigger, PopoverContent` and `Checkbox`.
- `ColHeader` will receive an optional `width` and `onResize` prop; existing call sites unaffected when omitted.

### Files to Edit
- `src/pages/Clients.tsx` — labels, KPI redesign, column picker, resizing logic, new lead columns.
- `src/components/table/ColHeader.tsx` — accept width + resize handle.
