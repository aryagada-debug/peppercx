## Goal
In Pulse/NPS → Analytics → Responses:
1. Explain why the invite failed for specific contacts.
2. Let the user re-send failed (or any) invites via the connected **Resend** account.
3. Let the user collapse the table to **unique contacts** (one row per recipient email).

## Why invites fail today
Sends currently go through the central Gmail mailbox (`send-pulse-survey`). When Gmail rejects a message (bad address, mailbox full, auth expired, quota, etc.), the edge function writes `email_status = 'failed'` and the Gmail error message to `survey_invites.error`. That column is already stored per invite but is not surfaced in the UI — that is why users can't see the reason.

## Changes

### 1. `src/components/pulse/useAnalyticsData.ts`
- Add `error: string | null` to the invite select list and to the `PulseInvite` type so the reason is available to the table.

### 2. `src/components/pulse/AnalyticsResponsesTable.tsx`
- Show the failure reason: on rows with status `Failed`, render the Status chip with a tooltip containing `invite.error` (fallback "No error message recorded"). Add a small info icon next to the chip when an error exists.
- Add a **"Unique contacts"** toggle above the table. When on, dedupe rows by lowercased `recipient_email`, keeping the most recent by `sent_at` (fallback `created_at`); show a small "n more" hint on collapsed rows.
- Add a **Resend** action:
  - Per-row icon button (enabled for `failed`, `pending`, and `sent` — disabled for `completed`).
  - Toolbar button **"Resend failed"** that resends every currently-visible failed row.
  - Both call a new edge function `pulse-resend-invite` with `{ inviteIds: string[] }`.
  - Show a toast summarising success/failure counts and refresh the query on completion.

### 3. New edge function `supabase/functions/pulse-resend-invite/index.ts`
- Auth: require a Bearer token; look up caller and confirm each `inviteId`'s `deal_id` is in `visible_deal_ids_for_user(auth.uid())` (same authorization pattern as `send-pulse-survey`).
- For each invite: reuse the existing `token` (so historical link keeps working), rebuild the same `https://peppercx.lovable.app/survey/<token>` URL, and send through the **Resend connector gateway**:
  - `POST https://connector-gateway.lovable.dev/resend/emails`
  - Headers: `Authorization: Bearer ${LOVABLE_API_KEY}`, `X-Connection-Api-Key: ${RESEND_API_KEY}`.
  - Body: `from` = `Pepper Pulse <pulse@<verified-domain>>` (configurable via env `PULSE_RESEND_FROM`, default `onboarding@resend.dev` with a warning in the response), `to: [recipient_email]`, `subject`, `html` (reuse the existing HTML template from `send-pulse-survey`; extract the template into `_shared/pulse-email.ts` and import from both functions).
  - On success: update `survey_invites` → `email_status='sent'`, `sent_at=now()`, `error=null`, `gmail_message_id=<resend id>`.
  - On failure: update `email_status='failed'`, `error=<provider message + status>`.
- Return `{ results: [{ inviteId, ok, error? }] }`.

### 4. Connector wiring
- Link the workspace **Resend** connection to the project via `standard_connectors--connect` so `RESEND_API_KEY` is available in edge functions. Skip if it is already linked.
- Deploy `pulse-resend-invite` after code is written.

## Technical notes
- No DB migration needed — `survey_invites.error`, `email_status`, `sent_at`, `gmail_message_id` all already exist.
- The unique-contacts filter is purely client-side over the already-loaded invite rows.
- Existing Gmail send path is untouched; Resend is only used for the resend action so we don't disrupt initial sends.

## Out of scope
- Bulk import of contacts, per-user Resend accounts, and switching the initial send path from Gmail to Resend (can be a follow-up).
