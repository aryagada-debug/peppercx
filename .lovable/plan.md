# Fix: Pulse/NPS recipient list empty for Pidilite (and any deal with formulated ≠ raw ID)

## Root cause (verified in code)

After the previous fix, `contactCounts` correctly uses raw IDs, so Pidilite shows "1 contact". However, `src/components/rgy/PulseSurveyTab.tsx` still has two paths that use the formulated `deal_id` instead of the raw `staffing_deals.id`. One of them poisons the React Query cache before the click even happens:

1. **`prefetchDeal` (lines 608-616)** — fires on `onMouseEnter` for each deal row. It calls:
   ```ts
   const ids = [d.deal_id];              // formulated, e.g. "TT05115"
   const accts = d.account ? [d.account] : []; // "Pidilite Dr Fixit & Roff"
   qc.prefetchQuery({
     queryKey: ["pulse-stakeholders", accts, ids],
     queryFn: () => fetchStakeholdersFor(ids, accts),
   });
   ```
   `fetchStakeholdersFor` OR-filters on `deal_id.in.("TT05115")` and `client_name.in.("Pidilite Dr Fixit & Roff")`. Aakash's row is `deal_id=id_336_6owrp`, `client_name="Pidilite"` — neither matches → `[]` is cached under `["pulse-stakeholders", ["Pidilite Dr Fixit & Roff"], ["TT05115"]]`. When the user then clicks, the main query uses that exact same key and reads the empty cached value (fresh for 60 s), so no recipients render.

2. **`inviteAggByDeal` query (lines 245-264)** — queries `survey_invites` with `dealIds` = formulated IDs and keys the resulting map by `r.deal_id`. But invites are inserted with `dealId: d.raw_id || d.deal_id` (send mutation, line 539), so the map keys are raw IDs while the UI reads `inviteAggByDeal[d.deal_id]` (formulated). The "sent / done" chips on the deal picker silently show zero for any deal where formulated ≠ raw.

## Plan

Edit only `src/components/rgy/PulseSurveyTab.tsx`. No schema or data changes.

1. **Align `prefetchDeal` with the main query key and payload.**
   - Build `rawIds = [d.raw_id || d.deal_id]`, `accts = d.account ? [d.account] : []`.
   - Use `queryKey: ["pulse-stakeholders", accts, [d.deal_id]]` (same shape the main query uses so the cache entry is hit, not shadowed) and `queryFn: () => fetchStakeholdersFor(rawIds, accts)`.
   - This guarantees the prefetched payload equals what the main query would fetch.

2. **Fix `inviteAggByDeal` to key by raw ID.**
   - Compute `rawDealIds` once (already added for `contactCounts`).
   - Query `survey_invites` with `.in("deal_id", rawDealIds)`.
   - Keep `map[r.deal_id]` (raw), then when building UI lookups use `inviteAggByDeal[d.raw_id || d.deal_id]`. Change the render site at line 819 accordingly.

3. **Verify** with Playwright on `/pulse-nps`:
   - Hover then click "Pidilite Dr Fixit & Roff".
   - Confirm "Aakash Maurya · aakash.maurya@pidilite.com" appears in the Recipients panel and is auto-checked.
   - Confirm the "sent / done" chips reflect real invite counts for that deal.

## Out of scope

- No changes to Org Mapping, Contacts, edge functions, or DB rows.
- No backfill of `deal_stakeholders.client_name` values.
