## Goal
Make the Pulse / NPS top filter bar match the Clients & Deals page, and let users bulk-select every visible deal in the left pane.

## Changes

### 1. Replace the current VSD/BOPM dropdowns with the Clients-style chip bar
In `src/components/rgy/PulseSurveyTab.tsx`:
- Reuse the same building blocks as `src/pages/Clients.tsx`:
  - `useVsdUsers`, `nameKey` from `@/hooks/queries/legacy`
  - `BopmFilter` from `@/components/access/BopmFilter`
  - `UNASSIGNED_VSD_VALUES` constant (copied/imported)
- Render the same chip row in this order:
  - `All` · one chip per VSD user · `Other` · `Unassigned`
  - `BopmFilter` dropdown (scoped to selected VSD when a specific VSD chip is active, matching Clients behavior)
  - Search box with the same `Search clients, deals or deal ID…` placeholder, clear button, identical styling
  - `Closed` checkbox at the right (see point 3)
- Drop the existing `Select` based VSD/BOPM filters and the small "Clear filters" link — the chip bar replaces them.
- Filtering logic mirrors Clients:
  - `Unassigned` → `vsd` value is empty / "Not Assigned" / etc.
  - `Other` → has a vsd value that isn't in the known VSD list
  - specific VSD → `canonVsd(deal.vsd) === activeVsd`
  - BOPM filter matches against `principal_bopm` / `senior_bopm` / `bopm`
- Search matches account, deal_name, or `deal_id`.
- Only show the VSD chip row to admins / capability leads (same gate as Clients via `useUserRole().canEditAll` or equivalent). Non-leadership users still see BOPM filter + search.

### 2. "Select all deals" in the left deals pane
- Above the deal list (next to the existing "X deals" count / search), add a `Select all` / `Clear all` toggle that operates on `filteredDeals`:
  - When none/some of `filteredDeals` are selected → button reads `Select all (N)`, clicking adds every `filteredDeals[i].deal_id` to `selectedDealIds`.
  - When all of `filteredDeals` are already selected → button reads `Clear selection`, clicking empties `selectedDealIds`.
- Auto-population of `selectedEmails` for newly opened deals already exists, so bulk selection will lazily load stakeholders and pre-check their emails as the per-deal queries resolve.
- Guardrail: if `filteredDeals.length > 50`, show a confirm toast ("Select all 137 deals? Stakeholders will load in the background.") before applying, to avoid accidental huge sends.

### 3. Closed deals toggle
- Today `src/pages/PulseNPS.tsx` only queries `staffing_deals` whose `deal_status` is in the active set. The Clients filter bar has a `Closed` checkbox, so add the same control.
- Lift a `showClosed` state into `PulseNPS.tsx` (or pass it down) and:
  - When unchecked (default) → keep the current `ACTIVE_STATUSES` filter.
  - When checked → drop the `.in("deal_status", …)` filter so closed deals also load.
- Render the checkbox inside the filter row in `PulseSurveyTab` and surface its value to the parent via a prop, mirroring the Clients UX.

## Out of scope
- No schema/RLS changes.
- No edits to send-survey logic; selection mechanics stay as-is.
- No change to the right-hand recipients panel, summary stats, or recent invites table.
