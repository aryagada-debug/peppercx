

# Fix MBR Detail Dialog Save in Clients & Deals

## Problem
The MBR Detail Dialog opened from the Deal Detail MBR tab (line 344) does not pass `onSave`, so the Save button never appears. Edits made in the dialog have no effect.

## Solution

### `src/pages/DealDetail.tsx` — Pass `onSave` to `MBRDetailDialog`

Add an `onSave` handler that bridges the dialog's save signature to `upsertMBREntry`:

```tsx
{viewEntry && (
  <MBRDetailDialog
    open={!!viewEntry}
    onClose={() => setViewEntry(null)}
    deal={dealForDialog}
    entry={viewEntry}
    onSave={async (params) => {
      const weekToUse = viewEntry?.weekStart || selectedWeek;
      await upsertMBREntry(params, weekToUse);
      toast.success("MBR entry updated");
    }}
  />
)}
```

This single change ensures:
- The Save button appears in the dialog
- Edits persist to the `mbr_entries` table via `upsertMBREntry`
- Changes propagate bidirectionally — the MBR Tracker reads from the same table and already passes `onSave` to its dialog instances

### Files Modified
| File | Change |
|------|--------|
| `src/pages/DealDetail.tsx` | Add `onSave` prop to `MBRDetailDialog` rendering (~line 344) |

