## Goal

Let each user connect their own Google Calendar and have it sync **two-way** with:

1. **Home tab** — show personal events alongside tasks; "Connect Calendar" button + sync status.
2. **MBR Tracker** (`/mbr-tracker`) — schedule an MBR → create the Google Calendar event automatically; updates in either system reflect in the other.
3. **Clients & Deals → Deal Detail → MBR tab** — same scheduling/sync as MBR Tracker.

## What's already in place

- `lovable.auth.signInWithOAuth("google", ...)` integration.
- Edge function `google-calendar-proxy` (read-only, lists events for next ~2 months).
- `CxCalendarPanel` already does Google Calendar OAuth and stores `provider_token` in `localStorage`.
- MBR scheduling UI: `ScheduleOnlyDialog`, `MBRInputDrawer` (set `scheduledDate`).

## Limitations & approach

Google's `provider_token` from `supabase.auth` expires in ~1h and there is no refresh token persisted. For a robust 2-way sync we need:

- **Per-user token storage** in a new `user_calendar_tokens` table (access_token, refresh_token, expiry, scopes, google_event_id mapping for MBRs).
- A **token refresh** edge function that exchanges the stored refresh_token for a new access_token using a Google OAuth client (Client ID / Client Secret).
- This requires **Google OAuth credentials** (Client ID + Secret) configured for our app with scopes:
  - `https://www.googleapis.com/auth/calendar.events`
  - `https://www.googleapis.com/auth/calendar.readonly`

### Two paths for credentials

- **Path A (recommended, simpler now)**: Use the Google sign-in token already produced by Lovable Cloud's managed Google OAuth, expand `extraParams.scope` to include calendar scopes, and rely on the in-memory `provider_token` (re-prompt user when it expires). No extra secrets. **Limitation: server-side cron sync not possible; only sync while user is in-app.**
- **Path B (full 2-way background sync)**: Add Google OAuth Client ID + Secret as project secrets. Implement our own OAuth code-exchange route that returns refresh_tokens, store them per user, run server-side sync. **Requires user to provide GCP OAuth credentials.**

I'll **default to Path A** (no setup friction). If the user later wants background/cron sync, we add Path B.

## Implementation (Path A)

### 1. New `useGoogleCalendar` hook (`src/hooks/useGoogleCalendar.ts`)

- Centralizes connect/disconnect, token storage (`gcal_provider_token` in localStorage), token validity check.
- `connect()` → `lovable.auth.signInWithOAuth("google", { extraParams: { prompt: "consent", access_type: "offline", scope: "openid email profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly" } })`.
- `listEvents(timeMin, timeMax)` → calls `google-calendar-proxy`.
- `createEvent({ summary, description, start, end, attendees })` → new edge function `google-calendar-create`.
- `updateEvent(eventId, patch)` → new edge function `google-calendar-update`.
- `deleteEvent(eventId)` → new edge function `google-calendar-delete`.
- Replaces the inline logic in `CxCalendarPanel` so all three surfaces share it.

### 2. New edge functions (CORS + JWT-validating)

- `supabase/functions/google-calendar-create/index.ts` — POST `{access_token, summary, description, start, end, attendees?}` → `POST https://www.googleapis.com/calendar/v3/calendars/primary/events`. Returns `{event_id, htmlLink}`.
- `supabase/functions/google-calendar-update/index.ts` — PATCH a specific eventId.
- `supabase/functions/google-calendar-delete/index.ts` — DELETE a specific eventId.
- Extend `google-calendar-proxy` to accept optional `timeMin/timeMax` overrides and `q` (search by deal/MBR keyword).

### 3. DB migration

Add a small mapping table so we know which Google event corresponds to which MBR:

```sql
create table public.mbr_calendar_links (
  id uuid primary key default gen_random_uuid(),
  mbr_entry_id uuid not null,        -- references mbr_entries.id (logical)
  google_event_id text not null,
  google_calendar_id text not null default 'primary',
  user_id uuid not null,             -- owner who created/owns the sync
  last_synced_at timestamptz not null default now(),
  unique(mbr_entry_id, user_id)
);
alter table public.mbr_calendar_links enable row level security;
create policy "Own links select" on public.mbr_calendar_links for select to authenticated using (auth.uid() = user_id);
create policy "Own links insert" on public.mbr_calendar_links for insert to authenticated with check (auth.uid() = user_id);
create policy "Own links update" on public.mbr_calendar_links for update to authenticated using (auth.uid() = user_id);
create policy "Own links delete" on public.mbr_calendar_links for delete to authenticated using (auth.uid() = user_id);
```

### 4. Home tab (`src/pages/Home.tsx`)

- New compact card **"My Calendar"** at the top of the right column:
  - If not connected → "Connect Google Calendar" button (calls `useGoogleCalendar.connect`).
  - If connected → "Synced — {N} upcoming events" + list next 5 events for today/this week + "Disconnect".
  - Selecting an event opens it in Google Calendar (`htmlLink`).
- Reuse the existing **Meetings & MBRs** card; merge live Google Calendar events with the upcoming MBRs already shown (dedupe by title + date).

### 5. MBR Tracker (`src/pages/MBRTracker.tsx`)

- Header gets a small "Calendar: Connected ✓ / Connect" pill.
- When user opens `ScheduleOnlyDialog` or `MBRInputDrawer` and saves a `scheduledDate`:
  - If connected → after `onSave` finishes, **upsert a Google Calendar event**:
    - Title: `MBR — {deal.account} ({deal.dealName})`
    - Description: includes deal id, VSD, PC code, link back to `/deals/{id}?tab=MBR`.
    - Start/end: scheduledDate at default 30 min slot (or pick from dialog — see below).
    - Attendees: optional input field for emails.
  - Persist mapping in `mbr_calendar_links`.
  - On subsequent edits → `update`. On clearing schedule → `delete`.
- Add a **time picker + duration** to `ScheduleOnlyDialog` and `MBRInputDrawer` so we can create real calendar events (not all-day). Default: next available 11:00–11:30 AM.
- **Inbound sync (calendar → MBR)**: on MBR Tracker mount, if connected, fetch GCal events whose summary starts with `MBR —`  for the visible window, match by `mbr_calendar_links.google_event_id`, and if the event's start date differs from `mbr_entries.scheduled_date`, update `mbr_entries.scheduled_date` to match (so dragging the meeting in Google Calendar reflects in the tracker).

### 6. Deal Detail → MBR tab

- The MBR tab already uses `MBRInputDrawer`/`ScheduleOnlyDialog`, so once those are wired to the new hook the deal-level MBR sync is automatic. Add the same "Calendar: Connected" pill in the tab header.

### 7. Refactor `CxCalendarPanel`

- Switch it to use `useGoogleCalendar` instead of its inline logic so all three surfaces share state (connection status, token, event cache).

## Out of scope (for now)

- Background server-side polling (requires Path B / refresh tokens).
- Recurring MBR events (we'll create single events; recurrence can be a follow-up). - Keep this in scope
- Calendars other than `primary`.

## Files to be created/edited

**Created**

- `src/hooks/useGoogleCalendar.ts`
- `supabase/functions/google-calendar-create/index.ts`
- `supabase/functions/google-calendar-update/index.ts`
- `supabase/functions/google-calendar-delete/index.ts`
- `supabase/migrations/<timestamp>_mbr_calendar_links.sql`

**Edited**

- `src/pages/Home.tsx` — add My Calendar card + merge events with MBR list.
- `src/pages/MBRTracker.tsx` — connect pill + inbound sync on mount.
- `src/components/mbr/ScheduleOnlyDialog.tsx` — add time + duration; trigger GCal upsert.
- `src/components/mbr/MBRInputDrawer.tsx` — add time + duration; trigger GCal upsert.
- `src/pages/DealDetail.tsx` (MBR tab) — connect pill (uses same hook).
- `src/components/cx/CxCalendarPanel.tsx` — refactor to use shared hook.
- `supabase/functions/google-calendar-proxy/index.ts` — accept optional `timeMin/timeMax/q`.

## Open question for you

Do you want to allow users to add **attendee emails** when scheduling an MBR (so Google sends invites), or should we keep the event on the user's calendar only? I'll default to "optional attendees field, blank by default" unless you say otherwise.  
Yes I want the users to add attendee emails