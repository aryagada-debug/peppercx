## Goal
Make the existing "Unique contacts only" checkbox in Pulse / NPS → Send tab also apply to the "Recent invites" table below. When a recipient email appears in multiple invites, keep only the most recent one (latest action wins).

## Change (single file: `src/components/rgy/PulseSurveyTab.tsx`)

1. **Derive `displayedInvites` via `useMemo`** from the existing `invites` array:
   - When `uniqueOnly` is false → return `invites` unchanged.
   - When `uniqueOnly` is true → dedupe by lowercased `recipient_email`, keeping the row with the latest "action" timestamp defined as `max(completed_at, opened_at, sent_at, created_at)`. On tie, the first occurrence wins (invites are already ordered by `created_at desc` from the query, so this preserves latest-first).

2. **Use `displayedInvites`** instead of `invites` for:
   - The recent-invites `<tbody>` render loop.
   - `inviteIds` used by the `responsesByInvite` query (so we don't fetch responses for rows we're hiding).
   - The empty-state row check.

3. **No changes** to the invites Supabase query, pagination, VSD/BOPM filters, deal picker behavior, or the existing meaning of `uniqueOnly` in the deal-selection area above.

## Notes
- Dedupe runs on the currently loaded page window (`page * PAGE_SIZE`), matching how filtering already works client-side for the table. "Load more" continues to fetch further rows, which are then also deduped.
- "Latest action" is chosen over pure `created_at` so a later-opened or later-completed invite for the same email is preferred over an older one that only has `sent_at`.

## Out of scope
- Analytics → Responses table (separate component).
- Any change to send/mutation logic.