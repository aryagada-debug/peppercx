# Plan

## 1. Make dark mode the default

- `src/components/dashboard/ThemeToggle.tsx` — already defaults to dark when no `localStorage.theme` is set, but the `dark` class is only applied after the component mounts (causing a light flash and light mode for users who never visit the toggle).
- Add a small inline boot script in `index.html` (before React mounts) that reads `localStorage.theme` and adds `dark` to `<html>` when it's `"dark"` or unset. This makes dark the true default app-wide.

## 2. Dark-mode Financials tab

File: `src/components/deals/FinancialsTab.tsx` (and any sibling cards it renders).

- Replace hardcoded hex tokens (`bg-[#EAF3DE]`, `text-[#27500A]`, bar fills `#639922`, etc. in `colorStyles`) and any `bg-white`, `text-black`, raw greys with semantic tokens already defined in `index.css` (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-positive/10`, `bg-warning/10`, `bg-destructive/10`, `text-positive`, etc.).
- Update Recharts (`BarChart`, `LineChart`) `stroke`/`fill`/grid/tooltip colors to read from CSS variables (`hsl(var(--positive))`, `hsl(var(--primary))`, `hsl(var(--border))`) so charts read correctly in both themes.
- Audit dialogs/tables inside the tab for light-only classes and swap to tokens.
- Verify by toggling theme on a deal's Financials tab and on the Clients page financials view.

## 3. Full-screen Google-style week calendar on Home

Today's Calendar widget lives in `src/pages/Home.tsx` (~line 1300, "Today's calendar" card) and uses `useGoogleCalendar` for read/create/update/delete.

- Add a "Full screen" icon button in the card header next to `CalendarConnectButton`.
- Create a new component `src/components/calendar/FullCalendarDialog.tsx`:
  - Full-screen `Dialog` (max-w-screen, h-screen) with header: Planner title, prev/next week, "Today", view switcher (Day / Week / Month — start with Week), close.
  - Week grid: 7 day columns × hourly rows (similar to the ClickUp screenshot). Render `GCalEvent`s as absolutely-positioned blocks based on start/end.
  - Click empty slot → opens existing `EventFormDialog` pre-filled with that start/end (create).
  - Click event → opens `EventFormDialog` in edit mode (uses existing `calUpdateEvent` / `calDeleteEvent`).
  - Drag-to-create can be skipped in v1; click + form is enough to mirror Google create/edit.
  - Fetch a wider window via `calListEvents({ timeMin: weekStart, timeMax: weekEnd, maxResults: 250 })` when dialog open / week changes.
- Reuse existing `EventFormDialog` (already supports summary, description, attendees, location, start/end) so create + edit work end-to-end with Google.
- Show a "Connect Google Calendar" empty state inside the dialog when not connected.

## 4. Schedule MBR → calendar view

File: `src/components/mbr/ScheduleOnlyDialog.tsx` currently has only date/time/duration inputs.

- Add a left/right two-pane layout inside the dialog:
  - Left: existing form fields (date, time, duration, attendees, ) remove Anirudh checkboxes.
  - Right: an embedded mini week-grid using the same component built in step 3 (read-only week of `scheduledDate`) that:
    - Highlights the chosen slot live as the user changes date/time/duration.
    - Lets the user click an empty slot to set date+time, click-drag (optional) to set duration.
    - Shows existing Google Calendar events for that week so conflicts are visible.
- Keep current save behavior (`syncMbrToCalendar`) unchanged — the new view just drives `scheduledDate` / `scheduledTime` / `durationMin`.
- Same component is used from `MBRTracker.tsx` and `DealDetail.tsx`, so both pick this up.

## Verification (run after build)

- Hard refresh in incognito → app loads in dark mode.
- Toggle theme → persists to localStorage and applies on reload.
- Open a deal → Financials tab readable in dark, charts use theme tokens; toggle to light, still readable.
- Home → "Today's calendar" → full-screen icon opens week view; create + edit + delete events round-trip to Google Calendar.
- MBR Tracker → "Schedule" → dialog shows week calendar; clicking a slot updates fields; saving creates the Google event.

## Technical notes

- New files: `src/components/calendar/FullCalendarDialog.tsx`, `src/components/calendar/WeekGrid.tsx` (shared by Home full-screen dialog and Schedule MBR right pane).
- Edited files: `index.html`, `src/components/deals/FinancialsTab.tsx`, `src/pages/Home.tsx`, `src/components/mbr/ScheduleOnlyDialog.tsx`.
- No DB migrations, no edge function changes.
- All colors via existing semantic tokens in `index.css` / `tailwind.config.ts`.