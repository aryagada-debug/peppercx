# Replace temp `TT…` deal IDs with new formulated IDs

## Scope

Update the text `deal_id` field on the deals table (and the two related tables that store the text ID) from each `TT…` temp value to the new formulated numeric ID provided in the mapping.

## Mapping

90 rows in the user-provided list have a real numeric target (e.g. `TT12031 → 101057`). The remaining ~30 rows map `TT… → TT…` (same value) and will be left unchanged per the answer to the clarifying question. `TT09028` has a trailing space in the source list (`100980 ` → `TT09028`); will be trimmed.

## Tables affected

A scan showed temp `TT…` deal IDs only live in three tables:

- `staffing_deals.deal_id` — 93 rows
- `deal_financials.deal_id` — 1 row
- `deal_financial_targets.deal_id` — 1 row

All other deal-scoped tables (`staffing_assignments`, `deal_tasks`, `deal_sow_items`, `mbr_entries`, `deal_revenue_monthly`, `deal_rgy_weekly`, `deal_applicability`, `deal_stakeholders`, `deal_onboarding_steps`, `deal_rgy_notes`, etc.) already reference deals by the immutable UUID `id`, so they need **no change** and existing staffing allocations will automatically follow the renamed deal.

## Approach

A single SQL data-update via the `insert` tool, using a `VALUES (...)` mapping table joined into each of the three tables:

```sql
WITH map(old_id, new_id) AS (
  VALUES ('TT12031','101057'), ('TT09019','100947'), … -- 90 pairs
)
UPDATE staffing_deals s
   SET deal_id = m.new_id, updated_at = now()
  FROM map m
 WHERE s.deal_id = m.old_id;

-- same UPDATE pattern for deal_financials and deal_financial_targets
```

Pre-check `SELECT old_id FROM map WHERE old_id NOT IN (SELECT deal_id FROM staffing_deals)` to flag any temp IDs that don't exist in the DB so they can be reported back rather than silently skipped.

## Staffing reallocation

Per your answer, no reassignment is needed — `staffing_assignments` links to deals via the UUID `id`, so every person already allocated to e.g. `TT12031` will still be allocated to that same deal under its new ID `101057`. Nothing else to do.

## Out of scope

- The ~30 entries where `TT… → TT…` (no new ID): left as-is.
- Importing a fresh staffing CSV: not requested in this round.

## Deliverables

1. Run the 3 `UPDATE … FROM (VALUES …)` statements.
2. Report back: rows updated per table, plus any mapping rows whose `old_id` was not found in the DB.
