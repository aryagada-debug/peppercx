## Goal
Make Org Mapping deal-specific. Today, `useStakeholders` loads/saves by `client_name`, so every deal of the same client sees and edits the same people. Switch to deal-scoped storage, and add an opt-in "Populate from another deal" action when other deals exist for the same client.

## Changes

### 1. `src/components/deals/orgmap/useStakeholders.ts`
- Load: query `deal_stakeholders` strictly by `deal_id` (drop the `client_name` branch).
- `add` / `duplicate`: continue to write `deal_id = current dealId`; keep `client_name` populated for reference/filters but no longer use it as a load key.
- Add a new helper `listSiblingDeals()` that returns other deals for the same `client_name` (id, deal_name, count of stakeholders) using `staffing_deals` + a count query on `deal_stakeholders`.
- Add a new helper `copyFromDeal(sourceDealId)` that:
  - Reads stakeholders for `sourceDealId`.
  - Inserts copies into the current `deal_id` (new ids, preserved fields, `sort_order` continues after existing rows).
  - Reloads and toasts.

### 2. `src/components/deals/orgmap/OrgMappingTab.tsx`
- Header: keep "Add person" button; add a secondary "Populate from another deal" button, **only shown** when:
  - `clientName` is set, AND
  - sibling deals with at least one stakeholder exist.
- Clicking it opens a small picker (Popover or Dialog) listing sibling deals with their stakeholder count; selecting one calls `copyFromDeal(thatDealId)`.
- If the current deal already has stakeholders, confirm before copying ("Append N people from <deal>?"). No merge/dedupe — straightforward append; the user can then edit/remove.
- Empty state copy: when `data.length === 0` and sibling deals exist, surface the populate option inline as a secondary CTA below "Add person".

### 3. Data model
- No schema change. `deal_stakeholders.deal_id` is already present; we're just changing the read filter and adding a copy action.
- Existing rows that were shared across deals (because they were stored once and queried by `client_name`) will now only show on the specific `deal_id` they were originally inserted against. We will **not** auto-fan-out historic rows — that matches the user's intent ("don't directly populate"). Users can use the new populate action on each deal as needed.

## Out of scope
- No changes to `deal_stakeholders` schema or RLS.
- No changes to Contacts page or other consumers.
- No global "client-level contacts" view.