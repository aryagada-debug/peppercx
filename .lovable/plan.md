## Goal
In **Pulse / NPS → Send surveys**, add a checkbox that restricts the recipient selection to **unique contacts** across all selected deals + selected emails, so the same email isn't invited twice in one send.

## Change (single file: `src/components/rgy/PulseSurveyTab.tsx`)

1. **New state**: `const [uniqueOnly, setUniqueOnly] = useState(false);`

2. **New checkbox** in the "Recipients" panel header (next to the `{totalRecipients} selected` label, around line 713):
   ```
   [x] Unique contacts only
   ```
   Small helper text: "Deduplicates emails across the selected deals (each address gets one invite)."

3. **Dedup helper** derived from `selectedEmails` + `selectedDeals` order:
   - Walk `selectedDeals` in current order.
   - For each deal, keep an email only if its lowercased form hasn't been seen yet in an earlier deal.
   - Produces `dedupedSelectedEmails: Record<dealId, string[]>` and `dedupedTotal: number`.

4. **Wire it in**:
   - `totalRecipients` display switches to `dedupedTotal` when `uniqueOnly` is on.
   - In the recipients list (line ~757 `selectedDeals.map`), when `uniqueOnly` is on, render duplicate rows with a muted style + `disabled` checkbox + a small "Already included via <first deal account>" hint, so the user can see what's being dropped.
   - In the send handler (line ~425 loop over `selectedDeals`), replace `selectedEmails[d.deal_id]` with `dedupedSelectedEmails[d.deal_id]` when `uniqueOnly` is on. Ad-hoc extra emails (line ~436) also get deduped against the already-collected set.
   - If a deal ends up with 0 recipients after dedup, skip its API call (don't create an empty invite).

5. **Persistence**: `uniqueOnly` is session-only — no localStorage, no DB.

No changes to backend, edge functions, DB, or any other file.

## Technical notes
- Dedup key: `email.trim().toLowerCase()`. Empty / invalid emails ignored as today.
- Deal ordering already stable via `selectedDeals` (derived from `deals.filter(...)`). "First deal wins" for duplicates — surfaced in the hint so the behaviour is transparent.
- Ad-hoc email textarea (existing) is deduped against the running set too, so pasting the same address doesn't slip past.

## Out of scope
- No change to Analytics tab's existing "Unique contacts" toggle (that's a view filter, not a send filter).
- No change to what counts as a "contact" — still pulled from `deal_stakeholders` / Org Mapping.