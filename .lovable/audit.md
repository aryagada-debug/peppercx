# App Audit — Currency, Users, Performance (May 2026)

## Currency — fixed in this pass
- DealDetail: KPI inputs (MRR, Total/Retainer/Non-Retainer Value), SoW value column + line input, hourly rate input, Financial Metric Cards now use `CURRENCY_SYMBOL[currency]`.
- Clients: MRR + Total Revenue inline edits use dynamic symbol.
- FinancialsTab: literal `"₹0"` fallbacks routed through `fmtCurrency(0)`; AddMonthDialog labels show active currency.
- SoWImportDialog: `Value (₹)` header now dynamic.
- MBRDetailDialog: MRR row now uses `formatINR` (currency-aware via global mirror).
- GM2Calculator: every ₹ literal replaced with `formatINR(...)`; subscribes via `useCurrencyVersion`.
- CurrencyContext: replaced "Neema → USD" name hack with `profiles.default_currency` lookup.

## Currency — flagged (mock-only pages, not fixed)
These pages still display literal `₹...` strings because their data is hardcoded mocks. They will not respond to the toggle until rewired to live data — confirm before refactoring:
- `src/pages/Deals.tsx`
- `src/pages/Revenue.tsx`
- `src/pages/SEOStaffing.tsx`
- `src/pages/DealDesk.tsx`
- `src/data/dashboardMocks.ts`

## Users — single source of truth
- Source: `useAppUsers()` joining `staffing_people` + `profiles` + `user_roles`. Already realtime + cached.
- Realtime channels in `useAppUsers` / `useVsdHierarchy` / `useBopmDirectory` now use **stable channel names** and a **500ms debounce**, so bursty writes no longer trigger 3 full reloads.

### Flagged (deferred)
- `VSD_NAMES` is still a hardcoded list of 5. Should be derived from `staffing_people` (designation/role match). Adding/removing a VSD in Settings does not flow through today.
- Free-text BOPM/VSD strings on `staffing_deals` (`vsd`, `principal_bopm`, `senior_bopm`) cause silent drops in rollups when typos exist; need a Settings UI to surface unmapped names.
- `RoleSwitcher` (demo) vs `AuthProvider` identity paths — confirm both read from the same `useUserRole` hook.
- Audit task assignees / MBR owners that may still display raw deal-cell strings instead of resolved `byNameKey` display name.

## Performance — fixed in this pass
- Stable channel names + debounced realtime in `useAppUsers` (no more leaked subscriptions on HMR).
- Added DB indexes:
  - `deal_financials(deal_id, month)`
  - `deal_tasks(deal_id)`
  - `mbr_entries(deal_id)`
  - `staffing_people(lower(email))`
  - `profiles(staffing_person_id)`
  - `user_roles(user_id)`
  - `personal_todos(user_id)`, `personal_todos(assignee_staffing_person_id)`
- `profiles.default_currency` column added (replaces fragile name match).

### Flagged (deferred — bigger refactors)
- `pages/DealDetail.tsx` (≈2900 LOC), `pages/Home.tsx` (≈2000 LOC), `pages/Clients.tsx` (≈1100 LOC) are monolithic — each state change re-renders the whole tree. Recommend splitting tabs into `React.lazy` routes/components.
- No request-level cache (React Query / SWR). Tab toggles re-fetch full tables.
- No virtualization on 500+ row tables (Clients, Staffing). Recommend `@tanstack/react-virtual` once tables stay below this scale becomes unrealistic.
- `useAppUsers.loadHierarchy` scans full `staffing_deals` on every refresh tick — consider a server-side aggregate.
- Memoization audit on filtered/sorted lists in Clients/Staffing/MBR (large derived arrays computed every render).

## Database
- Linter still reports pre-existing WARNs (permissive RLS on legacy `Anyone can …` tables, extension-in-public). Not introduced by this pass — track separately for a security hardening sprint.