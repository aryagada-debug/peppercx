

# MBR Tracker — Read-Only View Synced with Clients & Deals

## What Changes

The MBR Tracker page becomes a **read-only dashboard**. All editing (status changes, input drawer, Anirudh Joining checkbox) is removed from this page. The clickable deal dialog remains for viewing MBR details. Users edit MBR data from the Deal Detail page's MBR tab, and those changes automatically appear here.

## Implementation

### 1. Update `src/pages/MBRTracker.tsx`

**VSD Summary Tab** — no changes needed, already read-only.

**Deal Tracker Tab** — make fully read-only:
- Remove the status `<select>` dropdown — replace with a static color-coded badge
- Remove the Anirudh Joining `<Checkbox>` — replace with a static checkmark/cross
- Remove the `MBRInputDrawer` import and usage entirely
- Remove the edit icon on hover — keep only the eye icon
- Clicking any row always opens `MBRDetailDialog` in view-only mode (no `onEdit` callback)
- Remove `upsertEntry` and `toggleAnirudhJoining` props from `DealTrackerTab`

**History Tab** — already read-only, no changes.

**Main component** — stop passing `upsertEntry` and `toggleAnirudhJoining` to children. Remove those from `useMBRData` usage (they can stay in the hook for use elsewhere).

### 2. Update `src/components/mbr/MBRDetailDialog.tsx`

- Remove the `onEdit` prop and the Edit button entirely
- Make the dialog purely informational

### 3. Ensure Deal Detail MBR tab works as the editing surface

The Deal Detail page already has an MBR tab (`src/pages/DealDetail.tsx`) that uses `MBRInputDrawer` for editing. Verify it writes to `mbr_entries` correctly — this is the single source of truth that the MBR Tracker reads from. No additional sync logic needed since both pages query the same `mbr_entries` table.

### Files Modified
| File | Change |
|------|--------|
| `src/pages/MBRTracker.tsx` | Remove all edit controls (status select, checkbox, drawer), make Deal Tracker tab view-only |
| `src/components/mbr/MBRDetailDialog.tsx` | Remove Edit button and `onEdit` prop |

### What stays the same
- All KPI metric cards (computed from live data)
- VSD Summary expandable rows
- Deal Tracker table with filters (VSD, Status)
- Week selector
- History tab with trend bars
- Clickable rows opening the detail dialog

