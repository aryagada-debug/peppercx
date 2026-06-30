## 1. Pulse / NPS Analytics — new "Responses" view

In `src/pages/PulseNPSAnalytics.tsx`, add a top-level toggle next to "Group by":

- **Summary** (current grouped table + chart) — default
- **Responses** (new flat table of every individual submission)

When **Responses** is selected, hide the "Group by" / "Tier" controls and render a new `AnalyticsResponsesTable` instead of `AnalyticsTable`. KPI strip and all existing filters (date range, VSD, BOPM, capability, search, include closed) continue to apply.

### New component: `src/components/pulse/AnalyticsResponsesTable.tsx`

One row per `survey_responses` record (joined with its `survey_invites` row for context). Columns, all sortable + a free-text filter:

| Column | Source |
|---|---|
| Submitted | `submitted_at` |
| Deal ID | `invite.deal_id` |
| Deal name | `invite.deal_name_snapshot` (fallback `account_snapshot`) |
| Account | `invite.account_snapshot` |
| VSD | `invite.vsd_name` |
| S/P BOPM | `invite.principal_bopm` + `invite.senior_bopm` (comma-joined, "—" if empty) |
| BOPM | `invite.bopm` |
| Total deal value | `staffing_deals.mrr × 12` if retainer, else `staffing_deals.deal_value` (hydrated by adding `deal_value, mrr, deal_type` to the deals lookup already done in `useAnalyticsData.ts`); formatted via `formatCurrency` |
| Respondent | `respondent_name` / `respondent_email` |
| NPS / CSAT / CES | numeric |
| Mood / Renew / Risk | string |
| Q&A | "View" button → opens a side drawer showing every key/value in `payload` (question text + answer), so you can see exactly what was filled |

Export-CSV button reuses the same rows.

### Data layer change: `src/components/pulse/useAnalyticsData.ts`

- Extend `InviteRow` with `deal_value: number | null`, `mrr: number | null`, `deal_type: string | null`.
- Update the `staffing_deals` hydration select to include those columns and map them onto each invite.

## 2. Handover drawer — remove inline suggested staffing

In `src/pages/DealHandover.tsx`:

- Remove the `<SuggestedStaffingCard …/>` block (and its import) from the management drawer.
- Suggestions continue to be generated/persisted in the original handover wizard flow and surface inside the deal's staffing card via the existing `SuggestedStaffingPanel` — which is exactly what the user wants when they click **Open in Staffing** from the drawer.

No changes to `SuggestedStaffingCard.tsx`, `SuggestedStaffingPanel.tsx`, `staffing_suggestions`, or the Staffing page.

## 3. Dark-mode fix for the "Deal created" banner

Same file, the green success strip at line 317 uses hardcoded `bg-green-50 border-green-200` which is unreadable in dark mode. Replace with semantic tokens that adapt:

```
bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300
```

(matches the token pattern already used elsewhere in the app for "good" tone strips.)

## Files touched

- `src/pages/PulseNPSAnalytics.tsx` — add view toggle, wire new table.
- `src/components/pulse/AnalyticsResponsesTable.tsx` — **new**.
- `src/components/pulse/useAnalyticsData.ts` — hydrate `deal_value/mrr/deal_type` onto invites.
- `src/pages/DealHandover.tsx` — drop `SuggestedStaffingCard`, fix banner colors.

No DB migrations, no edge function changes.
