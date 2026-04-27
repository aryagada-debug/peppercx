# Global Currency Toggle (INR ↔ USD)

Add a single app-wide currency switcher so every monetary value in VSD-OS can be displayed in INR (₹) or USD ($) at the user's choice.

## What the user will see

- A small **Currency** selector (₹ INR / $ USD) in the top app header (next to the theme toggle / user menu), visible on every page.
- Switching it instantly re-formats every amount across:
  - Home (Quota Tracker, Tasks, Flags)
  - Dashboard / Index (metrics, RGY, deal drawer)
  - Clients & Deals list, Deal Detail (Overview, Financials, SoW, MBR)
  - Targets page + Finance Targets card + Deal Targets table
  - Staffing tabs (Summary, Revenue Capacity, Accounts, Deal/People views, BW Rules, Matrix)
  - Revenue, MBR Tracker, GM2 Calculator, SEO Staffing, Deal Desk, Deal Form Wizard, SoW Import preview
- Choice is **remembered per user** (localStorage) and persists across reloads/sessions.
- Compact suffixes adapt: INR uses `L` / `Cr`, USD uses `K` / `M` / `B`.

## Conversion model

- Source data stays in INR in the database (no migration).
- A single FX rate `INR_PER_USD` (default **83**) is applied at display time only: `usd = inr / rate`.
- Rate is configurable in one place (`src/lib/currency.ts`) so it can later be wired to a live feed without touching call sites.

## Technical approach

1. **`src/lib/currency.ts` (new)**
   - `type Currency = 'INR' | 'USD'`
   - `INR_PER_USD = 83` constant.
   - `formatMoney(amountInInr: number, currency: Currency, opts?: { compact?: boolean })`:
     - INR compact: `₹0` / `₹1,23,456` / `₹1.2L` / `₹1.20Cr`
     - USD compact: `$0` / `$1,234` / `$12.3K` / `$1.23M` / `$1.20B`
   - `formatMoneyFull(...)` for non-compact (tables/inputs).

2. **`src/contexts/CurrencyContext.tsx` (new)**
   - Provides `{ currency, setCurrency, format, formatFull }`.
   - Persists selection in `localStorage` key `vsd.currency`.
   - Wrap app inside `src/App.tsx` (above existing providers).

3. **`src/components/layout/CurrencyToggle.tsx` (new)**
   - Small `Select` (₹ INR / $ USD), mounted in `AppLayout` header.

4. **Refactor `formatINR`** in `src/lib/csvTargets.ts`:
   - Re-export becomes a thin wrapper that reads context-free fallback (INR) for any non-React caller, but **all React call sites switch to `useCurrency().format(...)`**.
   - Update the ~30 files listed below to call `format()` from context instead of the hard-coded `formatINR` / inline `₹` strings.

5. **Files to update** (replace `₹...` literals and `formatINR` calls with `useCurrency().format(...)`):
   - `src/lib/csvTargets.ts` (keep INR fallback, mark as legacy)
   - `src/components/targets/{FinanceTargetsCard,DealTargetsTable}.tsx`
   - `src/components/staffing/{SummaryTab,RevenueCapacityTab,PeopleViewTab,PeopleLevelView,MatrixTab,DealViewTab,DealLevelView,BWRulesTab,AccountsTab}.tsx`
   - `src/components/deals/{FinancialsTab,SoWImportDialog,DealFormWizard}.tsx`
   - `src/components/rgy/DealDetailDialog.tsx`
   - `src/components/mbr/MBRDetailDialog.tsx`
   - `src/pages/{Targets,Deals,DealDetail,DealDesk,Clients,Revenue,MBRTracker,GM2Calculator,SEOStaffing,Home,Index}.tsx`
   - `src/data/dashboardMocks.ts` (only display strings, if any — leave raw numbers untouched)

6. **Inputs (deal value, MRR, etc.)** in `DealFormWizard` and `GM2Calculator`:
   - Show the active currency symbol next to inputs.
   - Internally store INR. If user enters in USD mode, multiply by `INR_PER_USD` before saving; on load, divide for display.

## Out of scope

- Live FX rates (constant 83 for now; one-line change later).
- Per-deal native currency tracking.
- Backend/database changes — none required.

## Acceptance

- Toggle appears in header on every page.
- Flipping to USD re-renders every visible amount with `$` and USD-compact suffixes; flipping back to INR restores `₹` and L/Cr.
- Selection persists across reloads and route changes.
- No raw `₹` literal remains in the listed React files.
