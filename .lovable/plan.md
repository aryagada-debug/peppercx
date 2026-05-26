## Problem

On `/home`, every user sees the **Financial Summary** card with all four tiles (Contraction, Delivery, Invoicing, Receivables) showing **₹0**, even though `deal_financials` has data and active deals sum to ~₹30 Cr / ₹49 Cr / ₹44 Cr.

## Root cause

`useHomeMyDealsQuery` (in `src/hooks/queries/useHomeBoardQueries.ts`) builds the financial summary by calling:

```ts
supabase.from("deal_financials")
  .select("deal_id, consumption, invoiced, received")
  .in("deal_id", ids)              // ~150–200 UUIDs for admins
```

Two compounding issues:

1. **No month filter on actuals.** The card header says `{currentMonth yyyy}`, but actuals are summed across **all months ever recorded** (~5–6k rows for admins). With ~150 active deals × ~36 months, the request exceeds PostgREST's default 1000-row cap and the long `id.in.(...)` URL — the JS client returns no data and the reducer sums to 0.
2. **Targets use current-month-with-fallback, actuals don't.** Targets already query `month = startOfMonth(today)` with a fallback to the latest month that has rows. Actuals do not, so even if (1) is fixed, numbers wouldn't align with the displayed month.

## Fix

Scope the actuals query in `useHomeMyDealsQuery` to a single month using the **same month resolution** as targets:

1. Query `deal_financials` for `month = startOfMonth(today)` only (one row per deal max → fits well under any limits and the URL stays short).
2. If that returns zero rows for the visible deals, fall back to the latest month ≤ today that has any rows for those deals (same pattern as the targets fallback already in the hook).
3. Use that resolved month for **both** actuals and targets so the tiles and the `MMM yyyy` label in the card header are consistent.
4. Keep the existing reducer logic (`contraction += consumption`, `delivery += consumption`, `invoicing += invoiced`, `receivables += max(0, invoiced − received)`).

No UI/markup changes in `Home.tsx`. No schema changes. No RLS changes (table is already public-read).

## Files touched

- `src/hooks/queries/useHomeBoardQueries.ts` — update `useHomeMyDealsQuery` to fetch month-scoped actuals with the same fallback logic targets already use.

## Verification

- Admin user: tiles populate with current-month (or latest available month) Contraction / Delivery / Invoicing / Receivables, and clicking a tile lists the contributing deals.
- VSD/BOPM user with active deals: tiles reflect only their scoped deals.
- User with no active deals: tiles stay at ₹0 with `—` target (unchanged behavior).
