

# Fix Google Calendar Connection + Collapsible Spaces Sidebar

## 1. Collapsible Spaces Sidebar

Add a collapse/expand toggle to `CxSpaceSidebar`:
- Add a chevron button in the sidebar header that toggles between expanded (full sidebar) and collapsed (thin strip with just icons)
- When collapsed, show only folder icons for each space (tooltip on hover) and the "All Tasks" icon
- Store collapse state in `CentralCx.tsx` and pass as prop
- Animate width transition

**Files**: `CxSpaceSidebar.tsx`, `CentralCx.tsx`

## 2. Google Calendar — Real OAuth Connection

The "Connect Google Calendar" button currently does nothing. To make it functional:

- **Use Lovable Cloud's managed Google OAuth** via `lovable.auth.signInWithOAuth("google")` to authenticate users
- **Create an edge function** (`google-calendar-proxy`) that uses the user's Google access token to fetch calendar events from `https://www.googleapis.com/calendar/v3`
- **Update `CxCalendarPanel.tsx`** to:
  - Check if user is authenticated with Google
  - On "Connect" click, trigger Google OAuth sign-in with calendar scopes
  - Once connected, fetch and display today's events/meetings in a list view
  - Show a mini calendar with event dots
  - Allow disconnecting

**Important**: This requires the Lovable Cloud social auth module to be configured first (via the Configure Social Auth tool), and the Google OAuth needs the `https://www.googleapis.com/auth/calendar.readonly` scope.

**Files**:
- `src/components/cx/CxCalendarPanel.tsx` — full rewrite with connected state, event list, mini calendar
- `src/pages/CentralCx.tsx` — add auth state check
- `supabase/functions/google-calendar-proxy/index.ts` — new edge function to proxy Google Calendar API calls
- Lovable auth module setup (auto-generated)

## Technical Notes

- The Configure Social Auth tool will generate `src/integrations/lovable/` module
- Google Calendar API requires the user's OAuth access token; the edge function will receive it from the frontend and proxy the request
- Calendar events will show: title, time, attendees count, and a link to open in Google Calendar
- The panel will have two states: "Not connected" (current placeholder) and "Connected" (event list + mini calendar)
