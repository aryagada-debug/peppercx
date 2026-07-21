# Fix: Org Mapping contacts not showing in Pulse/NPS

## Root cause (verified against DB)

Aakash Maurya exists in `deal_stakeholders`:
- `deal_id = id_336_6owrp` (raw `staffing_deals.id`)
- `client_name = "Pidilite"`

The matching Pidilite deal in `staffing_deals`:
- `id = id_336_6owrp`
- `new_deal_id_formulated = "TT05115"`
- `account = "Pidilite Dr Fixit & Roff"`

In `src/pages/PulseNPS.tsx`, each deal is exposed to `PulseSurveyTab` with:
- `deal_id = new_deal_id_formulated || id`  → `"TT05115"`
- `raw_id = id` → `"id_336_6owrp"`
- `account = "Pidilite Dr Fixit & Roff"`

`PulseSurveyTab` then queries `deal_stakeholders` using the exposed `deal_id` (`TT05115`) and the account name (`"Pidilite Dr Fixit & Roff"`). Neither matches Aakash's row (`id_336_6owrp` / `"Pidilite"`), so he's absent from contact counts, the picker, and auto-selected emails. This affects every deal whose formulated ID differs from the raw ID, or whose `client_name` on stakeholder rows doesn't exactly equal `staffing_deals.account`.

Org Mapping and Contacts write `deal_id = <raw staffing_deals.id>`, so the raw ID is the correct join key everywhere.

## Plan

Edit only `src/components/rgy/PulseSurveyTab.tsx`. No schema or data changes; no changes to Org Mapping.

1. **Use raw IDs for stakeholder joins.**
   - `dealIds` used in `contactCounts` query → build from `d.raw_id || d.deal_id` instead of `d.deal_id`.
   - `contactCounts` aggregation: key `byDeal` by raw id, and when computing `out[d.deal_id]` look up `byDeal[d.raw_id || d.deal_id]`.
   - `fetchStakeholdersFor` call for selected deals: pass raw IDs (map `selectedDeals` → `raw_id || deal_id`) instead of `selectedDealIds`.
   - `dealStakeholders` matching predicate: compare `s.deal_id === (d.raw_id || d.deal_id)` instead of `s.deal_id === d.deal_id`.

2. **Keep the account fallback but make it tolerant.**
   - Continue OR-ing on `client_name` so legacy rows still resolve, but match case-insensitively and trimmed (normalize both sides) so `"Pidilite"` vs `"Pidilite Dr Fixit & Roff"` doesn't silently drop rows when they do share a normalized prefix. Concretely: keep the exact `client_name` filter on the server for performance, and on the client, treat a stakeholder as matching a deal when raw IDs match OR normalized `client_name` equals normalized `account`. (No fuzzy/prefix match — that would leak Pidilite contacts across sibling deals, which the earlier deal-scoping change explicitly forbids.)

3. **Verify** with Playwright on `/pulse-nps`: open Pidilite Dr Fixit & Roff, confirm Aakash appears in the contact list with count ≥ 1 and is auto-selected.

## Out of scope

- No changes to how Org Mapping stores `deal_id` or `client_name`.
- No changes to the send flow beyond what the selection surface produces.
- No data backfill.
