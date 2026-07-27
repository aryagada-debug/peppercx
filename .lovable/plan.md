# Why responses aren't syncing

The `pulse-google-form-webhook` edge function has **zero invocation logs** — the Google Form is never calling it. Combined with the current config state:

- `form_id`: empty
- `field_map`: `{}` (empty)
- `webhook_secret`: set
- `tracking_entry_id`: `1412326792`

…this points to one root cause: the Apps Script "on form submit" trigger is not installed on your Google Form. No trigger = no POST = no response ever reaches Pepper OS.

# Fix (three steps)

### 1. Finish the config in Settings → Notifications → "Pulse/NPS · Google Form"
- Fill **Form ID** (the string between `/d/e/` and `/viewform` in your form URL — for the current URL that's `1FAIpQLScoBY5IInv54OsTW-I5M81LicgKAg-bmg8z0kgSMSn0HudWsg`).
- Fill **field_map** so the webhook can pull `nps`, `csat`, `comment` out of the answers. Example based on your form's question titles:
  ```json
  {
    "nps": "How likely are you to recommend Pepper?",
    "csat": "Overall satisfaction",
    "comment": "Any other feedback?"
  }
  ```
  (Exact strings must match the Google Form question titles.)

### 2. Install the Apps Script on the form
In the Google Form editor: three-dot menu → **Script editor** → paste the snippet already provided in Settings (it reads the hidden `entry.1412326792` token and POSTs to `pulse-google-form-webhook` with the webhook secret). Save, then Triggers → **Add Trigger** → event source *From form*, event type *On form submit*.

### 3. Verify end-to-end
- Submit one test response from the invite email.
- Check `pulse-google-form-webhook` logs — a POST should appear.
- Confirm the invite row flips to **Completed** in Pulse/NPS → Analytics → Responses, with the answers in the drill-in.

# Code changes I'll make in build mode

To reduce silent failures next time:

1. **`supabase/functions/pulse-google-form-webhook/index.ts`** — when `field_map` is populated but a submitted `answers` payload doesn't contain the mapped question titles, log a structured warning (`missing_mapped_field`) instead of silently storing `null` NPS/CSAT. Also accept the mapped keys as a fallback source for `nps`/`csat`/`comment` when the top-level fields aren't sent by the Apps Script.
2. **Settings → Notifications Google Form card** — add a "Send test webhook" button that POSTs a synthetic payload with the configured secret, so you can confirm the endpoint + secret are reachable without submitting a real form.
3. **Analytics → Responses table** — add a small "source" column (App vs Google Form) so the two channels are distinguishable at a glance and it's obvious when Google Form syncing has stopped.

No changes to how Pepper-native surveys work.
