Single-file change in `src/components/settings/PeopleReportingTable.tsx`.

## 1. Fix the wrong Deal ID

Deal has both `id` (internal) and `dealId` (human-readable like `TT01006`). The expanded sub-table currently shows `d.id`. Switch to `d.dealId || "—"` with the same mono styling.

## 2. Make deal rows clickable

Each row in the expanded "Deals tagged" table becomes a navigation target — `useNavigate()` to `/deals/${d.id}?tab=Staffing` (matches `DealStaffingCard`'s "Open" link). Add `cursor-pointer hover:bg-primary/5` and a small `ExternalLink` icon at row end.

## 3. Reduce column whitespace in the expanded sub-table

- Padding `pr-3` → `pr-2`, `py-1.5` → `py-1`.
- Add a `<colgroup>` to constrain widths: Deal ID 90px, Deal flex, Status 110px, Type 90px, Alloc 70px, MRR 100px, action 28px.
- Reduce expanded `<td>` indent from `pl-16` to `pl-10`.

## 4. Column header filters on the main table (Clients/Deals style)

Reuse the shared `ColHeader` component already used by `Clients.tsx` and `MBRTracker.tsx`.

- Add local state: `sortState: { sortKey, sortDir }`, `colFilters: Record<string,string>`, `openFilter: string | null`.
- Replace the current `<th>` map with `ColHeader` for: **Name** (text), **Designation** (text), **Email** (text), **Reports to** (options from `managerNames`), **Revenue capacity** (sortable numeric), **Time utilisation** (sortable numeric), **Revenue utilisation** (sortable numeric).
- Extend the `filtered` memo to also apply column filters; add a sort pass after grouping per leaf-person list.
- Keep existing resize handles via `ColHeader.onResizeStart`.

## Out of scope

- No changes outside `PeopleReportingTable.tsx`.
- Group/sub-team header rows keep their plain header; filters and sorts act on the leaf person rows.
