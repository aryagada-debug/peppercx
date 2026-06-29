# NPS/CSAT Survey — Plan

Add a "Pulse / NPS" capability under **Health & Review** for sending the attached Pepper Customer Pulse survey to org-mapping contacts, tagged to the deal's VSD and BOPMs. Sender = `centralcx@peppercontent.io` (existing central mailbox). Responses stored as raw JSON for now.

## 1. Database (one migration)

`public.survey_invites`
- `id uuid pk`, `token text unique` (random 32-char, used in URL)
- `deal_id text fk → staffing_deals.id`
- `stakeholder_id uuid fk → deal_stakeholders.id` (nullable; ad-hoc emails allowed)
- `recipient_name text`, `recipient_email text`
- `cc_emails text[]` (snapshot of VSD + P/Sr BOPM emails at send time)
- `vsd_name text`, `principal_bopm text`, `senior_bopm text`, `bopm text` (snapshots for reporting)
- `sent_by uuid`, `sent_at timestamptz`, `email_status text` ('sent'|'failed'|'pending'), `gmail_message_id text`, `error text`
- `opened_at timestamptz null`, `completed_at timestamptz null`
- `created_at`/`updated_at`

`public.survey_responses`
- `id uuid pk`, `invite_id uuid fk → survey_invites.id` (nullable — anonymous still allowed)
- `deal_id text`, `submitted_at timestamptz default now()`
- `nps int`, `csat_avg numeric`, `ces int`, `renew text`, `mood text`
- `payload jsonb` (full structured JSON from the form's `buildPayload()`)
- `respondent_name text`, `respondent_email text`, `wants_followup text`

RLS + GRANTs:
- `survey_invites`: SELECT/INSERT/UPDATE/DELETE to `authenticated` filtered via `visible_deal_ids_for_user`; service_role full.
- `survey_responses`: INSERT open to `anon` (the public survey route is unauthenticated); SELECT to `authenticated` via deal-visibility join; service_role full. No anon SELECT.
- Token lookup helper (`get_invite_by_token`) as SECURITY DEFINER so the public page can hydrate name/company without exposing the rest of the table.

## 2. Public survey route

- New route `/survey/:token` (unauthenticated, added outside `ProtectedRoute`).
- Page renders the uploaded HTML form as a React component (port the vanilla JS into a single `PepperPulse.tsx`; reuse exact wording, scale buttons, step flow, validation, and `buildPayload`).
- On mount: call `get_invite_by_token` → prefill name/email/company, mark `opened_at`.
- On submit: `INSERT` into `survey_responses` with the full payload JSON, then mark invite `completed_at`. Show the same thank-you scorecard from the HTML.
- No auth, no app chrome — standalone branded page matching the HTML's styling.

## 3. Sender UI — under Health & Review (`/rgy`)

New **"Pulse / NPS"** tab next to existing tabs in `RGYHealth.tsx`:
- Left: deals list (uses `visible_deal_ids_for_user`, with same filters as the board). Multi-select via checkboxes for bulk send. Search by account/deal.
- Right: when 1+ deals selected → contact picker.
  - Pulls `deal_stakeholders` for every selected deal (joined by `client_name` for HDFC-style alignment, matching the Contacts Insights fix).
  - Each row: checkbox, name, role, email, deal context. Sender picks any subset.
  - "Add ad-hoc email" input for one-off addresses not in Org Map.
- Footer shows resolved CC list per deal (VSD + Principal/Senior BOPM emails, looked up via `staffing_people.email`). Editable chips so sender can drop a CC.
- **Send button** → calls `send-pulse-survey` edge function with `{ dealId, recipients[], ccEmails[] }` for each deal.
- "Sent invites" panel below: lists recent `survey_invites` with status, open/complete badges, deal, recipient, sent_by, timestamp. Click → drawer with the response payload (if completed).

Access: visible to admins, VSDs, P/Sr/Group BOPM, and Capability Leaders (reuse `useCanEditRgy`-style gate, extended).

## 4. Edge function — `send-pulse-survey`

- Auth: requires Bearer (caller user). Validates caller can see each deal.
- For each recipient:
  1. Generate cryptographically random token (`crypto.randomUUID()` + `crypto.getRandomValues`).
  2. Insert `survey_invites` row with snapshots.
  3. Build branded HTML email (reusing the same `layout()` helper style as `send-app-email`):
     - Subject: `How are we doing on {Account} — {Deal}?`
     - Body: short intro from the central CX team, "this takes ~3 minutes", CTA button → `${APP_ORIGIN}/survey/{token}`.
     - To = recipient; Cc = VSD + Principal BOPM + Senior BOPM emails (resolved by name → `staffing_people.email`, deduped).
  4. Send via central Gmail (reuse `getCentralToken` pattern). Update `email_status`, `gmail_message_id`, `error`.
  5. Log to `email_send_log` with `event = 'pulse_survey'`.
- Soft-fail per the existing pattern: if central mailbox not connected → return `{ skipped: true, reason }` with 200.

## 5. Survey component port

- Single file `src/pages/PulseSurvey.tsx` (no shared app layout).
- Translate the vanilla JS step engine into React state + a small `useReducer` for `A` (answers).
- Keep all 8 steps, validations, capability deep-dives, CES, NPS, mood — verbatim.
- Replace the HTML's Formspree/Slack send with a direct insert into `survey_responses` via the public anon Supabase client.
- Mobile-first, ≤680px wrap, same purple gradient + card styling. Tokens are scoped to the page (don't pollute global `index.css`).

## 6. Out of scope (deferred)

- Aggregated dashboard / rollups (you chose "Raw responses only"). I'll add an "Export CSV" button on the sent-invites panel that flattens `payload`.
- Automatic post-MBR triggers / quarterly cadence.
- Reminder follow-ups for unopened invites.

## Technical notes

- Tokens: 32-byte URL-safe base64; unique constraint enforced.
- Public route: declare `/survey/:token` in `App.tsx` before the `ProtectedRoute` wrapper.
- Anon client must be used inside `PulseSurvey.tsx` so unauthenticated submitters can insert; RLS policy restricts insert to rows where `invite_id` resolves to a real, uncompleted invite.
- CC resolution: split `staffing_deals.vsd / principal_bopm / senior_bopm` on `,` and `/`, trim, look up emails in `staffing_people` (case-insensitive). Dedup. Same pattern already used in `send-app-email`'s `lookupEmailsByNames`.
- Reuse `staffing-exports` style for any future CSV; no new bucket needed now.
- No changes to existing tables; purely additive.

Total surface: 1 migration, 1 new edge function, 1 new public page (~600 lines port), 1 new tab in `RGYHealth.tsx` plus 2–3 new components for the picker and invites panel.
