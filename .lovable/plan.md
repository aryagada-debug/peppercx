## Goal
Replace the current minimal "By Deal" CSV template with a wide-format template that mirrors the new headers, so a single sheet can be uploaded to populate per-deal monthly Targets (Consumption, Delivery, Invoicing, Receivables) for the chosen month.

## New template headers (in order)
```
Sr no., New Deal ID, Add New Deal ID Here, PC Code, Client Name, Deal Name,
VSD, Group BOPM, Senior BOPM, Junior BOPM, MEQS, Manager, Contractual Editors,
Customer Status, Deal Status, Service Line - Capability, Deal Tag, Deal Type,
Month of Closed Won, Start date, End date,
Retainer MRR (if any), Total Deal Value, Overage Invoicing,
Deal Value Loss / Churned, Net Deal Value,
Consumption - {Month} Target, Consumption - {Month} Attainment, Consumption - {Month} Attainment %,
Delivery - {Month} Target, Delivery - {Month} Attainment, Delivery - {Month} Attainment %,
Invoicing - {Month} Target, Invoicing - {Month} Attainment, Invoicing - {Month} Attainment %,
Receivable - {Month} - 26 Target, Receivable - {Month} Attainment, Receivable - {Month} Attainment %
```

## Header → DB mapping
- `New Deal ID` (or `Add New Deal ID Here` fallback) → `deal_id`
- `Consumption - … Target/Attainment` → `contraction_target` / `contraction_actual`
- `Delivery - … Target/Attainment` → `delivery_target` / `delivery_actual`
- `Invoicing - … Target/Attainment` → `invoicing_target` / `invoicing_actual`
- `Receivable - … Target/Attainment` → `receivables_target` / `receivables_actual`
- `month` is taken from a **Month** picker in the upload dialog (since the headers encode the month in the column name, not as a row value)
- The `% Attainment` columns are ignored on import (recomputed in app)
- All other metadata columns (PC Code, Client Name, VSD, BOPMs, etc.) are **parsed but not stored** in this iteration — they're allowed in the file so the template matches the master sheet 1:1. (Future iteration can sync them into `staffing_deals`.)

## Changes

### 1. `src/lib/csvTargets.ts`
- Add `parseWideDealCsv(text, monthYYYYMM)` that:
  - Tolerates the new header names (matched case-insensitively, punctuation-flexible regex like `/^consumption\s*-\s*.+target$/i`).
  - Resolves `deal_id` from "New Deal ID" or "Add New Deal ID Here".
  - Skips rows with empty deal id.
  - Returns `DealTargetRow[]` keyed by the picker month.
- Add `wideDealTemplateCsv(monthLabel)` that emits the exact header list above with one example row, substituting the chosen month label (default "April").
- Keep existing `parseDealCsv` / `dealTemplateCsv` as a "Simple" fallback.

### 2. `src/components/targets/TargetsUploadDialog.tsx`
- "By Deal" tab becomes the **default** and gets:
  - A month selector (defaults to the page's selected month).
  - Two template buttons: "Download full template" (wide) and "Download simple template".
  - File parsing routes through `parseWideDealCsv` when the wide headers are detected, otherwise falls back to `parseDealCsv`.
- "By VSD" tab kept as-is.

### 3. `src/pages/Targets.tsx`
- Pass the currently selected month into `TargetsUploadDialog` so the template + parsing default to it.

## Out of scope (explicitly)
- Writing the metadata columns (BOPMs, PC code, etc.) back into `staffing_deals`. The fields will be accepted and ignored. We can wire them up in a follow-up if you want a one-shot deal-master sync.
- Changing the dashboard/Home cards — they continue to read from `deal_financial_targets` and `vsd_financial_targets`.

## Files touched
- `src/lib/csvTargets.ts` (extend)
- `src/components/targets/TargetsUploadDialog.tsx` (extend)
- `src/pages/Targets.tsx` (pass month prop)
