## Scope

Six related changes spanning the **Clients & Deals → MBR tab**, the **RGY Health page**, and the **MBR Tracker page**. All changes are presentation/UX — no schema changes.

---

### 1. Overall RGY in MBR tab (Clients & Deals)

In `src/pages/DealDetail.tsx` → `DealMBRTab`, add an "Overall RGY" indicator computed from the latest `deal_rgy_weekly` row for this deal using the existing weighted formula in `src/lib/overallCustomerRGY.ts` (`getOverallCustomerRGY`). Render it as a colored badge (R/Y/G) in the snapshot KPI strip, next to MBR Coverage / Last Sentiment / MBR Health. Reuse `useDealRgyRollup` (already exists for single/list of deals) so the value stays in sync via realtime.

### 2. RGY Health — show Overall RGY score + all columns visible by default

In `src/pages/RGYHealth.tsx`:
- `DEFAULT_VISIBLE` currently only includes 6 keys. Replace with all keys from `ALL_COLS` so Deal ID, Content, SEO, Supply, Copy, Design, Video, AI Summary are visible on first load. Existing localStorage persistence is preserved (users who already customized keep their selection — only the default for new users changes).
- The Overall RGY column already renders the band letter; add the **numeric score** (0–100, rounded) below or next to the band using `computeOverallCustomerScore` from `overallCustomerRGY.ts`. Format: e.g. `G · 84`.

### 3. RGY Health — BOPM filter for VSDs

In `src/pages/RGYHealth.tsx`, a `bopmOptions` + `activeBopm` state already exist but the filter chips are not rendered. Add a BOPM filter chip row mirroring the pattern in `src/pages/Clients.tsx` (lines ~753–778) directly below the VSD chip row. The same `dealMatchesBopm` logic used in Clients filters the deal list. Visible when the user is a VSD persona (or in the All view) — hidden for BOPM persona since they are already scoped.

### 4. Schedule MBR in MBR tab of Clients & Deals

In `src/pages/DealDetail.tsx` → `DealMBRTab`:
- Import `ScheduleOnlyDialog` from `@/components/mbr/ScheduleOnlyDialog`.
- Add a **Schedule MBR** button next to the existing "Record MBR" button in the MBR History header.
- Show the next scheduled date prominently — the existing banner uses `sorted[0]?.scheduledDate` but should be `doneEntries[0]` or the most recent future scheduled date. Update to pick the latest non-past `scheduledDate` across all entries. Format: `Next MBR scheduled: dd MMM yyyy`.
- Wire dialog `onSave` to the existing `upsertMBREntry` (status remains `Pending` until the MBR is actually logged via Record MBR).

### 5. MBR Tracker — show Insights tab for VSD view

In `src/pages/MBRTracker.tsx`, the `Insights` and `Flags` tabs are already gated by `!isBopmPersona`, so VSDs see them. The VSD scope currently shows aggregated insights for All VSDs unless they select their own. Auto-select the VSD's own name when `isVsdPersona && myVsdName` (mirroring the pattern in RGYHealth lines 594–596). This makes Insights show the VSD's data on first load.

### 6. Record MBR form parity in Clients & Deals + mandatory fields

The Clients & Deals MBR tab already uses the same `MBRInputDrawer` as MBR Tracker — they share one component. To enforce the "mandatory except Fathom" rule, update `MBRInputDrawer.tsx`:
- Required (block submit with toast if empty): MBR Date, Sentiment (already), Transcript, AI Summary, Next MBR Scheduled Date (already), Anirudh Added checkbox = true, Meeting Mode, Notes, MBR PPT Link.
- Optional: Fathom Link, Action Items.
- Add red asterisks on all required labels.

---

### Verification (after implementation)

1. Build succeeds (typecheck clean).
2. Manually open a deal → MBR tab: confirm Overall RGY badge appears, Schedule MBR button opens dialog, next scheduled banner shows correctly.
3. RGY Health: log in fresh (or in a private tab — defaults apply when no localStorage entry); confirm all columns visible, Overall RGY shows band + score, BOPM filter chips render under VSD chips and filter deals.
4. MBR Tracker as VSD: confirm Insights tab is selected and scoped to the VSD's own row by default.
5. Open Record MBR drawer from both Deal MBR tab and MBR Tracker → confirm submit is blocked when any required field (except Fathom) is empty.

---

### Files to touch

- `src/pages/DealDetail.tsx` — Overall RGY badge, Schedule MBR button, next scheduled date logic.
- `src/pages/RGYHealth.tsx` — default visible cols, score in Overall RGY cell, BOPM filter row.
- `src/pages/MBRTracker.tsx` — auto-select VSD's name for VSD persona.
- `src/components/mbr/MBRInputDrawer.tsx` — make additional fields mandatory + add asterisks.

No DB migrations.
