## VSD Leaderboard — MBR Marked vs Not Marked

Add a new leaderboard section at the top of the **Insights** tab in `src/pages/MBRTracker.tsx`, ranking VSDs by MBR completion for the currently scoped month/deals.

### Layout
A single card titled **"VSD Leaderboard — MBRs Marked vs Not Marked"**, shown only when `activeVsd === "All"` (otherwise a single VSD is already selected, so a leaderboard is moot).

Columns:
| Rank | VSD | Total Deals | Marked | Not Marked | Marked % |

- **Marked** = deals where the active-month entry has `status === "Done"` OR `status === "Not Done"` (i.e., any explicit MBR status recorded). Bar/number in positive color.
- **Not Marked** = `total - marked` (pending / no entry). Number in warning color.
- **Marked %** = progress bar + percentage, colored ≥80% green, ≥50% amber, else red — matching the existing Scheduling table style.
- Rows sorted by Marked % descending, ties broken by higher Total Deals. Rank 1/2/3 get a subtle medal badge (🥇🥈🥉) prefix.
- Numeric cells are clickable and open the existing `DrillDialog` (reuse `setDrill` with new metric values `marked` / `notMarked`), so users can see the underlying deals.

### Data
Reuse the existing `vsdInsights` memo — it already aggregates `done`, `notDone`, `pending`, and `total` per VSD from `filteredDeals` + `activeEntryMap`. Derive:
- `marked = done + notDone`
- `notMarked = total - marked`

No new queries. No schema changes.

### Drill-down
Extend the `DrillMetric` union with `"marked"` and `"notMarked"`, and in the drill dialog's deal-filter switch add cases that include entries where status is Done/NotDone (marked) or missing/pending (notMarked). This keeps click-through parity with the existing tables.

### Files to change
- `src/pages/MBRTracker.tsx` — add leaderboard block above the Scheduling table inside the Insights `TabsContent`; extend drill-down metric handling.

No backend, hooks, or shared components need to change.