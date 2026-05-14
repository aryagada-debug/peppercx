## Goal
Upgrade the meeting creation experience in **Home** and **MBR scheduling** with:
1. Conferencing provider selector (Google Meet default, Teams, Zoom)
2. Attendee autocomplete from app users
3. From MBR: pull stakeholders from the deal's Org Map, and add new stakeholders to the Org Map while scheduling

---

## 1. Conferencing provider

New shared field `conferencing: "meet" | "teams" | "zoom" | "none"` (default `"meet"`).

- **Google Meet** — Auto-generated via Google Calendar API. Update `supabase/functions/google-calendar-create` & `google-calendar-update` to:
  - Accept a `conferencing` arg.
  - When `meet`, attach `conferenceData.createRequest` with a random `requestId` and append `?conferenceDataVersion=1` to the API URL. Returned `hangoutLink` is stored back on the event.
- **Teams / Zoom** — No OAuth available for those providers, so the dialog shows a "Meeting link" input. The link is written into the event's `location` field and prepended to the description (`Join via Teams: <url>`). If left blank, we save the event without a link and surface a small hint.
- The selector lives in `EventFormDialog` (used by Home + FullCalendarDialog) and in `ScheduleOnlyDialog` (MBR), defaulting to `meet`.

Edge function payload extension:
```ts
{ summary, start, end, attendees, location, description,
  conferencing?: "meet" | "teams" | "zoom",
  conferenceLink?: string }
```

## 2. Attendee autocomplete

New component `src/components/calendar/AttendeeMultiSelect.tsx`:
- Loads `staffing_people` (name + email) once via React Query and merges with any free-typed emails.
- Uses shadcn `Command` + `Popover` for searchable dropdown; selected attendees render as removable chips.
- Returns `string[]` of emails (matches existing API).
- Replaces the comma-separated `Input` in both `EventFormDialog` and `ScheduleOnlyDialog`.

## 3. Org Map integration (MBR only)

In `ScheduleOnlyDialog`:
- Load `deal_stakeholders` for `deal.id` via existing `useStakeholders` hook.
- Add **"Add from Org Map"** button beside attendees → opens a small popover listing stakeholders with email; clicking adds them to the attendee list.
- Add **"+ New stakeholder"** inline form (name, role, email) that inserts into `deal_stakeholders` and immediately adds the email to attendees.

## 4. Files

**New**
- `src/components/calendar/AttendeeMultiSelect.tsx`
- `src/components/calendar/ConferencingSelect.tsx` (small select + conditional link input)
- `src/components/mbr/StakeholderAttendeePicker.tsx`

**Edited**
- `src/components/calendar/EventFormDialog.tsx` — add conferencing selector, swap attendee input
- `src/components/mbr/ScheduleOnlyDialog.tsx` — add conferencing, autocomplete, stakeholder picker, pass `conferencing` through to sync
- `src/lib/mbrCalendarSync.ts` — forward `conferencing` & `conferenceLink` to `createEvent`/`updateEvent`
- `src/hooks/useGoogleCalendar.ts` — extend `createEvent`/`updateEvent` signatures
- `supabase/functions/google-calendar-create/index.ts` — Meet `conferenceData`; Teams/Zoom location/description handling
- `supabase/functions/google-calendar-update/index.ts` — same
- `src/pages/Home.tsx` — pass new fields through `handleCalSave`

No DB migration needed (`deal_stakeholders` already exists).

## 5. Verification

- Connect calendar → Home → New event → verify Meet link auto-attaches and shows in event.
- Switch to Teams/Zoom → paste link → verify it appears in created event location.
- MBR Schedule → autocomplete shows team members, "Add from Org Map" inserts stakeholder emails, "+ New stakeholder" adds to `deal_stakeholders` and Org Map tab.
- Edit existing event → conferencing change propagates.
