## Make Deal view inline-editable + add per-deal staffing drill-down

### Changes in `src/components/staffing/DealViewTab.tsx`

**1. Pass `onUpdateDeal` from parent**
- Update the `Props` interface to accept `onUpdateDeal: (dealId: string, updates: Partial<Deal>) => void`.
- In `src/pages/Staffing.tsx`, pass the existing `updateDeal` from `useStaffingData()` to `DealViewTab`.

**2. Make Type, Status, Staffing columns editable inline**
Each VSD-expanded row currently renders read-only `<td>` cells. Convert these three columns to compact inline `<select>` dropdowns (styled to look like text by default, with chevron on hover) that call `onUpdateDeal` on change:
- **Type** → options: `Retainer`, `Non-Retainer`, `Pilot` (writes to `dealType`)
- **Status** → options: `Active Deal`, `New Deal in SLA/PO`, `Deal Disputed`, `Deal Completed Successfully`, `Deal Churned / Lost` (writes to `dealStatus`)
- **Staffing** → options: `Already Staffed`, `Staffing Needed`, `No Staffing Needed` (writes to `staffingStatus`)

The existing colored badge styling for Staffing is preserved (color of select adapts to bucket).

**3. Add a new "Details" column with an expand chevron per deal**
Add a new column at the end of each deal row inside the VSD drill-down. Clicking the chevron toggles a sub-row that shows the **staffing roster** for that deal:

```text
┌─ Person ──────────── Role ───────────── Allocation % ─── Hours / month ─┐
│ Aditya Pathak       Content Lead         20%             32 h           │
│ Janhavi Dave        Sr Editor            10%             16 h           │
│ ...                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
Total: 4 people · 47.5% combined · 76 h
```

Hours computed as `allocationPct / 100 * 160` (same formula already used in PeopleViewTab). Person name resolved via `personMap[a.personId]?.name`. Role label resolved from a small `ROLE_LABELS` map (mirroring `MatrixTab`'s `ROLE_COLS`).

If a deal has no assignments, show: *"No team members assigned yet."*

**4. Local state additions**
- `expandedDeal: Set<string>` to track which deal rows are showing the staffing drill-down (independent of VSD expansion).

### Technical notes
- All dropdowns use the existing `<select>` with `bg-card border-border` tokens — no new shadcn components needed.
- Edits propagate through `useStaffingData.updateDeal` → Supabase `staffing_deals` table → realtime channel re-syncs across tabs.
- No DB schema changes required (all 3 columns already exist on `staffing_deals`).
- No performance regression: rows render the same number of cells; the drill-down sub-table only mounts when expanded.

### Files edited
- `src/components/staffing/DealViewTab.tsx` — add inline selects, expand-chevron column, staffing drill-down sub-row
- `src/pages/Staffing.tsx` — pass `updateDeal` prop to `DealViewTab`
