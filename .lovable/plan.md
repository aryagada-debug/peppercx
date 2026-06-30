## Goal

Centralize all system-generated emails into one **Notification Rules** admin space (Settings → Notifications) so admins can edit recipients, CCs, subject/body templates, and on/off toggles for each event — and wire the 6 triggers you listed end-to-end through the existing `send-app-email` edge function and `centralcx@peppercontent.io` mailbox.

## What you'll see in the app

A new **Settings → Notifications** tab (admin-only) with one card per rule:

- Toggle: enabled / disabled
- "To" recipients: free-form emails + dynamic tokens (`{vsd}`, `{principal_bopm}`, `{senior_bopm}`, `{bopm}`, `{capability_lead}`, `{assignee}`, `{assignee_manager}`, `{deal_creator}`)
- "Cc" recipients: same picker
- Subject + body templates (with `{deal_id}`, `{deal_name}`, `{account}`, `{capability}`, `{week}`, etc.)
- "Send test" button
- Last-fired timestamp + delivery stats (pulled from `email_send_log`)

Defaults are seeded from the 6 rules below so it works out of the box; admins only touch the page if they want to tweak.

## The 6 rules (defaults)


| #   | Event key                | Default To                                                        | Default Cc           | Trigger                                                   |
| --- | ------------------------ | ----------------------------------------------------------------- | -------------------- | --------------------------------------------------------- |
| 1   | `assignment.created`     | `{assignee}`                                                      | `{assignee_manager}` | Insert into `staffing_assignments`                        |
| 2   | `handover.received`      | arya, anirudh, priyanka                                           | —                    | Insert into `deal_handovers`                              |
| 3   | `deal.created`           | arya + `{vsd}` + `{capability_lead}` (routed by capability)       | —                    | Insert into `staffing_deals`                              |
| 4   | `mbr.missing_prev_month` | `{vsd}`, `{principal_bopm}`, `{senior_bopm}`, `{bopm}`            | —                    | weekly cron 09:00 IST, 5th of month onward                |
| 5   | `deal.unstaffed_7d`      | arya + `{vsd}` + `{capability_lead}`                              | —                    | Daily cron, active deals with zero assignments for 7 days |
| 6   | `rgy.stale_7d`           | `{vsd}`, `{capability_lead}`, `{principal_bopm}`, `{senior_bopm}` | —                    | weekly cron, no `deal_rgy_weekly` row in last 7 days      |


### Capability → Capability Lead routing (rule 3 & 5)

Stored in a small editable lookup table on the same Settings page:

- Creative / Pepper Creative → `sneha@peppercontent.io`
- SEO — India → `vedang@peppercontent.io`, `pratima@peppercontent.io`
- SEO — US → `mayur@peppercontent.io`, `gaurab@peppercontent.io`
- Content Studio → `anirudh@peppercontent.io`
- Other → `anirudh@peppercontent.io` (also routes to VSD)

Capability bucket is derived from `staffing_deals.capability_line` + `business_unit` + geo (US vs India inferred from client/deal geo field).

## Technical design

### New tables

- `notification_rules` (event_key PK, enabled bool, to_tokens text[], cc_tokens text[], subject_template text, body_template text, updated_at, updated_by) — admin RLS only.
- `capability_leads` (capability_bucket text PK, leads text[]) — admin RLS only.
- `notification_dispatch_log` (event_key, deal_id, dedupe_key UNIQUE, sent_at) — prevents repeat sends for cron rules.

Seeded with the 6 defaults above. All new public tables get the standard GRANT block.

### Edge function changes

- Extend `send-app-email` with a `resolve_rule(event_key, context)` helper that loads the rule, expands tokens (looking up managers via `staffing_people.manager_person_id` and capability lead via `capability_leads`), then sends through the central mailbox.
- New event types: `assignment_created`, `handover_received`, `deal_created`, `mbr_missing`, `deal_unstaffed`, `rgy_stale`.

### Triggers (real-time)

- Rule 1: keep existing `sendAppEmail({event:'staffed'})` call sites in staffing mutations; route through new resolver.
- Rule 2: add to `HandoverWizard` submit success.
- Rule 3: add to `createDeal` mutation + handover auto-create path.

### Cron jobs (pg_cron, daily 09:00 IST)

- New edge function `notification-cron` that scans for rules 4, 5, 6 and emits one email per match, deduped via `notification_dispatch_log`.

### Admin UI

- `src/pages/admin/NotificationsTab.tsx` added to Settings tabs (admin guard via `useUserRole`).
- Reuses existing `Card`, `Switch`, `Textarea`, `MultiSelect` patterns.
- Token picker shows available tokens per event with live preview.

## Out of scope (ask if you want them)

- Per-user mute / digest preferences
- Slack mirroring of these notifications
- Editing the central mailbox sender (stays `centralcx@peppercontent.io`)

Approve and I'll build it.