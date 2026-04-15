

# MBR Tracker — Editable Dialog, Remove Completion Chart, Add RGY Dots

## What Changes

1. **Editable MBR Detail Dialog** — When clicking a deal in VSD Summary, the dialog becomes editable (status, sentiment, mode, notes, links, scheduled date, Anirudh flags). Changes sync bidirectionally with the database (same `mbr_entries` table used by Deal Detail page).

2. **Remove "MBR Completion by VSD" chart** — The stacked bar chart section (lines 118-145 in `MBRTracker.tsx`) inside `VSDSummaryTab` is deleted.

3. **RGY dot on expanded deals** — When a VSD row is expanded, each deal row shows a colored dot representing the overall RGY status fetched from `deal_rgy_weekly`. The "worst" dimension across the 8 RGY dimensions determines the dot color (Red > Yellow > Green > NA).

## Implementation

### 1. Make `MBRDetailDialog` editable

- Add local state for all editable fields (status, sentiment, mode, notes, fathomLink, mbrPptLink, scheduledDate, anirudhAdded, anirudhJoining)
- Replace static display with form inputs (Select for status/sentiment/mode, Input for links/dates, Textarea for notes, Checkbox for Anirudh flags)
- Add a "Save" button that calls `upsertEntry` and closes the dialog
- Pass `upsertEntry` from `useMBRData` through to VSDSummaryTab and DealTrackerTab, then into the dialog
- After save, refresh entries so the table updates

### 2. Remove completion chart

- Delete the "MBR Completion by VSD" `<div>` block (lines 117-145) from `VSDSummaryTab`

### 3. Add RGY dot to expanded deal rows

- In `VSDSummaryTab`, fetch `deal_rgy_weekly` for all deal IDs (latest entry per deal) when the component mounts
- Compute "worst status" across 8 dimensions (customer, internal, content, seo, supply, copy, design, video): R > Y > G > NA
- Show a colored dot in the expanded deal row next to the account name

### Files Modified
| File | Change |
|------|--------|
| `src/components/mbr/MBRDetailDialog.tsx` | Convert from read-only to editable form with save |
| `src/pages/MBRTracker.tsx` | Pass `upsertEntry`/`refresh` to tabs, remove completion chart, fetch RGY data for dots |

