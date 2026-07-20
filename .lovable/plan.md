## Problem
In Pulse/NPS → Send surveys, a deal with zero Org Mapping contacts can still get an email if ad-hoc emails are entered, because the send loop only checks the combined recipient count.

## Change
In `src/components/rgy/PulseSurveyTab.tsx` inside `sendMut.mutationFn`:

- Before building recipients for each selected deal, look up its stakeholder list (`dealStakeholders[d.deal_id]`) and count entries with a valid email.
- If that count is `0`, skip the deal entirely — do not push ad-hoc emails onto it and do not invoke `send-pulse-survey` for it.
- Keep ad-hoc emails working for deals that do have at least one Org Mapping contact (current behavior).
- Track skipped deals and surface a toast like "Skipped N deal(s) with no Org Mapping contacts" alongside the existing success/failure summary so the user knows why fewer emails went out.

Also mirror the guard in the UI: disable the per-deal "Select all" affordance / show the existing "No contacts in Org Mapping…" hint (already present) and prevent ad-hoc-only sends for those deals.

No schema, RLS, or edge function changes.

## Out of scope
- Changing how contacts are pulled or synced from Org Mapping.
- Changing behavior for deals that do have contacts.
