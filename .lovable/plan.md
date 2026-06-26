## Problem

Contacts → Insights flags deals as "missing org mapping" even when opening the deal shows contacts. Verified in DB for HDFC Bank: 3 active deals, stakeholders exist with `client_name = "HDFC Bank"` but are attached to only 2 `deal_id`s. Insights counts strictly by `deal_id`, while the in-deal Org Mapping tab loads stakeholders by `client_name` (shared across the client's deals). The two views disagree.

## Fix

Make Insights count contacts the **same way Org Mapping displays them** — by `client_name`, falling back to `deal_id` when `client_name` is empty. A deal is "missing" only when, were you to open its Org Map, you'd genuinely see zero contacts.

## Change (single file)

**`src/pages/Contacts.tsx`**

1. Replace the `contactsByDeal` map with a contact lookup keyed by **normalized `client_name`**, plus a fallback map keyed by `deal_id` for stakeholders whose `client_name` is blank.
2. Add a helper that resolves a deal's contact count:
   - Primary: count of stakeholders whose `client_name` matches the deal's `account` (case-insensitive, trimmed).
   - Fallback: count of stakeholders attached to that deal's `id` when no account match exists or account is blank.
3. Use this resolved count everywhere Insights currently reads `contactsByDeal.get(d.id)` — the per-deal row, the per-VSD `missing` tally, the global "missing contacts" header, and the sort/filter on `contactCount`.

No DB migration, no changes to Org Map, no changes to the main Contacts list — only the Insights aggregation logic.

## Validation

- HDFC Bank: all 3 deals should show 8 contacts each (sum of stakeholders with `client_name = "HDFC Bank"`), and none flagged missing.
- A deal whose account has zero stakeholders anywhere still shows 0 / missing.
- A deal with a blank `account` falls back to its own `deal_id` count (current behavior preserved).
