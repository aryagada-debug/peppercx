## Rebuild the Usage tab — app-consistent styling

Rewrites `src/pages/admin/UsageTab.tsx` to match the provided HTML's structure and interactions, but keeps the project's design system (flat UI, purple primary, off-white surface, thin borders, Inter, no gradients/shadows). The "New activations" chart is omitted as requested. Data sourcing is unchanged — all real data.

### Layout

1. **Header**: "Usage & Adoption" title + small "Admin" pill. Right side: range segmented control (7d / 30d / 90d) and "Export CSV" button.
2. **KPI strip** (5 tiles, no New activations): Total users, Active 7d, Active 30d, Dormant, Never signed in.
3. **Filter row**: status chips (All / Active / Low usage / Dormant / Never) + right-aligned search input (name, email, region).
4. **Sortable table**: Name+email, Role, Region·Pod, Last login, Idle (days), Writes·{range}d, Status pill, chevron. Click a row to expand a detail panel with Department, First login, Last login, Days since login, Email, Writes, Role, Status.
5. **Pager footer**: "Showing X–Y of N", per-page selector (10/25/50), numeric pager with prev/next.  
Add in relevant filters like VSD name pill that will show the useage of the people under that particular VSD, etc

### Data wiring (existing logic preserved)

- `load(days)` keyed off the selected range — reuses the same Promise.all over auth + profiles + user_roles + staffing_people + deal_tasks/rgy/notes/todos/slack/approvals, with the `since` boundary derived from `rangeDays`.
- Status chip mapping: Active→`active7`, Low usage→`active30`, Dormant→`dormant`, Never→`never_signed_in` + `not_provisioned`.
- Export CSV streams the currently-filtered rows client-side; no backend change.
- Sorting is local; pagination resets on filter/search/range change.

### Styling

- Uses tokens from index.css (`bg-card`, `border-border`, `text-muted-foreground`, `text-primary`, `bg-primary/10`, `text-positive`, `text-warning`, `text-destructive`, `STATUS_TONE`). No inline custom palette, no scoped style block.

### Files

- `src/pages/admin/UsageTab.tsx` — single-file rewrite. Removes the unused Funnel and ActionList helpers and `copyEmails` flow. No schema changes, no other components touched.