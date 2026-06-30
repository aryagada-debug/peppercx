## Goal
Make Google email work for everyone in CX OS — per-user Gmail (read inbox, send/reply from your own address from the **Inbox** page and **Compose** dialog) plus the existing **central mailbox** (`centralcx@peppercontent.io`) for system notifications (staffing, RGY, MBR, Pulse surveys).

## What already exists (will be reused, not rebuilt)
- Edge functions: `gmail-oauth` (init/callback/status/disconnect), `gmail-api` (list/get/send/modify), `send-app-email` (central mailbox).
- DB: `gmail_connections` table per user.
- UI: `/inbox` page, `ComposeEmailDialog`, `Settings → Email` central-mailbox card.
- Google OAuth client (the existing `GOOGLE_CALENDAR_CLIENT_ID` / `_SECRET` are reused — same Cloud project, broader scopes).
- Scopes requested: `gmail.send`, `gmail.readonly`, `gmail.modify` + openid/email/profile.

## What's missing / to do

### 1. Google Cloud Console (one-time, user action — I'll give exact values)
Verify the existing OAuth client has both redirect URIs allowed:
- `https://peppercx.lovable.app/gmail/callback`
- `https://id-preview--f5822717-2a1e-4473-97d8-aefa7ee45cc2.lovable.app/gmail/callback`
- (already allowed) `…/calendar/callback`

And the OAuth consent screen has Gmail scopes added: `.../auth/gmail.send`, `.../auth/gmail.readonly`, `.../auth/gmail.modify`. If the app is still in Testing, every CX OS user's Google address must be in the **Test users** list, or the app must be moved to Production.

### 2. App changes
- **Sidebar Inbox link visible to all signed-in users** (currently present, just confirming it stays for non-admins).
- **First-run nudge**: if a user opens Inbox or hits "Compose" without a Gmail connection, show the existing connect flow — already wired via `ensureGmailConnected()`. No new code needed; verify it still works after scope changes.
- **Reconnect banner** when token scopes drift (e.g., user previously connected for Calendar only and now lacks Gmail scopes): in `Inbox.tsx`, if `status.scopes` doesn't include `gmail.send`, show "Reconnect Gmail to enable sending" linking to `connectGmail()`.
- **Compose from anywhere**: add a small "Email" action button on Contact rows in `src/pages/Contacts.tsx` that opens `ComposeEmailDialog` prefilled with the contact's email. (Optional — confirm if you want this surfaced in Contacts/Org Mapping/Deal Detail.)

### 3. Verification
- Smoke test: connect a user → list inbox → open a message → reply → send a new email from Compose → mark unread/read.
- Confirm central mailbox path still works (`Settings → Email → Connect Gmail as centralcx`).

## Out of scope (unless you say otherwise)
- Threaded conversation view, labels management UI, attachments upload in Compose, draft saving, Gmail push notifications.

## Reference (technical)
- Per-user tokens stored in `gmail_connections` (RLS protected, only own row).
- All Gmail calls go through `gmail-api` edge function (server-side token refresh, never exposing access tokens to the browser).
- Central mailbox is just a special `gmail_connections` row keyed to the admin who signed in as `centralcx@peppercontent.io`; `send-app-email` reads it via service role.

---

**Please confirm:**
1. Use the **existing** Google OAuth client (shared with Calendar) — or create a dedicated "CX OS Gmail" client?
2. Should I add a "Send email" button on Contact rows / Org Mapping / Deal stakeholders, or keep email composing only in `/inbox` for now?
