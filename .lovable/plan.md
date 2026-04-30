# Plan: Slack on Home, Attainment in Financials, Contract/SoW Uploads

## 1. Slack Chat Bot on Home tab

The same `SlackChatBot` component used on Deal Detail (`src/components/deals/SlackChatBot.tsx`) will be embedded on the Home page. Since Slack channels are linked per-deal (`staffing_deals.slack_channel_id`), the Home version needs a deal context.

**Approach** — add a "Slack" floating chat panel on Home that:
- Shows a deal picker (defaults to user's most recently viewed deal or first "My Deal").
- Reuses the existing `<SlackChatBot dealId dealName />` so behavior, history, send, channel-link all match Deal Detail exactly.
- Lives in the bottom-right (same fixed-position pattern it already uses on Deal Detail) so it never blocks the dashboard cards.

**File touched**: `src/pages/Home.tsx` (import + mount + tiny deal-picker state). No changes to `SlackChatBot.tsx` itself, ensuring 1:1 parity.

## 2. Move "Attainment %" into Financials section

Currently `src/pages/Index.tsx` shows 4 KPI tiles: Active Deals, Total MRR, Total Deal Value, **Attainment**. Below them is the **Finance Targets** card (`FinanceTargetsCard`).

Changes:
- Remove the `k4` Attainment tile from the top KPI row (KPI row becomes 3-up grid).
- Pass `attainmentPct` into `FinanceTargetsCard` and render it as a header chip next to "Finance Targets — MMM yyyy" (e.g. *"Overall Attainment: 87.4%"*) using `attainmentTone()` for color.
- Keep the per-metric attainment percentages already shown inside each tile (Delivery / Invoicing / Contracted / Contraction).

**Files touched**:
- `src/pages/Index.tsx` — drop `k4`, switch grid to `lg:grid-cols-3`, pass overall attainment to card.
- `src/components/targets/FinanceTargetsCard.tsx` — accept optional `overallAttainmentPct` prop and render header chip.

## 3. Upload Client Contract + SoW document — synced with Deal Detail SoW tab

### Storage
Create one private storage bucket `deal-documents` with two folders by convention:
- `contracts/{deal_id}/...` — client contract PDFs/DOCX
- `sow/{deal_id}/...` — SoW Excel/PDF (the file the user already drops into `SoWImportDialog`)

RLS: authenticated users can read; insert/update/delete restricted to authenticated (matches the rest of the app's permissive read model — admins/BOPMs already gated at deal level).

### Schema
Add two nullable columns to `staffing_deals`:
- `contract_file_path TEXT`
- `sow_file_path TEXT`

These hold the bucket path (not URL) so signed URLs can be generated on demand.

### UI changes

**Clients page** (`src/pages/Clients.tsx`)
- Add a small paperclip icon column ("Docs") in the deal rows. Clicking opens a popover with two upload slots:
  - **Client Contract** — upload / replace / download / remove.
  - **SoW Document** — upload / replace / download / remove. Also exposes the existing "Parse with AI" action (reuses `SoWImportDialog`) so uploading here is the *same file* that gets parsed into `deal_sow_items`.
- Persists `contract_file_path` / `sow_file_path` on `staffing_deals`.

**Deals page** (`src/pages/Deals.tsx`)
- This page is currently mock-data only. We'll wire it to `staffing_deals` (read) and add the same paperclip popover so uploads here mirror Clients exactly. (Aligns with prior "single source of truth" decision.)

**Deal Detail → SoW tab**
- Already shows SoW line items. Add a header strip showing the uploaded SoW file (filename, uploaded date, download, replace) backed by `sow_file_path`. So a file uploaded from Clients/Deals shows up here, and uploading here shows up in the Clients/Deals popovers — true two-way sync via the shared column.
- Same for contract: surface the contract file in the deal header (small "Contract" chip with download).

### Reused component
A new `<DealDocsUpload dealId variant="contract|sow" />` component handles upload/replace/download/remove; it's mounted from Clients popover, Deals popover, and Deal Detail SoW tab. Single component → guaranteed sync.

**Files touched**:
- New migration: add `contract_file_path`, `sow_file_path` to `staffing_deals` + create `deal-documents` bucket + RLS policies.
- New `src/components/deals/DealDocsUpload.tsx`.
- `src/pages/Clients.tsx` — add Docs column / popover.
- `src/pages/Deals.tsx` — wire to live data + add Docs column.
- `src/pages/DealDetail.tsx` (SoW tab section) — show uploaded SoW + contract chips.

## Out of scope / assumptions
- Slack on Home reuses existing connection; no new Slack scopes.
- Contract/SoW are single-file slots (replace-on-upload), not version history. Can add versioning later if needed.
- Existing `SoWImportDialog` keeps working; once a SoW file is on disk, the "Parse with AI" button uses that stored file directly instead of asking for a new upload.
