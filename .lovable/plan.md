## Goal

In Pulse/NPS → Analytics → Responses, show a deal-level table (responses received or not) where each deal row expands into the existing per-POC (recipient) rows.

## What to build

In `src/components/pulse/AnalyticsResponsesTable.tsx`:

1. **Layout toggle** next to the existing filter input: `Deal-wise` (new, default) / `Flat` (current table). Everything else — filter box, unique-contacts checkbox, resend buttons, CSV export, response drill-in dialog — stays as-is and keeps working in both modes.
2. **Deal-wise grouping**: group the already-filtered rows by `deal_id` (fall back to deal name when blank). Each deal parent row shows:
  - Deal name + deal ID, account
  - Responses badge: `received / sent` (e.g. `2/5`) with a colour cue — green when all responded, amber when partial, grey/red when zero
  - Invites count, Avg NPS and Avg CSAT across that deal's completed responses (blank when none)
  - Latest sent / latest completed date
  - Chevron to expand/collapse
3. **Collapsible per-POC block**: expanding a deal renders the current per-recipient columns (Recipient, Status, Sent, Opened, Completed, Respondent, Campaign, Source, NPS, CSAT, View response, Resend) as a nested sub-table, reusing the existing status chips, tooltips, View dialog and resend handlers — no duplicated logic.
4. **Sorting in deal mode** on the deal-level columns: deal name, invites, responses received, response rate, avg NPS, avg CSAT, last sent. Flat mode keeps its current sorting.
5. **Expand/collapse all** control, and deals default to collapsed.
6. **CSV export** in deal mode exports the deal-level summary; flat mode keeps the current per-invite export.  
  
The unique only filter should be applicable show unique POCs  
The current layout should not change this is in addition to it

## Notes

- Purely presentational — no data-fetch, scoping, or RLS changes, so VSD/BOPM visibility stays exactly as today.
- No new columns or backend work required; all fields come from the existing `invites`/`responses` props.