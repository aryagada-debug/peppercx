## Goal

Adopt the per-deal **Staffing tab** flow (the one inside Clients & Deals → Deal Detail) as the **default/primary view** of the `Staffing & Capacity` module. The current flat spreadsheet (`BopmStaffingFlatTable`) becomes a secondary "Sheet view". Both views group columns/sections by **Department**, with Delivery Ops and CS first.

No backend, schema, or business-logic changes — purely a frontend reshape.

---

## What the new default view looks like

A scrollable list of **deal cards**, each card mirroring the per-deal Staffing tab layout:

```text
┌─ Deal: <Account> — <Deal Name>   [Add Staffing] [Request] [⋯] ┐
│  KPI strip: Team Size · Hrs/Wk · Cost/Wk (admin) · Rev Managed │
│                                                                │
│  ── Delivery Ops ───────────────────────  3 members ──         │
│   Name | Role | Pod | Allocation | Hrs/Wk | Rate | Cost | Rev  │
│   …                                                            │
│                                                                │
│  ── CS (Content Strategy) ──────────────  2 members ──         │
│   …                                                            │
│                                                                │
│  ── Content / SEO / Creative … ──                              │
└────────────────────────────────────────────────────────────────┘
```

Rules:
- Department-first grouping (replacing the old per-deal `roleCategory` grouping). **Order:** Delivery Ops → CS (Content Strategy) → Content → SEO → Creative Strategy → Creative Copy → Creative Art → Video → Performance & Growth → Other / Unassigned. Use `useTaxonomyQuery` + the per-deal applicability index so hidden departments don't render.
- Per-row controls (allocation inline-edit, remove, rate edit) reuse the exact JSX already in `DealDetail` Staffing tab.
- "Add Staffing" / "Request Staffing" open the existing shared `AddStaffingMemberDialog` / `RequestStaffingDialog`, prefilled with the card's `dealId`.
- Card header carries the admin gear (`DealApplicabilityPopover`) and the deal lock control already used today.
- Top-of-page controls: deal search box, `BopmFilter`, `DealTypeFilter`, and a status toggle (active / all). Same filters the current Sheet view already exposes — reuse the same handlers.

## What changes in Staffing & Capacity tabs

`src/pages/Staffing.tsx`:
- Replace the current admin tab set with: **`Staffing` (new default cards) · `Sheet view` (the existing flat table) · `Deal view` · `Lock Analytics`**.
- `tab` default becomes `"staffing"` (was `"table"`). URL param `?tab=table` keeps working via the existing normalizer, but now resolves to **Sheet view**.
- BOPM persona: default also becomes the new Staffing cards (read-only); "Sheet view" remains hidden for them, "Change requests" stays.
- Keep the lazy-mount / `hidden`-class pattern already in `Staffing.tsx` so switching tabs preserves drafts.

## Sheet view (existing flat table) — column re-ordering only

`src/components/staffing/BopmStaffingFlatTable.tsx`:
- The column groups today are derived from `ROLE_SLOTS` (category → roles). Re-sort the *group order* so **Delivery Ops first, then CS, then the rest** (same explicit order as above). Within each group, role columns keep their current order.
- No structural / write-path changes; only the `ROLE_SLOTS` traversal that builds visible column groups is reordered (use a `DEPT_ORDER` array keyed by `ROLE_TYPE_TO_DEPT`).

## New shared component

`src/components/staffing/DealStaffingCard.tsx` (new):
- Props: `deal`, `dealPeople`, `dealAssignments`, `people`, `assignments`, `isAdmin`, mutation callbacks (`addAssignment`, `updateAssignment`, `deleteAssignment`, `updatePerson`, `updateDeal`).
- Renders the KPI strip + department-grouped tables exactly like `DealDetail` Staffing tab (lifted out so both places share code).
- Uses `useTaxonomyQuery` + `useDealApplicabilityQuery` (per-deal) to drive group order/visibility.

Then `DealDetail.tsx` Staffing tab body (lines ~2475–2620) is replaced with `<DealStaffingCard … />` so the per-deal page and the module page stay byte-identical visually.

## New container

`src/components/staffing/StaffingDealsList.tsx` (new):
- Receives the already-scoped `deals/people/assignments` from `Staffing.tsx`.
- Owns the top filter bar (search, BopmFilter, DealTypeFilter, status toggle, sort) and renders `<DealStaffingCard>` per deal.
- Virtualises with a simple "show 20 / load more" pager (cheap) — Staffing & Capacity can have 500+ deals; mounting them all eagerly would crash like the historical issue called out in `Staffing.tsx`.

## Files

**New**
- `src/components/staffing/DealStaffingCard.tsx`
- `src/components/staffing/StaffingDealsList.tsx`

**Edited**
- `src/pages/Staffing.tsx` — new tab set, default = `staffing`, mount `StaffingDealsList`.
- `src/components/staffing/BopmStaffingFlatTable.tsx` — reorder column groups by department (Delivery Ops + CS first).
- `src/pages/DealDetail.tsx` — Staffing tab body swapped to `<DealStaffingCard />`.

**Unchanged**
- DB schema, mutations, applicability/lock RPCs, query keys, `AddStaffingMemberDialog`, `RequestStaffingDialog`, `WeeklyStaffingGrid`, `DealViewTab`, `LockAnalyticsTab`, `BopmStaffingSummary`.

## Out of scope
- Re-skinning Deal view / Lock Analytics / People Ops.
- Changing what data is shown per row (same columns as the deal page today).
- Any change to capacity / utilisation calculations.

## Open question (will assume "yes" unless told otherwise)
- Should the **BOPM persona** also see the new cards as their default (read-only, no Add/Request buttons)? Plan above assumes **yes**.
