## Change

Override the sender display name for NPS/pulse survey emails to **"Anirudh from Pepper"**, while the actual From address stays the central CX mailbox (`centralcx@peppercontent.io`). All other outgoing emails keep the current **"Pepper CX"** display name.

## Files

**`supabase/functions/send-pulse-survey/index.ts`**
- In the send path, stop using the Gmail `sendAs` display name lookup as the effective `fromName`.
- Hardcode `fromName = "Anirudh from Pepper"` when building the raw MIME for pulse survey sends (both invite and reminder flows in this function).
- Result header: `From: "Anirudh from Pepper" <centralcx@peppercontent.io>`.

**No changes** to `send-app-email/index.ts` — it continues sending as `Pepper CX <centralcx@…>`.

## Deploy

- `supabase--deploy_edge_functions` for `send-pulse-survey`.

## Verification

- Trigger a test NPS send from Pulse / NPS → "Send surveys" and confirm the recipient sees "Anirudh from Pepper" as the sender name while the address remains centralcx@peppercontent.io.
- Trigger any non-NPS notification (e.g. staffing assignment email) and confirm it still shows "Pepper CX".