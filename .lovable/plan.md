## People Ops redesign — Direction C (Console with legend)

Rebuild `/people-ops` as an analytics console. The existing reporting table stays as the drill-down.

### New layout (top → bottom)
1. **Header** — title, subtitle ("132 people • reporting, capacity & utilisation"), `+ Add Person` button (existing flow).
2. **People Ops Analytics strip** — 7 connected tiles, real values computed from current `people` + `assignments` + `deals` + `revenueTargets`:
   - Headcount (active, excludes TBH)
   - Avg Utilization % (weighted)
   - Hiring Gaps (TBH count)
   - Leavers (people with `leaving=true`)
   - TBH Roles (open slots)
   - Capacity (total available hrs/mo = active × 160)
   - Rev / Head (sum actual MRR ÷ active headcount, respects currency toggle)
3. **Department breakdown grid** — one card per Department from the taxonomy (`useTaxonomyQuery`), grouped via `groupPeopleByDeptRole`. Each card shows:
   - Dept name + personnel count
   - "View Table" link → scrolls/filters the table below to that dept
   - Utilization mix bar (4 segments: Overloaded / Near Full / Healthy / Under-utilised) with dominant-bucket label
   - 2-column role-type sub-breakdown (top 4 role types by count, plus TBH/Leavers row when present, colored blue/red)
4. **Utilization legend** — 4 dots with thresholds.
5. **Detailed reporting table** — keep `PeopleReportingTable` as a collapsible section ("All people" — open by default) so existing search/add/edit/delete still work.

### Technical details
- New file `src/components/people-ops/PeopleOpsAnalyticsStrip.tsx` — pure presentational tile row.
- New file `src/components/people-ops/DepartmentCardsGrid.tsx` — uses `useTaxonomyQuery` + `groupPeopleByDeptRole` to build cards; reuses utilization buckets from `PeopleLevelView`.
- New file `src/components/people-ops/DepartmentCard.tsx` — single card with util mix bar + role chips.
- Update `src/pages/PeopleOps.tsx` to render: header → analytics strip → department grid → legend → existing table (wrapped in a collapsible).
- All tokens via semantic classes already in `index.css` (`bg-card`, `border-border`, `text-muted-foreground`, `text-positive` / `text-warning` / `text-destructive` / `text-info`, `bg-[hsl(var(--danger-bg))]` etc.). No hex values, no gradients/shadows — flat UI, Regular + Medium weights only.
- "View Table" clicks set a department filter on the table (lightweight local state) and scroll into view.
- Currency-sensitive numbers route through existing `useCurrencyVersion` / `formatINR` helpers so the `₹/$` toggle keeps working.

### Out of scope
- No schema or RLS changes.
- No edits to the underlying table component beyond accepting an optional `departmentFilter` prop.
- Light-mode parity preserved via semantic tokens (no hardcoded dark hexes).
