# Plan

## 1. Make Home the default landing route

**File:** `src/App.tsx`

- Change the `"/"` protected route to redirect to `/home` (using `<Navigate to="/home" replace />`), and keep the existing dashboard reachable at a dedicated path (e.g. `/dashboard`) so nothing else breaks.
- Update `Login.tsx` / any post-auth redirect that currently sends users to `"/"` so it explicitly targets `/home` (verify, change only if needed).

Result: after sign-in the user lands on Home, and the URL `/` also takes them to Home.

## 2. Today's calendar — show all meetings, scrollable, auto-scroll to "now"

**File:** `src/pages/Home.tsx` (the "Today's calendar" card around lines 1128–1220)

Currently the card renders `todaysMeetings.slice(0, 4)` inside a normal `CardContent`, so anything past meeting #4 is hidden and there's no scroll.

Changes:
- Remove the `.slice(0, 4)` cap — render the full `todaysMeetings` list.
- Wrap the meeting list in a fixed-height scroll container (e.g. `max-h-[420px] overflow-y-auto pr-1` on the wrapping div) so the card height stays consistent with the Smart Nudges card next to it and the list scrolls internally.
- Tag each meeting row with `data-meeting-id={ev.id}` and a `data-live` flag when the meeting is currently in progress (`startD <= now <= endD`). If none is live, mark the next upcoming meeting as the scroll target.
- Add a `useEffect` that runs when `todaysMeetings` or `calConnected` changes: find the live (or next upcoming) row inside the scroll container and call `el.scrollIntoView({ block: "center", behavior: "smooth" })` scoped to the container (use the ref to the container and compute scrollTop so the page itself doesn't jump).
- Re-run the auto-scroll on a light interval (e.g. every 60s using the existing `now` tick if one exists, otherwise add a small `setInterval`) so the highlight/scroll position follows the clock through the day.
- Keep the existing "IN xM", past-meeting opacity, Join button, and customer/internal colour bar logic untouched.

Result: card shows the full day, scrolls internally, and on mount/refresh auto-centers on the meeting that is in progress (or up next), updating as time passes.

## 3. Slack — "can't link 3-4 channels in a row, token expired"

**Diagnosis:** The bot token doesn't actually expire (Slack bot tokens are long-lived). What happens when a user opens the channel picker on several deals back-to-back is that `slack-list-channels` re-runs `conversations.list` from scratch each time, paginating ~200 channels per page through every public + private channel. Slack's `conversations.list` is tier 2 (≈20 req/min); a few rapid opens trip `ratelimited`, and the generic error surfaces in the UI as "expired token". A secondary contributor is that the function throws a plain `Error(j.error)` so any Slack error string (`ratelimited`, `token_revoked`, etc.) ends up in the same toast.

**Changes:**

- `supabase/functions/slack-list-channels/index.ts`
  - Add a simple in-memory cache keyed by token with a ~5 min TTL so repeated calls within a session reuse the same list instead of re-paginating Slack.
  - Handle `429` responses explicitly: read `Retry-After`, return `{ error: "rate_limited", retryAfter }` with HTTP 429 instead of a 500 + opaque message.
  - Distinguish `token_revoked` / `invalid_auth` (real token issues) from `ratelimited` in the response payload.

- `src/components/deals/SlackChatBot.tsx` (and `SlackHomeBubble.tsx` if it shares the same picker)
  - Cache the channel list on the client for the session (module-level memo or React Query) so opening the picker on multiple deals only triggers one network call.
  - Map the new error shape to friendlier toasts: `rate_limited → "Slack is rate-limiting channel lookups, retrying in Ns"` with an auto-retry after `retryAfter`; `token_revoked / invalid_auth → "Slack connection needs to be re-authorized"`.

Result: linking channels on several deals in quick succession no longer hits Slack's rate limit, and on the rare real auth failure the user gets an accurate message instead of "expired token".

## Out of scope
- No redesign of the Home layout or Smart Nudges card.
- No changes to Slack scopes / OAuth flow itself.
