## Plan

Three independent fixes.

---

### 1) Currency toggle — stop full app rerender

**Root cause:** `CurrencyProvider` wraps children in `<div key={currency}>`, which remounts the entire app on toggle. That's why the page goes blank/slow.

**Fix:**

1. In `src/contexts/CurrencyContext.tsx`:
   - Remove the `<div key={currency}>` remount wrapper.
   - Expose a `useFormatINR()` hook that returns a memoized formatter bound to current `currency` + `fxRate` (no module mirror needed for components — only kept as fallback for non-React utilities).
   - Keep the module-level `globalCurrency` / `globalFx` mirrors so anything calling the legacy `formatINR()` from `csvTargets.ts` still works (initial paint, plus immediate update on next render).

2. Make consumer components reactive without remounting the tree:
   - Introduce `useFormatINR()` (returns `(n) => string`) and `useFormatMoney()` (with options).
   - Update the ~27 files that import `formatINR` / `formatMoney` from `csvTargets`/`currency` (listed below) to use the new hook so each money-showing component re-renders on its own when toggle flips:
     - `src/pages/MBRTracker.tsx`, `src/pages/Index.tsx`, `src/pages/Clients.tsx`, `src/pages/Home.tsx`, `src/pages/Targets.tsx`, `src/pages/DealDetail.tsx`, `src/pages/Settings.tsx`
     - `src/components/staffing/{SummaryTab,RevenueCapacityTab,PeopleViewTab,PeopleLevelView,MatrixTab,DealViewTab,DealLevelView,BWRulesTab,AccountsTab,BopmStaffingFlatTable}.tsx`
     - `src/components/targets/{TargetDrillDialog,FinanceTargetsCard,DealTargetsTable}.tsx`
     - `src/components/clients/BopmClientsHeader.tsx`, `src/components/rgy/DealDetailDialog.tsx`, `src/components/deals/FinancialsTab.tsx`
   - Where formatting happens inside a deeply nested helper (not a component), pass the formatter in as a prop or pull the hook in the parent and inline the call.

3. Net effect: the toggle becomes a small context update that re-renders only the components actually displaying money, not the whole app. No page flash, no scroll reset.

---

### 2) RGY Insights — VSD's "BOPM Portfolio Health Comparison" appearing hidden

**Root cause:** `bopmsForVsd(myVsdName)` (in `useVsdHierarchy`) is built from `staffing_deals.principal_bopm` + `senior_bopm` mapped by canonical VSD. If the hierarchy cache hasn't loaded yet, or no recognised BOPMs roll up to the logged-in VSD, the result is `[]` → the chart's data array is empty → nothing renders.

**Fix in `src/components/rgy/RGYInsightsTab.tsx`:**

- Compute the BOPM list directly from the VSD's own active deals as a fallback:
  ```text
  bopms = bopmsForVsd(myVsdName)
  if (bopms.length === 0):
      bopms = unique(principal_bopm | senior_bopm)
              over deals where vsdForDeal(d) == myVsdName AND ACTIVE_STATUSES.has(status)
              filtered to non-placeholder names ("TBA", "TBD", "To Be Assigned", empty)
  ```
- Always seed the bar chart `map` with every name in `bopms` (even zero counts) so the X-axis shows the BOPMs even when all categories are 0.
- Drop the existing "if everyone is empty, show empty rows" branch — replaced by the seed-then-tally pattern above which keeps the chart visible at all times.
- Update the subtitle to read "P / Sr BOPMs reporting to {VSD}" so the user always knows what bars they'll see.

---

### 3) RGY status-change rules — unified across all views

Apply the same logic in **`src/pages/RGYHealth.tsx`** (table cells) and **`src/pages/DealDetail.tsx`** (Overview + RGY tab via `EditableRGY`/`handleRGYSave`):

| Transition | Behaviour |
|---|---|
| `* → R`  or  `G → Y` | Open existing **Issue Form** to capture issue + tasks. (Today's behaviour — keep.) |
| `R → Y` | Open new **Resolve Issues dialog** listing every open issue/task linked to this deal. Resolving is **optional**: user can tick any/all and click "Save", or "Skip". State change persists either way. |
| `R → G`  or  `Y → G` | Open **Resolve Issues dialog** in **mandatory** mode. The dimension only commits to G after **every** open RGY issue/task on that deal is marked resolved. If user closes/cancels with anything still unresolved, **revert** the cell to its previous value (R or Y) optimistically and on the server. |
| `G → R` / `G → Y` | (Same as today) Issue form opens. |

**Implementation pieces:**

1. **New component** `src/components/rgy/ResolveIssuesDialog.tsx`:
   - Loads issues from `deal_rgy_weekly` rows where `issue_status in ('Open','In Progress')` for this `deal_id`, plus `[RGY Health] *` open tasks from `deal_tasks`.
   - Renders each as a checkbox list with title + dimension chip + days-open.
   - Two modes via prop: `mode: 'optional' | 'required'`.
   - Buttons: in optional mode → "Save & continue" (always enabled) + "Cancel"; in required mode → "Confirm Green" (enabled only when all rows checked) + "Cancel".
   - On save: sets `issue_status = 'Resolved'`, `resolved_at = now()` on the matching `deal_rgy_weekly` rows, and `deal_tasks.stage = 'Done'` for ticked tasks.

2. **`src/pages/RGYHealth.tsx`** — extend `handleRGYUpdate` / `applyRGYUpdate`:
   - Compute `oldValue` and `newValue`.
   - If `oldValue === 'R' && newValue === 'Y'` → snapshot, optimistic update, persist, then open `ResolveIssuesDialog mode="optional"`.
   - If `newValue === 'G' && oldValue in ('R','Y')` → **do NOT persist yet**; open `ResolveIssuesDialog mode="required"`. On confirm: persist green + log. On cancel/close: revert local cell back to `oldValue` (no DB write). This replaces today's `GreenGateDialog` which only checked tasks — keep its task-checking inside the new dialog (it already shows tasks too).
   - All other transitions unchanged.

3. **`src/pages/DealDetail.tsx`** — extend `handleRGYSave`:
   - Same matrix applied per dimension that changed. The function already detects per-dim transitions for the green-gate path; reuse that loop and route into `ResolveIssuesDialog` instead of `GreenGateDialog`.
   - For the R→Y case, save the new RGY week first, then open the optional resolve dialog.

4. **Remove / replace** the old `GreenGateDialog` definitions in both pages (they're now subsumed). Keep `RGYIssueForm` (still used for going *into* R/Y).

5. Persona-agnostic: the logic lives in the save handlers, so it applies to Admin, VSD, BOPM, Cap. Lead, Cap. IC alike.

---

### Files

**Edit**
- `src/contexts/CurrencyContext.tsx` — drop remount, add `useFormatINR` / `useFormatMoney`.
- 27 files using `formatINR`/`formatMoney` — switch to hook (small mechanical change per file).
- `src/components/rgy/RGYInsightsTab.tsx` — BOPM-list fallback for VSD chart.
- `src/pages/RGYHealth.tsx` — new transition logic, swap green-gate.
- `src/pages/DealDetail.tsx` — same transition logic in `handleRGYSave`.

**Create**
- `src/components/rgy/ResolveIssuesDialog.tsx`.

No DB schema changes (uses existing `issue_status`, `resolved_at`, `deal_tasks.stage`).