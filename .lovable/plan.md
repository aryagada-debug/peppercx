# Audit & Sync Fix Plan — Currency, Users, Performance

This is a focused audit + remediation. We'll fix the highest-impact sync and latency issues now and flag the rest. Mock-only pages (`Deals`, `Revenue`, `SEOStaffing`, `DealDesk`) are deprecated/seed views — flagged but not rewritten unless you confirm.

---

## 1. Currency — make every ₹ flow through the toggle

**Single source of truth**: `useCurrency()` / `formatGlobalMoney()` in `src/contexts/CurrencyContext.tsx` (already correct). Stored values are INR; display goes through `formatMoney(amountInInr, currency, opts, fxRate)`.

**Gaps found (will fix)**


| File                                   | Issue                                                                                                                                                         | Fix                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `pages/DealDetail.tsx`                 | `prefix="₹"` on MRR / Total / Retainer / Non-Retainer / SoW line value / Hourly Rate inputs; "Value (₹)" header                                               | Use `CURRENCY_SYMBOL[currency]` for prefix; header label dynamic                                                     |
| `pages/Clients.tsx`                    | `prefix="₹"` on MRR + Total Revenue inline edits                                                                                                              | Same                                                                                                                 |
| `components/deals/FinancialsTab.tsx`   | `"₹0"` fallback string; column labels `"Contracted (₹)"`, `"Contraction (₹)"`, `"Invoiced (₹)"`, `"Received (₹)"`; some `fmtCurrency` paths bypass context fx | Replace literals with `format(0)`; labels use `CURRENCY_SYMBOL`; route all formatting through `useCurrency().format` |
| `components/deals/SoWImportDialog.tsx` | `Value (₹)` header                                                                                                                                            | Dynamic symbol                                                                                                       |
| `components/mbr/MBRDetailDialog.tsx`   | `₹${deal.mrr.toLocaleString("en-IN")}`                                                                                                                        | `format(deal.mrr)`                                                                                                   |
| `pages/GM2Calculator.tsx`              | All KPI/cost cells hardcoded ₹ + `/100000`, `/1e7`                                                                                                            | Route through `format()`; fx rate respected                                                                          |
| `lib/csvTargets.ts`                    | Already uses `getGlobalCurrency/Fx` ✓                                                                                                                         | No change                                                                                                            |


**Subscription**: every page currently using `formatINR` / `formatMoney` directly without `useCurrency()` will get `useCurrencyVersion()` added so the toggle re-renders them.

**Mock-only (flagged, not auto-fixed)**: `Deals`, `Revenue`, `SEOStaffing`, `DealDesk` use static seed data with literal ₹ strings. Confirm if you want them rewired to live data — otherwise they will not respond to the $/₹ toggle.

---

## 2. User mapping — one directory, everywhere

**Source of truth**: `useAppUsers()` (`src/hooks/useAppUsers.ts`) which joins `staffing_people` + `profiles` + `user_roles`. Already realtime-bound. Resolvers: `useVsdUsers`, `useVsdHierarchy`, `useBopmDirectory`.

**Gaps**

&nbsp;

&nbsp;

1. **MBR/Deal owners, task assignees** sometimes display the raw deal column instead of the resolved AppUser display name. Audit and route through `byNameKey`.
2. **Demo/role switcher** (`RoleSwitcher`) writes a different identity than `AuthProvider` reads in some flows — confirm both paths read from the same `useUserRole` hook.

**Fix scope (this pass)**: items 1, 3, 4. Items 2 and 5 logged with notes.

---

## 3. Performance — cut latency on the biggest pages

**Findings**

- **Clients.tsx (1144 LOC), DealDetail.tsx (2929 LOC), Home.tsx (2025 LOC)** — single monolithic components, every state change re-renders the whole tree.
- **18+ realtime channels** spread across hooks. Each `useAppUsers` / `useVsdHierarchy` / `useBopmDirectory` opens a *new* channel on every module init using `Date.now()` suffix, and the cleanup only runs when the *module* re-evaluates (HMR). On the live app the channel is fine, but every page that mounts a hook with its own `supabase.channel(...)` inside `useEffect` without proper teardown leaks a websocket subscription.
- **No request deduping**: `useStaffingData`, `useDealDetail`, `useMBRData` each do fresh full-table fetches on mount. No SWR/React Query layer. Toggling tabs refetches everything.
- **N+1 inside `useAppUsers` `loadHierarchy**` — full `staffing_deals` scan (550+ rows) on every realtime tick.
- **Heavy synchronous filters** in Clients/Staffing tables (no memoization on derived rows).
- **Currency toggle** triggers `useCurrencyVersion()` re-render of *whole pages* — fine, but combined with the monoliths above is visibly laggy.

**Fixes (this pass)**

1. **Memoize derived lists** in `Clients.tsx`, `pages/Staffing.tsx` tabs, `MBRTracker` (group/sort/filter outputs behind `useMemo` keyed on inputs).
2. **Audit all `supabase.channel(...).subscribe()` sites** and ensure each `useEffect` returns a cleanup that calls `supabase.removeChannel(ch)`. Replace `Date.now()` channel names with stable IDs so HMR doesn't pile up.
3. **Coalesce realtime refresh** in `useAppUsers` (debounce 500ms) — staffing_people / profiles / roles rapid-fire writes currently trigger 3 full reloads.
4. **Lazy-load heavy tabs** in `DealDetail.tsx` (Financials, Tasks, SoW, Staffing) via `React.lazy`/`Suspense` so initial render is just the header + summary.
5. **Index check**: confirm DB has indexes on `staffing_assignments(deal_id)`, `staffing_assignments(person_id)`, `deal_financials(deal_id, month)`, `mbr_entries(deal_id, week_start)`, `deal_rgy_weekly(deal_id, week_start)`. Add any missing via migration.
6. **Split `Home.tsx**` into per-card components so the calendar refresh / Slack panel / nudges don't re-render each other.

**Deferred (flagged)**: introducing React Query, virtualization (`@tanstack/react-virtual`) for the 550-row tables, splitting `DealDetail` into a route-per-tab. These are larger refactors — recommend after current pass.

---

## Deliverables

1. Currency: every editable input + display in **DealDetail, Clients, FinancialsTab, SoWImportDialog, MBRDetailDialog, GM2Calculator** routed through `useCurrency().format` and `CURRENCY_SYMBOL`.
2. Users: `VSD_NAMES` derived from `staffing_people` (designation/role match) with fallback to today's hardcoded list; `profiles.default_currency` migration + replace Neema substring hack.
3. Perf: realtime channel teardown audit + debounce; memoized filters in Clients/Staffing/MBR; `React.lazy` on DealDetail tabs; missing DB indexes added.
4. Audit doc (`.lovable/audit.md`): full list of remaining mock pages, deferred refactors, and unmapped name examples for you to triage.

## Out of scope (call out before starting)

- Rewriting `Deals.tsx`, `Revenue.tsx`, `SEOStaffing.tsx`, `DealDesk.tsx` from mocks to live data.
- Introducing React Query / virtualization.
- Splitting `DealDetail.tsx` into separate routes.

Tell me to proceed, or call out which deferred items you want pulled into this pass.