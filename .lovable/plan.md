

# MBR Tab — Add Edit & Delete Actions for All Entries

## What Changes

Currently, clicking a "Done" MBR entry opens a read-only detail dialog, while non-Done entries open the edit drawer. The request is to allow **editing and deleting any MBR entry** regardless of status, directly from the MBR History table.

## Implementation

### 1. Update `src/pages/DealDetail.tsx` — `DealMBRTab` component

- **Add Edit/Delete action buttons** to each row (replacing the current eye/edit icon):
  - Edit (Pencil icon): Opens the `MBRInputDrawer` pre-filled with that entry's data, regardless of status
  - Delete (Trash icon): Opens a confirmation `AlertDialog`, then deletes the entry from `mbr_entries` table via Supabase
- **Remove the status-based branching** in `handleRowClick` — clicking a row always opens the detail dialog for viewing; explicit Edit button opens the drawer
- **Add a `deleteMBREntry` function** that calls `supabase.from("mbr_entries").delete().eq("id", entryId)` and refreshes the entries list
- Pass the delete handler down or implement it inline since `DealMBRTab` already has access to `supabase`

### 2. Update `src/hooks/useDealDetail.ts` (or inline in DealMBRTab)

- Add a `deleteMBREntry(id: string)` function that deletes from `mbr_entries` and triggers a re-fetch of the entries list

### Files Modified
| File | Change |
|------|--------|
| `src/pages/DealDetail.tsx` | Add edit/delete buttons per row, delete confirmation dialog, allow editing Done entries |
| `src/hooks/useDealDetail.ts` | Add `deleteMBREntry` function if not handled inline |

