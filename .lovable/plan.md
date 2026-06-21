## Goal

Send branded email notifications from `centralcx@peppercontent.io` (via Gmail) for:
1. **Staffed** — person added to a deal
2. **Staffing changed / removed** — allocation % changed or assignment deleted
3. **RGY Red/Yellow** — when deal RGY degrades
4. **MBR reminders** — monthly MBR pending

All sends are triggered from in-app UI actions (no DB triggers).

---

## Architecture

The project already has a Gmail OAuth flow (`gmail-oauth`, `gmail-api`, `gmail_connections` table) wired to individual users. To send everything from one shared mailbox, we promote one `gmail_connections` row as the **central sender**.

### New: shared Gmail sender
- Add a boolean column `gmail_connections.is_central` (single row, enforced by partial unique index).
- In Settings → Integrations, an admin signs in once with `centralcx@peppercontent.io` and clicks **"Use as central sender"** to flag that row.
- New edge function `send-app-email` reads the central row, refreshes its token (reuses logic from `gmail-api`), and sends via Gmail API. All notification triggers call this one function — never the per-user Gmail.

### New: notification templates
Plain-HTML templates live inside `send-app-email/index.ts` (no React Email — keeps it simple and Deno-safe). One render function per event with branded Pepper styling matching the app (off-white bg, purple accent, thin borders).

Events & recipients:
| Event | Recipient(s) | Subject |
|---|---|---|
| `staffed` | staffed person | "You've been staffed on {Account} — {Deal}" |
| `staffing_changed` | staffed person | "Your staffing on {Deal} was updated" |
| `staffing_removed` | previously staffed person | "You've been removed from {Deal}" |
| `rgy_alert` | BOPM, Sr BOPM, VSD on deal | "{Deal} moved to {Red/Yellow} — {dimension}" |
| `mbr_reminder` | BOPM, Sr BOPM, VSD on deal | "MBR pending for {Account} — {month}" |

Each email includes: deal name, account, allocation %, role, start/end dates (where relevant), deep link back to deal detail page.

### New: `email_send_log` (lightweight)
Table to record sends (event, deal_id, recipient_email, status, gmail_message_id, error, created_at) so we can show "Last notified" and avoid duplicate fires on retry. RLS: authenticated read, service_role write.

---

## UI changes

1. **Settings → Integrations** — add "Central Notifications Mailbox" card showing connected central email + "Connect / Replace" button (reuses existing Gmail OAuth, then calls a small RPC to set `is_central=true`).
2. **AddStaffingMemberDialog** — after a successful add, fire `send-app-email` with `event: "staffed"`. After a successful update, fire `staffing_changed`. Toast confirms "Notified {name}".
3. **Staffing remove action** — fire `staffing_removed` before deletion completes.
4. **RGY mark dialog** (`MarkRGYDialog` / `EditableRGY`) — when status moves to Red or Yellow, fire `rgy_alert`.
5. **MBR Tracker** — manual "Send reminder" button on each pending row that fires `mbr_reminder`. (No automatic cron — UI-triggered as requested.)

Every send is best-effort: failures show a toast but never block the underlying staffing/RGY/MBR action.

---

## Technical details

**New files**
- `supabase/migrations/<ts>_central_gmail_and_email_log.sql` — adds `is_central` column + unique partial index, creates `email_send_log` table with grants/RLS.
- `supabase/functions/send-app-email/index.ts` — accepts `{ event, dealId, recipients?, payload }`, resolves recipients server-side from `staffing_deals`/`staffing_people` when not provided, renders HTML, calls Gmail `messages.send` as central user, logs to `email_send_log`.
- `src/lib/appEmail.ts` — typed client wrapper (`sendAppEmail(event, payload)`) used by all UI triggers.
- `src/components/settings/CentralMailboxCard.tsx` — settings UI.

**Edited files**
- `src/components/staffing/AddStaffingMemberDialog.tsx` — fire `staffed` / `staffing_changed`.
- `src/components/staffing/DealStaffingCard.tsx` (and/or wherever remove is wired) — fire `staffing_removed`.
- `src/components/rgy/MarkRGYDialog.tsx` — fire `rgy_alert` on Red/Yellow.
- `src/pages/MBRTracker.tsx` — add "Send reminder" action.
- `src/pages/Settings.tsx` — mount `CentralMailboxCard`.

**Reused**
- `gmail-oauth` callback (no change) — admin uses existing flow signed in as centralcx.
- Token refresh logic (copied/extracted from `gmail-api`).

**Out of scope (can add later)**
- Automatic cron-driven MBR reminders.
- DB-trigger-based sends (sheet sync etc.).
- Per-recipient unsubscribe (internal team email, low risk).
