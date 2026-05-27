# Weekly RGY Update Compliance Report (Central CX)

A new report tab inside the RGY Health Tracker that lets Central CX see, for every active deal each week, whether the VSD and the Principal/Sr. BOPM have either (a) edited the RGY, or (b) explicitly confirmed "Reviewed — No Change". Anything else shows up as outstanding.

## What Central CX will see

A new tab **"Weekly Compliance"** inside `/rgy-health` with:

- **Week selector** (defaults to current ISO week, Mon–Sun). Arrows for prev/next week.
- **Top KPIs**: Total Active Deals · Fully Compliant · Partially Compliant · Not Updated · Reviewed–No Change.
- **Compliance table**, one row per active deal:
  - Deal · Client · VSD · P/Sr BOPM
  - **VSD status** for the week: `Updated` (edited), `Reviewed – No Change` (confirmed), or `Pending` (with days-since-last-touch)
  - **BOPM status** for the week: same three states
  - Last updated by / at (per role)
  - Overall RGY this week
  - Actions: "Open deal", "Nudge on Slack" (uses existing Slack send)
- **Filters**: VSD, BOPM, Pod, compliance state, RGY status, search.
- **Export CSV** of the current view.

A small **"Mark Reviewed — No Change"** button is added to the existing RGY weekly grid (for the current week's row) so VSD/BOPM can record an intentional no-change in one click. This writes an audit row, which the report reads.

## How "updated" is detected

For the selected week (Mon 00:00 → Sun 23:59 in IST):

- **Updated**: at least one row exists in `deal_rgy_notes` for this `deal_id` within the week where `updated_by` resolves to a user whose role on that deal is VSD (or P/Sr BOPM). `deal_rgy_notes` is already written by `logRGYChange` on every cell edit, so we get who/when/from→to for free.
- **Reviewed – No Change**: a new sentinel row in `deal_rgy_notes` with `dimension = '__review__'`, `from_value = to_value = ''`, `note = 'Reviewed - no change'`. No schema change needed — the existing table already stores `updated_by`, `updated_by_name`, `week_start`, `created_at`.
- **Pending**: neither of the above for the week.

Role attribution per deal uses `staffing_assignments` joined to `profiles.user_id` (via `staffing_people.email → auth.users.email`), filtered to normalized role keys:

- VSD: `vsd`, `rt_vsd`
- P/Sr BOPM: `principal_bopm`, `senior_bopm`, `rt_group_bopm`, `rt_senior_bopm`

If the editor matches neither role for that deal, the edit still counts as "activity" but is shown in a separate "Other edits" tooltip — it does not satisfy VSD or BOPM compliance.

## Files

New:

- `src/components/rgy/WeeklyComplianceTab.tsx` — the report UI (KPIs, filters, table, CSV export).
- `src/hooks/useRgyWeeklyCompliance.ts` — fetches `staffing_deals` (active), `staffing_assignments` (VSD/BOPM per deal), and `deal_rgy_notes` for the week; returns per-deal compliance rows. Realtime subscription on `deal_rgy_notes`.
- `src/lib/rgyCompliance.ts` — pure helpers: week range (IST), role classification, status derivation.

Edits:

- `src/pages/RGYHealth.tsx` — add the new tab; wire week selector.
- `src/components/deals/EditableRGY.tsx` (or the weekly grid component used on RGY Health) — add **"Mark Reviewed — No Change"** button on the current-week row; on click, insert sentinel note via a new helper.
- `src/lib/rgyHistory.ts` — add `logRGYReviewedNoChange({ dealId, weekStart })` that inserts the sentinel row.

## Out of scope (call out, don't build now)

- Email/Slack auto-nudges for non-compliant deals (manual nudge button only).
- Editing role assignments from inside the report.
- Backfill of historical compliance before this feature ships (we can only count notes that exist).

## Open question

For Central CX, should "Compliance" require **both** VSD and BOPM to update/confirm in the same week, or is **either** sufficient? Default in the plan: both required for "Fully Compliant"; only one for "Partially Compliant". - Either is sufficient