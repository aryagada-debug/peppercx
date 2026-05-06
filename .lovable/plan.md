I’ll add the missing date controls directly into the current filtered staffing table flow, without restoring the full team-list dialog.

Plan:
1. Add a compact date-picker control to `BopmStaffingFlatTable.tsx`
   - Use the existing Shadcn calendar/popover pattern.
   - Include `pointer-events-auto` on the calendar so it works inside popovers/dialogs.
   - Store dates as `yyyy-MM-dd`, matching the existing assignment model.

2. Show start and end dates inline on each staffed person chip
   - Existing assignments will show editable Start and End controls below/near allocation.
   - Changing either date will stage an update, same as changing person or allocation.
   - In direct-edit views, the change will call the existing direct update handler.

3. Add start/end date selection when adding from the filtered person list
   - Keep the filtered person list only; no full team list and no “More options”.
   - When a user selects a person, they’ll still be added from that filtered list.
   - The new assignment will include default dates from the deal (`deal.startDate` / `deal.endDate`) and those dates will be visible/editable immediately in the staged chip.

4. Preserve Central Cx approval behavior
   - Staged add/update payloads will include `startDate` and `endDate`.
   - The existing Central Cx approval editor already has date fields, so approvers will continue to be able to edit these before approving.

5. Fix current staged-add display gap
   - Ensure newly staged additions in the flat table carry `startDate` and `endDate` into the visible cell entry, so the picker appears immediately after selecting a filtered person.

Files expected to change:
- `src/components/staffing/BopmStaffingFlatTable.tsx`
- Possibly `src/components/ui/calendar.tsx` only if the shared calendar wrapper still lacks `pointer-events-auto` by default.