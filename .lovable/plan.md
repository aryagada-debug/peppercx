## Problem

`sheets-sync-deals` overwrites `vsd / principal_bopm / senior_bopm / bopm` on `staffing_deals` from columns I–L of the master sheet every run. The app's "Add Staffing Member" flow writes the same fields via the `sync_bopm_fields_from_assignment` trigger. Whoever runs last wins, so in-app assignments (e.g. Simran as Senior BOPM) get clobbered back to the sheet value (Karna), and `useDealAccess` then hides the deal from Simran.

Per your direction: the sheet is for **financials + deal metadata only**, not staffing.

## Changes

### 1. `supabase/functions/sheets-sync-deals/index.ts`
Remove the four staffing columns from the deal upsert payload (lines 166–169):
- Drop `vsd`, `principal_bopm`, `senior_bopm`, `bopm` from `dealPayload`.
- Keep everything else (pc_code, deal_id, deal_name, account, sales_leader, sales_rep, geo, revenue_type, dates, MRR, deal values, financials) unchanged.

Result: future syncs never touch staffing columns. `staffing_assignments` + the existing recompute trigger become the sole writer.

### 2. One-shot reconcile migration
For every existing `staffing_deals` row, re-derive `vsd / principal_bopm / senior_bopm / bopm` from currently-active `staffing_assignments` (matching role_key, `end_date IS NULL OR end_date >= CURRENT_DATE`). This fixes rows already corrupted by past syncs (incl. Simran's deals) in one pass. Where no active assignment exists for a role, leave the existing text value untouched so we don't blank out deals that were only ever populated from the sheet.

### 3. No frontend change required
With staffing columns now authoritative from assignments, `useDealAccess`'s current name-match logic will correctly grant Simran access. (We can still harden it to also check `staffing_assignments` directly as a later defense-in-depth pass — flag for follow-up, not in this plan.)

## Out of scope
- Realtime/RLS hardening from the earlier audit.
- Backfilling deals whose staffing was *only* ever in the sheet and never reassigned in-app (those keep their current sheet-sourced names).