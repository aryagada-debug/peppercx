## Problem

Anisha is seeing deals she's not actually tagged on (e.g. ITC Dark Fantasy with no BOPM, ITC Engage with no BOPM, PhonePe Graphic Designer where Rahul Singh is BOPM, Persistent Podcasts 2.0 where Karishma is BOPM).

## Root cause

`useDealAccess.ts` grants visibility based on the **union** of two sources:

1. Name match against `staffing_deals.principal_bopm` / `senior_bopm` / `bopm` (the actual cells visible in the table).
2. Any row in `staffing_assignments` where `person_id = me`.

Source #2 is the leak. The `staffing_assignments` table contains many "ghost" rows for BOPM-tier roles that do **not** correspond to what's actually written in the deal's BOPM cells. For Anisha (P178), 33 assignment rows exist; many of them point to deals where the actual `senior_bopm` cell is empty, or holds someone else (Rahul Singh, Karishma Sawlani, Vivek Teotia, Romario Fernandes, Dwayne Fernandes, etc.).

These ghost rows likely came from old imports / role-template seeding and are out of sync with the current source-of-truth deal sheet. The same pattern affects every BOPM/Sr.BOPM user, not just Anisha.

## Fix

Change visibility to be driven **only** by the deal sheet cells (`principal_bopm`, `senior_bopm`, `bopm`, `vsd`) — the same cells that render in the UI. Treat `staffing_assignments` as a **delivery / capacity** record (used by Staffing tab math), **not** as an access-grant source for BOPM-tier users.

Specifically, in `src/hooks/useDealAccess.ts`:

- Remove `myAssignedDealIds` from the BOPM-tier visibility computation. A non-VSD user sees a deal **only** when their name fuzzy-matches one of `principal_bopm`, `senior_bopm`, or `bopm` on that deal.
- Keep the existing VSD branch unchanged: VSDs still see deals where `vsd` matches them, plus deals whose principal/senior BOPM rolls up under their pod (already derived from the deal sheet itself).
- Admin path unchanged.

This guarantees the rule "if your name does not appear in the BOPM/VSD cell of a deal, you cannot see that deal" — which matches what users expect when they look at the Clients & Deals table.

### Side-effect review

- **Staffing tab** (`useStaffingData`) still reads `staffing_assignments` for capacity/utilisation math — unaffected.
- **Deal Detail page**: gated by `canViewDeal`. After the fix, a BOPM whose name isn't on the deal sheet can no longer open the page directly — correct behaviour.
- **MBR / RGY / Financials**: all gated by the same `useDealAccess` set, so they tighten consistently (no more peer/ghost leakage).
- VSDs are unaffected because their visibility is computed from `vsd` cell + pod rollup, not from `staffing_assignments`.

### Optional follow-up (not part of this change)

The 1,020 rows in `staffing_assignments` are stale relative to the deal sheet. We can offer a one-time cleanup migration later that deletes BOPM-role assignment rows whose `person_id` no longer matches the corresponding deal's BOPM cells. Not doing it now keeps the change minimal and reversible — visibility is fixed purely in the access layer.

## Files to edit

- `src/hooks/useDealAccess.ts` — drop the `myAssignedDealIds` branch from the non-admin visibility loop; keep the variable populated so we don't break other consumers, but stop OR-ing it into `ownDealIds`.

No DB migration, no UI changes. After the fix, Anisha (and every other BOPM/Sr.BOPM) will only see deals whose BOPM cells contain their name.
