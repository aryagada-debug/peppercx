## Goal

Make the "Attendees" field in the New/Edit event dialog (Home + Full Calendar) clearly behave as an autocomplete that supports BOTH team users and any external email.

## What changes

**File:** `src/components/calendar/AttendeeMultiSelect.tsx`

1. **Open suggestions immediately on focus/click** — even with empty query, show the full team list (capped at 50) so users see it's an autocomplete.
2. **Focus the input when the wrapper is clicked** — currently clicking the padded area around the input does nothing.
3. **Clearer placeholder** — change to `"Add team member or type any email…"` so external emails are obviously allowed.
4. **Add on blur** — if the user types a valid email and clicks away without pressing Enter, auto-add it. Invalid partials are discarded silently.
5. **External-email visual cue** — chips for emails not in the team list get a subtle "external" dot/tooltip so it's obvious non-users are accepted.
6. **Helper hint row in the popover footer** — small muted text: `Press Enter to add a custom email`.

No other files change. No backend / edge-function / data-model changes — the field already returns `string[]` of emails which the create/update edge functions already accept for any address.

## Verification

- Open Home → click a calendar slot → New event dialog.
- Click the Attendees field: dropdown of team members appears instantly.
- Type `john@acme.com` (not a team member) → "Add '[john@acme.com](mailto:john@acme.com)'" row appears → Enter adds it as a chip with external indicator.
- Type a team member's name → matching users appear → click adds them.
- Repeat in Full Calendar dialog (same component) and confirm MBR `ScheduleOnlyDialog` (also uses this component) is unaffected.  
  
Do this for Schedule MBR too and verify it