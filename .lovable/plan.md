

# MBR Tab Enhancements — Editable Date, Darker KPI Cards, Link Visibility, Next MBR Date

## Changes (single file: `src/pages/DealDetail.tsx`, `DealMBRTab` component)

### 1. Allow editing the MBR date (add older MBRs)

Currently `selectedWeek` is auto-set and the drawer uses it as-is. Add a **date picker** inside the `MBRInputDrawer` that lets the user pick the actual MBR date (defaults to current week but can be changed to any past date). This requires:

- **`MBRInputDrawer.tsx`**: Add a new "MBR Date" date picker field at the top of the form (before Sentiment). Initialize from `selectedWeek` prop. On submit, pass this date as a new `mbrDate` field in the `onSave` callback.
- **`DealDetail.tsx`**: In `handleSave`, use the `mbrDate` from the save data (instead of the fixed `selectedWeek`) when calling `upsertMBREntry`. This allows backdating MBR entries.

### 2. Darker KPI snapshot cards

Change the snapshot card background from `bg-secondary/40` to `bg-[#E8E6DF]` (a noticeably darker warm gray matching the design system). Add a subtle left-accent border in purple (`border-l-4 border-l-[#534AB7]`) for visual punch. Increase the label size slightly from `text-[10px]` to `text-xs`.

### 3. Make Fathom and PPT links dark blue + visible

Replace `text-accent` on both link anchors with `text-blue-700 dark:text-blue-400 font-medium` so they stand out clearly against the table background.

### 4. Show Next MBR Scheduled Date in MBR History table

Add a "Next MBR" column to the table header. For each row, display the `scheduledDate` formatted as `dd MMM yyyy`. Additionally, show a prominent **"Next MBR"** callout below the snapshot cards — a small info banner: "📅 Next MBR scheduled: [date]" using the latest entry's `scheduledDate`.

## Files Modified

| File | Change |
|------|--------|
| `src/components/mbr/MBRInputDrawer.tsx` | Add "MBR Date" date picker field, pass `mbrDate` in onSave |
| `src/pages/DealDetail.tsx` | Darker KPI cards, dark blue links, next MBR banner, use `mbrDate` from save data |

