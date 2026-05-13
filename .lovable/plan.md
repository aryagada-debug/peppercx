## Goal
Enable per-user Google Calendar integration with full 2-way sync using your custom OAuth credentials, so each user can:
- Connect their own Google account
- Schedule MBRs from the app and have them appear on their Google Calendar
- See today's meetings on the Home screen and **create / edit / delete** them right from the app

## Important: rotate your client secret
You pasted your OAuth **Client Secret** in chat. Treat it as compromised — please go to Google Cloud Console → Credentials → your OAuth Client → **Reset secret**, and use the new value in step 1 below. Do not paste secrets in chat again.

---

## Step 1 — Configure Google OAuth in Lovable Cloud (you, manually)

The app already uses `lovable.auth.signInWithOAuth("google", …)` with calendar scopes. To switch from Lovable's managed Google credentials to **your own** (so refresh tokens, branding, and Calendar scope grants belong to your project):

1. Open **Cloud → Users → Authentication Settings → Sign In Methods → Google**.
2. Toggle **Use my own credentials**.
3. Paste your **Client ID** (`590659768824-...apps.googleusercontent.com`) and the **newly rotated Client Secret**.
4. Copy the **Callback URL** shown in that panel.
5. In Google Cloud Console → your OAuth Client → **Authorized redirect URIs**, add:
   - the Callback URL from step 4
   - `https://peppercx.lovable.app`
   - `https://id-preview--f5822717-2a1e-4473-97d8-aefa7ee45cc2.lovable.app`
   - `http://localhost:5173` (only if you test locally)
6. In Google Cloud Console → **OAuth consent screen** → Scopes, ensure these are added:
   - `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.readonly`
7. Add yourself + key teammates as **Test users** until the consent screen is verified (or submit for verification if you want all users to use it without being on the test list).

No code changes needed for this step — the existing `useGoogleCalendar` hook already requests the right scopes and stores `provider_token` in browser storage.

---

## Step 2 — Verify MBR scheduling already syncs both ways

Existing behavior (already wired):
- `MBRInputDrawer` and `ScheduleOnlyDialog` call `syncMbrToCalendar` → creates a Google Calendar event when a date is set, updates it when the date changes, deletes it when cleared. Link is stored in `mbr_calendar_links`.
- Home screen pulls today's events via `google-calendar-proxy` and shows them in "Today's calendar".

I will:
- Smoke-test scheduling an MBR from `/mbr` and `/deals/:id` once you've completed step 1.
- Confirm the event appears on the user's Google Calendar and that re-scheduling / clearing date updates / removes it.

No code work expected here unless QA reveals a regression.

---

## Step 3 — Add full edit/delete/create to the Home screen "Today's calendar" panel

Today the panel only **reads** events. To make it true 2-way sync UX:

1. **New event** button on the panel header → opens a small dialog (title, start, end, attendees, description) → calls `createEvent` from `useGoogleCalendar` → optimistic refresh of the list.
2. Each event row gets a **kebab menu** with:
   - **Edit** → opens the same dialog pre-filled → `updateEvent`
   - **Delete** → confirm prompt → `deleteEvent`
   - **Open in Google** → existing `htmlLink`
3. After any mutation, re-fetch today's window so the list reflects Google's truth (handles attendee response changes, recurring instances, etc.).
4. Add a lightweight 60s auto-refresh while the Home tab is visible so changes made directly in Google Calendar appear without a manual reload.

---

## Step 4 — Verification

- Connect a fresh Google account → confirm Calendar scopes are requested on the consent screen.
- Schedule an MBR → check it appears on Google Calendar with the deep link back to the deal.
- From Home, create a new event, edit it, delete it; verify each change in Google Calendar.
- Edit an event directly in Google Calendar; verify it shows up in Home within ~60s.
- Disconnect → confirm read/write actions surface "reconnect" toast and stop firing API calls.

---

## Technical notes (for reference)

- **No new edge functions needed** — `google-calendar-proxy` (list), `google-calendar-create`, `google-calendar-update`, `google-calendar-delete` already exist and proxy to `calendar/v3/calendars/primary/events`.
- **No DB migration** — `mbr_calendar_links` already exists.
- **Files I'll touch in step 3:**
  - `src/pages/Home.tsx` (panel UI, kebab menus, auto-refresh)
  - `src/components/calendar/EventFormDialog.tsx` *(new)* — shared create/edit dialog
- Token storage stays in `localStorage` keyed `lovable.gcal.provider_token`. Long-term, if you want server-side refresh tokens (so events can be created without the user being online — e.g. by `mbr-reminders`), we'd add a `user_google_tokens` table and use Google's `refresh_token` grant. Out of scope unless you ask.
