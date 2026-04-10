

# MBR Tab Enhancements — Snapshot, Sorting, and Missing Month Warning

## Changes (single file: `src/pages/DealDetail.tsx`, `DealMBRTab` component)

### 1. Sort entries descending by date
Sort `mbrEntries` by `weekStart` descending so newest records appear on top. Currently the array is rendered as-is.

### 2. Add MBR Snapshot section (4 metric cards above the table)
A row of 4 cards styled with gray surface background (`bg-[#F1EFE8]`, no border, rounded-lg, padding 12–16px):

| Card | Logic |
|------|-------|
| **Total MBRs Done** | Count entries with `status === "Done"` |
| **Last Sentiment** | Sentiment badge (R/Y/G) from the most recent "Done" entry |
| **Next MBR Date** | `scheduledDate` from the most recent entry, or "Not scheduled" |
| **Last Mode** | `mode` from the most recent "Done" entry (In-Person / Virtual) |

### 3. Missing month warning
Compare the sorted "Done" entries against a monthly expectation. If the current month has no MBR recorded (no entry with `status === "Done"` whose `weekStart` falls in the current calendar month), show a subtle amber warning banner below the snapshot: "⚠ No MBR recorded for [Month Year]".

### No database or hook changes needed
All data is already available in `mbrEntries`. This is purely a UI enhancement within the existing `DealMBRTab` function component.

