## Targets page improvements

Scope is `src/pages/Targets.tsx` only (presentation + the existing Supabase query already on the page). Mirrors how `Clients.tsx` scopes deals.

### 1. Capability persona — show only their deals (same as Clients & Deals)

Today `Targets.tsx` fetches `staffing_deals` directly and shows every active deal regardless of the signed-in user's role. A `capability_lead` / `capability_member` therefore sees deals outside their capability, and the VSD/BOPM filter chips don't narrow things the way they expect.

Change:
- Import `useDealAccess` (already used by `Clients.tsx`).
- After loading deals, filter to `access.canViewDeal(d.id)` when `!access.isAdmin`. Capability Lead → only their team's staffed deals. Capability Member → only their personally assigned deals. Admin / VSD / BOPM behavior is unchanged.
- Recompute `filteredDeals`, summary totals, and "needs target" counts on the scoped list so the KPI strip matches what's shown in the table.

### 2. Filter issue

The current VSD chips list (`vsdList`) is built from `deals` before scoping, so a capability user sees VSDs they can't actually filter into and the "BOPM" chip likewise lists irrelevant names. Once deals are scoped (step 1), `vsdList` and the BOPM filter will automatically reflect only deals the user can see, fixing the filter behavior.

Additionally: hide the VSD/BOPM chip row entirely for `capability_member` (single user — nothing to filter by). Capability Lead keeps the chips since their team can span multiple VSDs/BOPMs.

### 3. Show / hide completed deals (active by default)

The deal fetch is hard-coded to active statuses:

```text
["Active Deal", "New Deal in SLA/PO", "Deal - Open and WIP", "Deal in Renewal Process"]
```

Change:
- Add a `showCompleted` state, default `false`.
- Add a toggle (Switch + label "Show completed deals") in the header row next to the Overall toggle.
- When ON, drop the `.in("deal_status", […])` filter so closed / lost / churned deals are also pulled. Append a small "Completed" badge in the deal cell so they're distinguishable.
- The toggle is part of the `load` dependency list so flipping it refetches.

### 4. Targets are populated by the uploaded CSV — confirm + MRR defaults

Yes — `deal_financial_targets` rows are populated by the **Import CSV** dialog (`TargetsUploadDialog` → `parseWideDealCsv` in `src/lib/csvTargets.ts`, matching the master sheet's `Consumption / Delivery / Invoicing / Receivable — <Month> Target` columns). That's what the Targets table reads back.

Update the auto-fill rule so invoicing + receivables always default to MRR when the CSV doesn't supply them:

- Existing `bulkMatchMrr` button: keep as-is for all four metrics.
- New behavior on render: when a deal has `mrr > 0` and no row in `deal_financial_targets` for the month, treat **invoicing_target** and **receivables_target** as `mrr` (display only). Admin save still writes the explicit value if edited.
- Contraction / Delivery monthly targets continue to require an explicit value or the existing MRR-fill flow.

This makes the "expected invoicing / receivables = MRR per month" rule the implicit default everywhere targets are read on this page (KPI strip, table, expanded YTD/Lifetime rollups).

### Files touched

- `src/pages/Targets.tsx` — all four changes.

No DB migration, no backend changes, no edits to `DealTargetsTable.tsx` (used elsewhere with its own scoping).
