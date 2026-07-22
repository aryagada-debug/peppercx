## Problem

Test emails from Settings → Notifications for the three BOPM digest rules (`mbr.reminder_bopm_digest`, `rgy.reminder_bopm_digest`, `nps.reminder_bopm_digest`) use the generic `layout()` renderer with only a single "Sample deal" row. That's why the preview never shows the branded header, colored banner, or the full table of accounts / clients / POCs from the mockup.

Production sends already flow through `buildDigest()` correctly, but the test path (`send_test_rule` in `send-app-email/index.ts`, lines 913–973) bypasses it entirely.

## Fix

In `supabase/functions/send-app-email/index.ts`, inside the `send_test_rule` handler:

1. Detect when `rule.event_key` is one of the three digest rules.
2. Build a realistic sample payload (Rishabh Agarwal as BOPM, Neema Jayadas as VSD) with 4–5 rows per digest so the table populates:
   - **MBR digest** — 4 sample accounts (e.g. Zo Beauty, Pidilite, Cream City Mortgage, Lifescan) with deal names and last month as `mbr_month`, `days_remaining`, `reminder_ordinal`.
   - **RGY digest** — 4 sample accounts with mixed R/Y statuses and `week_label`, `last_updated` days-ago.
   - **NPS digest** — 5 POC rows across 3 accounts with `poc_name`, `poc_email`, `sent_date`, `days_outstanding`, plus `poc_count` / `account_count`.
3. Call `buildDigest(admin, mappedEvent, { recipients: [to], payload: sampleRows, event: mappedEvent })` to reuse the exact production renderer (branded header, banner, table, CTA, footer).
4. Prefix the resulting subject with `[TEST]` and send via the same Gmail path already used in the test handler; log to `email_send_log` as today.
5. Fall back to the current generic `layout()` preview for all non-digest rules — no change to other rule tests.

No changes to `notification-cron`, database, or UI. Only the test-preview path is touched, so real cron digests continue to work exactly as they do now (they already render the full HTML with all deals/POCs per bucket).

## Technical notes

- Event key → digest event map: `mbr.reminder_bopm_digest → mbr_bopm_digest`, `rgy.reminder_bopm_digest → rgy_bopm_digest`, `nps.reminder_bopm_digest → nps_bopm_digest` (already defined in `EVENT_TO_RULE`).
- `buildDigest` returns `{ to, subject, html }`; use its `html`, override subject with `[TEST] …`, keep `to = [testRecipient]`, skip cc.
- If `rows.length === 0` guard in `buildDigest` returns null, force at least the sample rows above so preview always renders.
