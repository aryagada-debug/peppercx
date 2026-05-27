## Goal
Update `staffing_deals` rows matched by `deal_id` with the values from the pasted table:
- `mrr` ← MRR column
- `total_deal_value` ← Total Deal Value column
- `start_date` ← first day of "Start Month" (e.g. `May-26` → `2026-05-01`)
- `end_date` ← last day of "End Month" (e.g. `Oct-26` → `2026-10-31`)

For deals where `vsd = 'Neema Jayadas'` (identified in DB — 30+ deals incl. Atlan, Dataiku, Talkspace, Earnin, Tigergraph, Mews AI, Sedai, O'Reilly, Wizeline, Justworks, etc.): **only** update `start_date` and `end_date`. Leave `mrr` and `total_deal_value` untouched.

## Approach
Single `supabase--insert` call running an `UPDATE ... FROM (VALUES …)` against `staffing_deals` keyed by `deal_id`. The VALUES list will encode all ~140 rows from the paste with parsed numeric MRR / total value / start / end. A second `UPDATE` clears MRR/total back to existing for Neema's deals — simpler: split into two `UPDATE`s:

1. **Non-Neema deals:** update `mrr`, `total_deal_value`, `start_date`, `end_date` where `vsd IS DISTINCT FROM 'Neema Jayadas'`.
2. **Neema's deals:** update only `start_date`, `end_date` where `vsd = 'Neema Jayadas'`.

## Parsing rules
- MRR / Total: strip commas, blanks → `NULL` (skip if blank).
- Start/End month: `MMM-YY` → first/last day of month. Blank cells → skip (leave existing date).
- Rows where start or end is blank: only update the side that has a value.
- Rows where `deal_id` doesn't exist in DB: no-op (safe with `UPDATE … WHERE deal_id = ...`).

## Out of scope
- No reallocations, no other column changes.
- Rows in the paste with no deal_id (the two blank-ID lines for Aditya Birla Sun Life Insurance and Edelweiss Life) are skipped.
- The `100702` row appears as `Apr-25 → Mar-26`; existing TT… ids that weren't renamed earlier still match by their TT id.

## Confirmation
Reply "go" and I'll run the two UPDATE statements.
