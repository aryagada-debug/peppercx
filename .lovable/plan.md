# Targets & Attainment by VSD

Replace the mock Targets page (Operations → Targets) with a real, data-driven module covering four finance metrics — **Contraction, Delivery, Invoicing, Receivables** — broken down by VSD, populated via monthly CSV upload (Google Sheets sync deferred to a later iteration). Org-wide totals also appear on Home and the Dashboard.

## What you'll see

### Targets page (`/targets`)

- Header: month switcher (defaults to current month) + **Upload CSV** button + **Download template** link.
- 4 KPI tiles across the top (one per metric): Total Target, Total Actual, % Attainment, color-coded (green ≥95%, amber 80–94%, red <80%).
- Main table — one row per VSD, columns grouped under each metric:

```text
                Contraction              Delivery               Invoicing             Receivables
VSD       Target  Actual  Attain%   Target  Actual  Attain%   Target  Actual  Attain%   Target  Actual  Attain%
```

  Cells use the same R/A/G coloring on the attainment %. A **Total** footer row sums the portfolio.

- Empty state with clear "Upload your first month" CTA.

### Home (`/`)

- New compact card **"Finance Targets —** &nbsp;**"** under the existing KPI strip, showing 4 mini-tiles (Contraction / Delivery / Invoicing / Receivables) each with Target, Actual, %.
- Card links to `/targets`. I want table for the deals and its Contraction / Delivery / Invoicing / Receivables

### Dashboard (`/`, the Index/portfolio overview)

- New row of 4 metric cards above the existing alerts section: same four metrics, org totals only.  I want table for the deals and its Contraction / Delivery / Invoicing / Receivables

## CSV upload flow

- Click **Upload CSV** → file picker → preview dialog → confirm → upserts into a new `vsd_financial_targets` table.
- Expected columns (header row required, case-insensitive):
`month, vsd, contraction_target, contraction_actual, delivery_target, delivery_actual, invoicing_target, invoicing_actual, receivables_target, receivables_actual`
- `month` accepts `YYYY-MM` or any parseable date (normalized to month-start).
- Upsert key: `(month, vsd)` — re-uploading the same month overwrites cleanly.
- **Download template** generates a CSV with headers + one example row.
- Validation: missing required columns → inline error; bad numbers → row-level errors shown in preview; user can still upload the valid rows.

## Access control

- View Targets page: any authenticated user (consistent with Home/Dashboard widgets).
- Upload CSV: Admin only (button hidden for non-admins). Matches the existing `useUserRole().isAdmin` pattern.
- RLS: read open to authenticated; insert/update/delete restricted to admins.

## Technical implementation

**New table** (migration):

```sql
create table public.vsd_financial_targets (
  id uuid primary key default gen_random_uuid(),
  month date not null,                  -- always month-start
  vsd text not null,
  contraction_target numeric not null default 0,
  contraction_actual numeric not null default 0,
  delivery_target    numeric not null default 0,
  delivery_actual    numeric not null default 0,
  invoicing_target   numeric not null default 0,
  invoicing_actual   numeric not null default 0,
  receivables_target numeric not null default 0,
  receivables_actual numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (month, vsd)
);
alter table public.vsd_financial_targets enable row level security;
-- read: any authenticated; write: admin only via has_role(auth.uid(),'admin')
```

**New files**

- `src/hooks/useVsdTargets.ts` — fetches rows for a given month, returns rows + computed org totals + per-metric attainment %.
- `src/lib/csvTargets.ts` — CSV parse/validate/serialize helpers + template generator (uses `papaparse`, already common in Lovable stacks; will add via `bun add papaparse` if missing).
- `src/components/targets/TargetsUploadDialog.tsx` — file picker, preview table, validation errors, confirm/upload.
- `src/components/targets/FinanceTargetsCard.tsx` — shared 4-tile compact widget used by Home & Dashboard.

**Edited files**

- `src/pages/Targets.tsx` — full rewrite: month selector, upload button (admin-gated), KPI tiles, grouped VSD table.
- `src/pages/Home.tsx` — insert `<FinanceTargetsCard month={currentMonth} />` near top of grid.
- `src/pages/Index.tsx` — insert the same card (org-totals variant) above the Alerts/Pod row.

**Calculations**

- Attainment % = `actual / target * 100` (guard divide-by-zero → "—").
- Tile color: green ≥95, amber 80–94, red <80, neutral when target=0.
- All numbers formatted with the existing `formatINR` helper.

## Out of scope (for this round)

- Live Google Sheets sync, scheduled refresh, edit-in-place. The CSV path leaves us one step away from wiring the Lovable Google Sheets connector later — same table, just swap the loader.