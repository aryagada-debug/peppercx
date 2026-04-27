## 1) Fix the cursor in Task Description (Clients & Deals → Tasks)

**Root cause:** `RichTextEditor` in `src/components/deals/TaskFormDialog.tsx` is a controlled `contentEditable` that calls `dangerouslySetInnerHTML={{ __html: value }}` on every render. On each keystroke it fires `onChange` → parent state updates → component re-renders → React rewrites the editor's HTML → the browser caret resets to position 0 (and characters often get reversed/dropped).

**Fix:** Make the editor uncontrolled-on-input.
- Set initial HTML once via a ref (in a `useEffect` that only runs when `value` changes from *outside* — i.e. when the incoming `value` differs from the editor's current `innerHTML`). 
- Drop `dangerouslySetInnerHTML` from the live render so React no longer overwrites the DOM on every keystroke.
- Keep `onInput` → `onChange(editorRef.current.innerHTML)` so parent state stays in sync for save.
- Apply the same fix to the `RichTextEditor` usage inside `SubtaskRow` (subtask description) so subtask typing is also smooth.

This preserves caret position, IME composition, and selection while keeping the parent form state authoritative on save.

## 2) Dashboard — replace RGY Heatmap with a VSD → BOPM rollup table

**Remove:**
- The "RGY Health — Deal Heatmap" card and the `RGYHeatmap` import in `src/pages/Index.tsx`.

**Add:** A new card "RGY Health by VSD" containing an expandable table.

**Data source (already fetched in `Index.tsx`):**
- `staffing_deals` → `vsd`, `principal_bopm`, `senior_bopm`, `bopm` per active deal.
- `deal_rgy_weekly` → latest week per deal; we'll roll a deal up to a single status using the worst across the 4 dimensions (Internal, Customer, Delivery, Consumption): R if any R, else Y if any Y, else G if any G, else NA. Deals with no RGY entry are excluded from counts (shown as "—" if needed).

**Aggregation:**
- Group active deals by `vsd` (fallback "Unassigned").
- For each VSD, count R / Y / G across their deals.
- Within each VSD, sub-group by BOPM owner = `principal_bopm` || `senior_bopm` || `bopm` || "Unassigned" — count R / Y / G per BOPM.

**UI (table):**
| VSD | Deals | 🔴 R | 🟡 Y | 🟢 G |
|---|---|---|---|---|
| Sneha Iyer | 24 | 3 | 5 | 16 |

- Each row has a chevron; clicking expands an indented sub-table with the same columns grouped by Sr/Principal BOPM under that VSD.
- Sort VSDs by R desc, then Y desc.
- Numeric cells use the existing R/Y/G semantic colors (text + subtle bg) consistent with the design system.
- Clicking a BOPM sub-row count (or a "View deals" link) is **out of scope** for this change unless trivial — we'll keep the table read-only for now.

**Files to edit:**
- `src/pages/Index.tsx` — remove heatmap section + imports; add `vsdRollup` memo and a new `<VsdRgyTable>` component (defined inline or in `src/components/dashboard/VsdRgyTable.tsx`).
- `src/components/dashboard/RGYHeatmap.tsx` — leave file in place (still used elsewhere on `/rgy-health` if applicable); we just stop importing it on the dashboard.

**No DB / migration changes required.** All needed fields are already being queried.

## Out of scope
- Editing RGY status from this table (the existing RGY Health page handles that).
- Changing the Pod Utilization card or KPIs.