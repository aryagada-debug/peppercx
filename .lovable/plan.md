## Goal

1. In the Deal Detail → **Contract Details** card, remove the **Service Line** row and replace it with two editable rows: **Pepper Business Unit** and **Capability Line**.
2. In the **Clients & Deals** table, add two new columns — **Pepper Business Unit** and **Capability Line** — with the same per-column filter + sort + resize behavior as the existing columns, and surface them in the column-visibility menu (visible by default).
3. One-time backfill: map the ~170 rows from the pasted sheet onto existing deals and write `pepper_business_unit` + `capability_line` on each matched `staffing_deals` row.

## Scope

### 1. Deal Detail (`src/pages/DealDetail.tsx`)

- Remove the entire "Service Line" `<Select>` block inside Contract Details (lines ~2110–2135) along with the now-unused `SERVICE_LINE_OPTIONS` reference in that card.
- Add two new rows in the same card, styled identically:
  - **Pepper Business Unit** — `Select` using a shared `PEPPER_BUSINESS_UNITS` list, writes to `pepperBusinessUnit`.
  - **Capability Line** — `Select` using a shared `CAPABILITY_LINES` list, writes to `capabilityLine`. Both support a "(legacy)" hint when current value isn't in the list (mirrors current Service Line UX).
- Update the subtitle on line 1944 to read `deal.capabilityLine || deal.serviceLineTagging` (so we stop surfacing Service Line first, but don't break older records that still only have it).
- Keep `serviceLineTagging` on the type / DB — we just stop editing/showing it.

### 2. Clients & Deals table (`src/pages/Clients.tsx`)

- Extend `ALL_COLS`, `DEFAULT_VISIBLE`, `DEFAULT_WIDTHS` with `pepperBusinessUnit` (label "Pepper BU", ~150px) and `capabilityLine` (label "Capability Line", ~190px). Position them right after the **Status** column.
- Add matching `<ColHeader>` entries inside `<thead>` with `options` populated from the canonical lists so users get dropdown filters (same UX as Type/Status/VSD).
- Extend the `colFilters` block in `tableRows` to filter by exact match on both new columns.
- Add `<td>` cells in the row renderer that show the value as plain text (truncated, with title tooltip). No inline editing here — editing remains on Deal Detail (matches how Duration/RGY currently work in Clients page).
- Persist visibility via the existing `clients-visible-cols-v2` key (no migration needed; missing values default to the new defaults).

### 3. Shared option lists (`src/data/staffingData.ts`)

Add and export:

- `PEPPER_BUSINESS_UNITS = ["Pepper SEO/GEO + Content", "Pepper Content", "Pepper Creative", "Integrated", "Content Studios", "Others"]`
- `CAPABILITY_LINES` — the existing `SERVICE_LINE_OPTIONS` set plus any new capabilities seen in the pasted data (e.g. "Pepper SEO - SEO + Content Retainer", "Content Studio - Talent Onsite/Virtual", "Integrated Retainers - Content + SEO + Social or Content Hubs", etc. — there are ~14 distinct values, all already in `SERVICE_LINE_OPTIONS` or trivially close).

Refactor `DealFormWizard.tsx` and `DealDetail.tsx` to import from this single source so the wizard, detail view, and Clients table stay in sync. (Old `PEPPER_BUS` const in the wizard is removed.)

### 4. One-time data backfill (migration)

Load the pasted mapping into a temporary table and UPDATE `staffing_deals`:

```text
match priority:
  1. staffing_deals.deal_id = New Deal ID - Formulated   (when non-empty)
  2. staffing_deals.deal_id = New Deal ID/Temp Deal      (fallback)
```

For each matched row set `pepper_business_unit` and `capability_line`. Rows where neither id matches anything in `staffing_deals` are logged via a `RAISE NOTICE` and skipped (a handful of the "New Opportunity" rows have no id at all — they'll be ignored). PC Code is informational and not used for matching since several rows share the same PC Code across multiple deals.

The trailing/leading whitespace in the pasted ids ("   100849   ", etc.) is stripped before comparison.

## Technical notes

- `staffing_deals.business_unit` already exists separately from `pepper_business_unit`; the user-facing "Pepper Business Unit" maps to `pepper_business_unit` (matches the column name and the wizard's existing field). `business_unit` is left untouched.
- The existing `serviceLineTagging` column stays in the schema and is still readable so older deals don't lose context, but no UI surface lets users edit it anymore.
- The Clients table currently shows Pepper BU / Capability Line as read-only text; inline editing for these can be added later if requested — the user only asked for column display + filters.
- No edge function / RLS changes needed; both columns already have read+write grants on `staffing_deals`.  
  
Add Not applicable as staffing option in clients and deals.