

# Link MBR Tab in Deals with MBR Tracker

## Summary
Replace the placeholder MBR tab in Deal Detail with a full MBR interface that reads/writes the same `mbr_entries` table used by the MBR Tracker page. Add a missing `mbr_ppt_link` column to the database. Any edit in either place reflects immediately since both use the same data source.

---

## Database Migration

Add one column to `mbr_entries`:
```sql
ALTER TABLE public.mbr_entries ADD COLUMN mbr_ppt_link text DEFAULT '';
```

---

## Code Changes

### 1. `src/hooks/useMBRData.ts`
- Add `mbrPptLink: string | null` to `MBREntry` interface
- Update `mapEntry` to include `mbr_ppt_link`
- Update `upsertEntry` params to accept `mbrPptLink` and write `mbr_ppt_link`

### 2. `src/components/mbr/MBRInputDrawer.tsx`
- Add `mbrPptLink` state field with an input labeled "MBR PPT Link"
- Include `mbrPptLink` in the `onSave` callback data
- Update the `onSave` type to include `mbrPptLink`

### 3. `src/components/mbr/MBRDetailDialog.tsx`
- Display `mbrPptLink` field in the read-only detail view (as a clickable link)

### 4. `src/hooks/useDealDetail.ts`
- Add MBR data loading: fetch `mbr_entries` filtered by `deal_id` matching the current deal's `id`
- Add `upsertMBREntry` function that calls the same upsert logic as `useMBRData` (writing to `mbr_entries` table)
- Export MBR entries and the upsert function

### 5. `src/pages/DealDetail.tsx` — MBR Tab (replace placeholder)
- Import `MBRInputDrawer` and `MBRDetailDialog`
- Fetch MBR entries for this deal from `useDealDetail`
- Display a table of MBR entries for this deal (week, status, sentiment, scheduled date, mode, notes, PPT link)
- Add a "+ Record MBR" button that opens `MBRInputDrawer` pre-filled with deal info
- Clicking a "Done" row opens `MBRDetailDialog` (read-only view); clicking other rows opens the input drawer for editing
- On submit, upsert to `mbr_entries` — since MBR Tracker reads from the same table, it automatically reflects the change

### 6. `src/pages/MBRTracker.tsx`
- Pass `mbrPptLink` through to `MBRInputDrawer` in `onSave` callback (already works via upsertEntry, just needs the new field threaded through)

---

## Data Flow

Both the MBR Tracker page and the Deal Detail MBR tab read/write the **same `mbr_entries` table**. There is no duplication — edits in one place are visible in the other on next load. The `MBRInputDrawer` component is reused in both contexts with all fields: Sentiment, Fathom link, Transcript, Scheduled Date, Meeting Mode (In-Person/Virtual), Additional Notes, Anirudh Added, and the new MBR PPT Link.

---

## Files Modified

| File | Change |
|------|--------|
| Migration | Add `mbr_ppt_link` column |
| `src/hooks/useMBRData.ts` | Add `mbrPptLink` to interface, mapper, and upsert |
| `src/hooks/useDealDetail.ts` | Add MBR entries loading and upsert |
| `src/components/mbr/MBRInputDrawer.tsx` | Add MBR PPT Link field |
| `src/components/mbr/MBRDetailDialog.tsx` | Display PPT link |
| `src/pages/DealDetail.tsx` | Replace MBR placeholder with full MBR table + drawer integration |
| `src/pages/MBRTracker.tsx` | Thread `mbrPptLink` through save flow |

