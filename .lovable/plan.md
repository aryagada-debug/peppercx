## 1. KPI cards (Clients & Deals header)

File: `src/pages/Clients.tsx` (the inline 5-card row around L612-672).

Restyle each card to match the screenshot:
- Header row: small icon (h-3.5 w-3.5) inline with the uppercase label (no separate chip/box wrapping the icon).
- Big tabular number below the header.
- Small subtitle line below the number (existing `insight`).
- Pastel gradient background + thin tinted border per tile (sky / violet / emerald / amber / rose) — already wired via `tintMap`, just remove the chip block.
- Tiles flex-1, never wrap to a second row at any width: keep `flex-nowrap` on the row container and let value/subtitle truncate. Drop `min-w-[140px]`.

Keep all 5 tiles as today: Clients, Renewals < 60d, Active Deals, Total MRR, Total Value. No data changes.

Tile structure (rough):

```text
[icon] LABEL
123
subtitle line
```

## 2. RGY column → bigger block with R / G / Y letter

File: `src/pages/Clients.tsx` (column at L805 header, L968 cell; `ragDot` helper at L60).

- Replace the 2px dot with a ~22×22 rounded-md block, centered, with the letter "R", "G", or "Y" inside, white text on `bg-rgy-red / bg-rgy-green / bg-rgy-yellow` (tokens already in `index.css`). "N/A" → muted block with "—". Pending → outlined empty block.
- Slightly widen the column (e.g. 56 → 72) so the block is comfortable.

## 3. Computed deal RGY from 8 dimensions

The current `deal.rag` comes from a single field. Replace it with a weighted roll-up of the 8 RGY dimensions from `deal_rgy_weekly` (latest row per deal): `customer`, `internal`, `content`, `seo`, `supply`, `copy`, `design`, `video`.

Weights (per request):
- Overall Customer: 50
- Internal: 10
- Content / SEO / Supply / Copy / Design / Video: 5 each (30 total)
- Total = 90 — treated as relative weights and normalized; "NA"/"PENDING" cells are excluded from both numerator and denominator so the score reflects only rated dimensions.

Scoring per dimension value: G = 1.0, Y = 0.5, R = 0.0.
Final color:
- score ≥ 0.75 → G
- 0.40 ≤ score < 0.75 → Y
- score < 0.40 → R
- If every dimension is NA/Pending → "pending" (empty block).

Where to compute:
- Load the latest `deal_rgy_weekly` row per deal id (we already do this elsewhere; reuse the pattern in `src/hooks/useStaleRgy.ts` / `src/hooks/useAccountActivity.ts`). Add a lightweight hook `useDealRgyRollup(dealIds)` returning `Map<dealId, { letter: 'R'|'Y'|'G'|'NA'|'PENDING' }>`.
- In `Clients.tsx`, prefer the rolled-up letter over `deal.rag` when rendering the column, in the filter at L346-350, and in the at-risk count at L391.

## Technical notes

- All colors use existing semantic tokens (`bg-rgy-red`, `bg-rgy-green`, `bg-rgy-yellow`, `text-white`/`text-foreground`), no hex.
- Icons stay from `lucide-react` (Building2, Briefcase, Activity, TrendingUp, DollarSign).
- No DB migrations, no schema changes — read-only roll-up on client.
- `BopmClientsHeader.tsx` (the BOPM-filtered alt header) is out of scope unless you want the same treatment there too.

## Out of scope

- Edits to the RGY Health page logic itself.
- Persisting the rolled-up letter back to a column.
