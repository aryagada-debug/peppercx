## Goal
In Pulse / NPS → Send tab, make the existing VSD filter also filter the "Recent invites" table, and add a new "P/Sr BOPM" column with its own filter chip row (same behavior as VSD).

## Changes (all in `src/components/rgy/PulseSurveyTab.tsx`)

1. **New BOPM filter state + chip list**
   - Build `BOPM_FILTERS` from the loaded `deals` prop by collecting unique non-empty `principal_bopm` and `senior_bopm` values (sorted, deduped). Add "All" as default.
   - Add `activeBopm` state (default `"__all"`), rendered as a chip row directly under the existing VSD chip row using the same styling.

2. **Deal → owners lookup**
   - Build `dealOwnersById` map: `raw_id → { vsd, principal_bopm, senior_bopm }` from the `deals` prop (invite `deal_id` is `staffing_deals.id`, matching `raw_id`).

3. **Recent invites query — apply VSD + BOPM filters server-side**
   - When `activeVsd !== "__all"` or `activeBopm !== "__all"`, compute the matching deal id set from `deals` (using the same `canonVsd`/`isVsdName`/`UNASSIGNED_VSD_VALUES` logic already used for the deal list, plus BOPM name match) and add `.in("deal_id", matchingIds)` to the invites query.
   - Include `activeVsd` and `activeBopm` in the `queryKey` so React Query refetches on change.
   - If the filter set is empty, short-circuit to `[]` to avoid an unbounded query.

4. **Table structure**
   - Add a "P/Sr BOPM" `<th>` between "Recipient" and "Cc".
   - Add a matching `<td>` that renders `principal_bopm` (bold) and `senior_bopm` (muted) from `dealOwnersById[inv.deal_id]`, dash when missing.
   - Update the empty-row `colSpan` from `11` → `12`.

5. **No changes to sending logic, schema, or other tabs.** VSD chip continues to filter the deals list above as it does today; it now additionally filters the invites table below.

## Out of scope
- Server-side pagination interaction with client-side filtering is avoided by pushing filters into the Supabase query.
- The Analytics → Responses table (separate component) is not touched — this request is about the Send tab's "Recent invites" table.
