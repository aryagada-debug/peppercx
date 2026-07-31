## Problem

Two separate issues, both confirmed by reading the code:

1. **Date shifts by a day.** Date-only strings (`"2026-08-05"`) are parsed with `new Date(...)`, which reads them as UTC midnight, then formatted/derived in local time.
   - `src/hooks/useMBRData.ts:257` — `getMonday(new Date(params.mbrDate))` mixes UTC parsing with local `getDay()/setDate()` and then `toISOString()`, so the stored `week_start` can land one day (and sometimes one week bucket) off. That's why a saved MBR can reappear under a different date/month.
   - `src/components/mbr/MBRInputDrawer.tsx:91,100` — `new Date(existingEntry.scheduledDate)` on reopen, then `format(...)` locally, renders the previous day in negative-UTC-offset zones.
   - `src/hooks/useMBRData.ts:318-322` — mixes `getUTC*` with a local `now` for the "current month" check.

2. **Next MBR date isn't visible in the next month.** `scheduled_date` is written only onto the entry for the month the MBR was conducted. When the user switches the month selector to the next month in the tracker, that month has no row, so the Scheduled column shows "—".

## Fix

**A. Timezone-safe date handling**
- Add a small local-date helper (parse `yyyy-MM-dd` as local midnight, format back as `yyyy-MM-dd` from local parts) in `src/hooks/useMBRData.ts` and export it.
- Use it in `getMonday` (build the Monday string from local Y/M/D, not `toISOString()`), in the `saveEntry` `weekStart` computation, and in the current-month auto-close check (all-local comparison).
- In `MBRInputDrawer.tsx`, initialize `scheduledDate`, `mbrDate`, and `weekStart` state via the local parser instead of `new Date(str)`. Saving already uses `format(d, "yyyy-MM-dd")`, which is correct once parsing matches.
- Check the same pattern in `ScheduleOnlyDialog.tsx` (already uses the `+"T00:00:00"` local form — leave as is) and align it with the shared helper.

**B. Next MBR date rolls into the next month**
- On save, when the scheduled next MBR date falls in a later month than the conducted-MBR month, also upsert a lightweight placeholder `mbr_entries` row for that deal at `week_start = Monday(scheduledDate)` with `status: "Pending"` and `scheduled_date` set — without overwriting notes/status if a row already exists there (only fill `scheduled_date` when empty).
- In `MBRTracker.tsx`, the Scheduled column falls back to the most recent prior-month entry's `scheduled_date` when the selected month's entry has none, shown in muted style so it's clearly a carried-forward plan rather than a logged MBR.

## Technical notes
- No database schema change: `mbr_entries` already has `scheduled_date` and the `(deal_id, week_start)` unique key used for upserts.
- Placeholder rows stay `Pending`, so compliance/KPI counts that key off `status === "Done"` are unaffected; the `scheduled` KPI will now correctly count deals whose next MBR is booked in that month.
