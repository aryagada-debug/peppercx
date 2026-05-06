## Goal
1. Add an app-wide currency toggle (₹ INR ↔ $ USD) with a small editable FX-rate input — both persisted across sessions.
2. Default Neema's VSD view to USD on first load.
3. Make every numeric cell on the MBR Tracker → Insights table clickable for all personas, opening the existing accounts drill (Account / Deal ID / Deal Name link / Status) — same UX as RGY Health.

## 1. Currency context

### `src/contexts/CurrencyContext.tsx` (new)
- Provides `{ currency, setCurrency, fxRate, setFxRate, formatMoney(amountInInr, opts) }`.
- Initial state:
  - `currency` from `localStorage.vsdos.currency` if present.
  - `fxRate` from `localStorage.vsdos.fxRate`, default `83`.
- On mount, if no stored currency, look up the logged-in user via `profiles.staffing_person_id` → `staffing_people.name`. If `canonVsd(name) === "Neema Jayadas"`, default to `USD`.
- Wraps `formatMoney` from `src/lib/currency.ts` but uses the live `fxRate` instead of the hard-coded `INR_PER_USD`.

### `src/lib/currency.ts`
- Add overload `formatMoney(amountInInr, currency, opts, fxRate?)` — when `fxRate` is provided, divide by it instead of `INR_PER_USD`. Existing default keeps backward compatibility.
- Export `useMoney()` thin re-export from the context for convenience.

### Mount the provider
- Wrap in `src/App.tsx` near `UserRoleProvider`.

### Toggle UI in header
- New `src/components/layout/CurrencyToggle.tsx`:
  - Compact segmented `₹` / `$` switch.
  - Tiny label "1 USD =" + numeric input bound to `fxRate` (`w-[64px] h-7 text-xs`), only enabled / visible (or just visible greyed) — show always, subtle.
- Render in `src/components/layout/AppLayout.tsx` header alongside `ThemeToggle`.

### Adopt the toggle across pages
- Replace `formatINR(n)` and ad-hoc `₹` formatters with `useMoney().format(n)` in the high-traffic surfaces:
  - `pages/MBRTracker.tsx`, `pages/Index.tsx`, `pages/Targets.tsx`, `pages/Revenue.tsx`, `pages/Clients.tsx`, `pages/Deals.tsx`, `pages/DealDetail.tsx`, `pages/SEOStaffing.tsx`, `pages/Home.tsx`, `pages/DealDesk.tsx`, `pages/GM2Calculator.tsx`.
  - `components/targets/*`, `components/deals/FinancialsTab.tsx`, `components/deals/SoWImportDialog.tsx`, `components/dashboard/DealScorecardTable.tsx`, `components/staffing/*`, `components/rgy/DealDetailDialog.tsx`, `components/mbr/MBRDetailDialog.tsx`, `components/clients/BopmClientsHeader.tsx`.
- Keep `formatINR` re-exported from `lib/csvTargets.ts` as a thin shim that calls the context default (for non-React utility paths like CSV exports → these stay in INR explicitly).

### Persistence
- `setCurrency` and `setFxRate` write to localStorage immediately. Single global store; the same value is used by every consumer.

## 2. MBR Tracker — Insights drill for all personas

### `src/pages/MBRTracker.tsx`
The drill dialog and `NumBtn` already exist. The remaining gap is that the `vsdInsights` / `bopmInsights` tables only render for non-BOPM personas in some branches and the persona filtering hides Insights entirely from BOPM. Changes:
- Allow the **Insights** tab to render for every persona (`isBopmPersona`, `isVsdPersona`, `capability_lead`, `capability_member`, `admin`):
  - Remove the `defaultValue={isBopmPersona ? "table" : "insights"}` lock; default to `insights` for everyone, but keep the existing scope filtering (BOPM → own deals, VSD → own pod, etc. — already handled by `filteredDeals`).
  - Show the Insights `TabsTrigger` for all personas.
- Confirm `NumBtn` is wired to every numeric cell (Accounts, Done, Not Done, Pending, 🟢, 🟡, 🔴, Scheduled). It is — no change.
- Confirm the drill dialog shows Account / Deal ID / Deal Name (link to `/deals/:id`) / Status — it already does. No change.
- Persona-specific scoping verification:
  - `filteredDeals` already filters by `visibleDealIds` for BOPM and by VSD for `isVsdPersona`. Capability lead / member fall through to the same `useDealAccess` scope. No additional changes needed; reuse as-is.

## Out of scope
- No DB schema changes (FX rate stays client-only, per user, no shared state needed yet).
- CSV exports continue in INR.
- Per-input `<CurrencyInput>` component is unchanged.

## Files touched
- new: `src/contexts/CurrencyContext.tsx`, `src/components/layout/CurrencyToggle.tsx`
- edited: `src/lib/currency.ts`, `src/lib/csvTargets.ts`, `src/App.tsx`, `src/components/layout/AppLayout.tsx`, `src/pages/MBRTracker.tsx`, plus the money-formatting call sites listed above (~25 files; mechanical `formatINR(x)` → `format(x)` swap inside components that already render React).