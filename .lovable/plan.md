# Speed up RGY Health page load

## Why it's slow today

In `src/pages/RGYHealth.tsx` `fetchData()`:

1. **Sequential batched queries.** Deals are loaded, then `deal_rgy_weekly` is queried in a `for` loop in batches of 500, each `await`ed one after another. With ~550 deals that's already 2 round trips, and each subsequent UI action waits on all of them before *anything* renders.
2. **Over-fetching.** It pulls **all** RGY rows for every deal across all history (`order("week_start", desc)` then keeps the first per deal). For deals with many weekly rows, this transfers a lot of data that's immediately discarded. Same query also does double duty to build `rgyIssues` (only used by the Insights tab, which most users don't open first).
3. **Single blocking spinner.** Nothing renders until *both* deals + all RGY history are loaded, so users stare at a skeleton for the full duration.
4. **`useAppUsers` realtime + repeated `find`s** add work on top of the initial render but aren't the main cost.

## Changes

### 1. Parallelize and slim the initial fetch (biggest win)
File: `src/pages/RGYHealth.tsx` (`fetchData`)

- Run `staffing_deals` query and the **latest** `deal_rgy_weekly` query in parallel with `Promise.all`.
- Replace the 500-batch loop with a single query (no `.in("deal_id", batch)` — fetch the latest week's RGY rows directly):
  - Compute `weekStart = getCurrentWeekStart()`. Query `deal_rgy_weekly` filtered to `week_start >= <last 8 weeks>` and order desc, then in JS keep the first per `deal_id`. This is enough to populate the current cell values + open issue (vs scanning all history).
  - This collapses 2+ sequential queries into 2 parallel queries and dramatically reduces row volume.
- Render the table as soon as `dealRows` arrives (set `loading=false`), then merge in RGY values when the second promise resolves (cells just flip from "Pending" to their real state).

### 2. Defer Insights data
- Move the `rgyIssues` construction out of `fetchData` and into a separate effect that runs **only when the Insights tab is first activated** (`activeTab === "insights"`). The Health Board doesn't need it.
- Equivalent query, but only paid for when needed.

### 3. Memoize selected deal lookup
- Replace `const selectedDeal = deals.find(...)` (runs every render) with a `useMemo` keyed on `[deals, selectedDealId]`. Tiny but free.

### 4. Render long table more cheaply
- The table currently renders every row + 8 RGY cells with `Tooltip` per cell. For 500+ deals that's 4000+ Radix tooltip subscriptions on first paint.
- Wrap each row in `React.memo` (`RGYRow` extracted component) so re-renders during typing in search/filters don't rebuild every row.
- Lazy mount tooltip content: switch `RGYCell`'s `Tooltip` to `delayDuration={300}` and only render `TooltipContent` when the trigger is hovered (current Radix behavior already does this, but ensure no `TooltipProvider` per cell — keep the single one at table level, which it already is). Minor; main gain comes from `React.memo` on the row.

### 5. Tiny cleanups
- `useAppUsers` is invoked indirectly; ensure `useVsdUsers`/`useAppUsers` aren't re-subscribing realtime channels on every parent re-render (they shouldn't, but verify hook deps).

## Expected result

- First meaningful paint of the deals table goes from "wait for all RGY history" to "as soon as deals query returns" (typically <500 ms).
- RGY cells fill in shortly after with one slim query instead of N batched ones.
- Switching to Insights triggers its own (cached) fetch instead of paying that cost up front.

## Files touched

- `src/pages/RGYHealth.tsx` — rewrite `fetchData`, split Insights data into its own effect, memoize selected deal, extract memoized `RGYRow`.

No DB schema changes, no new dependencies.