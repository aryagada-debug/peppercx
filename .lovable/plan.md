## Scope
Enhance the MBR section inside the Deal Detail (Clients & Deals → Deal → MBR tab) and refresh the Overview tab KPIs.

---

### 1. Dynamic file-name display for the MBR PPT/PDF link

**Where**: MBR History table (`src/pages/DealDetail.tsx`, "PPT Link" column) and `MBRDetailDialog.tsx`.

**Behavior**:
- Stored field `mbr_ppt_link` stays a URL string (no schema change).
- Render a derived file name from the URL instead of the raw link:
  - Decode the last URL path segment, strip query params/anchors.
  - If the name has an extension (`.pptx`, `.ppt`, `.pdf`, `.key`, `.gslides`, etc.), show the file name with a small icon that switches by extension (PPT icon for ppt/pptx, PDF icon for pdf, generic file icon otherwise).
  - For Google Drive / Slides / Dropbox links where no filename is in the URL, fall back to a friendly label ("Google Slides", "Google Drive file", "Dropbox file", or hostname).
  - Hover tooltip shows the full URL; clicking opens it in a new tab.
- Editing UX unchanged: clicking edit lets the user paste/replace the URL; the displayed label re-derives automatically.
- Add a tiny helper `getLinkLabel(url)` + `getFileIcon(url)` colocated in a new `src/lib/fileLink.ts`.

### 2. AI-generated 2-line summary banner above MBR History

**Where**: Top of the Deal MBR tab (`DealMBRTab` in `src/pages/DealDetail.tsx`), above the KPIs/banners.

**Behavior**:
- A compact card titled "Latest MBR Summary" showing a 2-line AI summary derived from the most recent MBR entry's `notes` (fallback: `aiSummary` if notes empty; hide entirely if neither exists).
- Auto-generates when notes change. Cached on the entry itself.
  - Reuse `mbr_entries.ai_summary` to persist the generated 2-liner so we don't regenerate on every page visit.
  - Trigger generation when: the most recent entry has `notes` but no `ai_summary`, OR `notes` were updated after `ai_summary` was last written. (We'll piggyback on `updated_at` vs a new lightweight check: regenerate if `ai_summary` is empty; otherwise show the cached one. A "Regenerate" pill button lets the user force a refresh.)
- Backend: new edge function `mbr-summarize-notes` (or extend the existing `mbr-summarize`) that:
  - Accepts `{ mbr_entry_id, notes }`.
  - Calls Lovable AI Gateway (`google/gemini-3-flash-preview`) with a strict 2-sentence system prompt.
  - Writes the result back to `mbr_entries.ai_summary` and returns it.
- Frontend invokes the function via `supabase.functions.invoke` and renders a skeleton while loading. Errors show a muted "Summary unavailable" line, no toast spam.

### 3. Modernize Overview tab KPIs

**Where**: `src/pages/DealDetail.tsx` Overview section — the "Financial Snapshot" (4 cards) and "YTD Financial Summary" (4 cards).

**New look** (keeps editability intact):
- Replace the flat `bg-secondary/50 p-4` blocks with a richer card:
  - Rounded-xl card with subtle border + soft gradient background tied to KPI tone.
  - Top row: small colored icon chip (₹ for money, 📈 for consumed, 🧾 for invoiced, ✅ for received, ⚠️ for outstanding) + label in uppercase tracking.
  - Big tabular-nums value in `text-2xl font-semibold`.
  - Sub-line: existing caption + a tiny delta/context chip where applicable (e.g. Outstanding shows red chip when > 0, Received shows % of invoiced as a thin progress bar underneath).
  - Hover: subtle lift (`hover:-translate-y-0.5 transition`).
- Financial Snapshot cards (MRR / Total / Retainer / Non-Retainer): same visual system, formatted via `fmtCurrency`, edit-on-click preserved.
- All values right-aligned, monospace tabular-nums for clean comparison.
- Reuse existing tokens (`text-positive`, `text-warning`, `text-destructive`, `bg-card`, `border-border`) — no new colors introduced.

---

## Technical Details

**Files to edit**
- `src/pages/DealDetail.tsx`
  - `DealMBRTab`: add `LatestMBRSummaryCard` component at the top; swap PPT-link cell to use new label helper.
  - Overview section (~lines 1505–1557): rebuild Financial Snapshot + YTD cards using a new local `KpiTile` component (or shared one).
- `src/components/mbr/MBRDetailDialog.tsx`: render PPT link with file-name + icon when not editing.
- `src/lib/fileLink.ts` (new): `getLinkLabel(url)`, `getFileIcon(url)`, extension classification.
- `supabase/functions/mbr-summarize-notes/index.ts` (new edge function) — uses `LOVABLE_API_KEY`, model `google/gemini-3-flash-preview`, deterministic 2-sentence prompt, writes to `mbr_entries.ai_summary`.

**No DB migration required** (reusing `mbr_entries.ai_summary` text column).

**Edge function prompt (sketch)**:
> "Summarize the following MBR notes in exactly two short sentences (max ~40 words total). Focus on customer sentiment, key risks, and next actions. No preamble, no bullets."

**Out of scope**: changing how PPT links are uploaded, multi-file attachments, summarizing across multiple MBRs (only the most recent entry's notes drive the banner).