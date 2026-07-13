# Pulse/NPS Analytics — Deal-wise Responses table + VSD/BOPM access

## 1. New "Responses" table (deal + recipient centric)

Rebuild `src/components/pulse/AnalyticsResponsesTable.tsx` so the Responses view is **invite-driven** (one row per survey invite / recipient) instead of response-driven. This gives a full lifecycle view — sent, opened, completed, and, when available, the response scores.

Columns (in order):

| Column | Source |
| --- | --- |
| Deal | `invite.deal_name` (fallback `account`), with `deal_id` shown as subtext |
| Recipient | `invite.recipient_name` + `recipient_email` |
| Status | Derived: `Completed` (if `completed_at`) → green, `Opened` (if `opened_at`) → amber, `Sent` (if `sent_at`) → blue, else `Pending`/`Failed` when `email_status` says so |
| Sent | `invite.sent_at` (date) |
| Opened | `invite.opened_at` (date, "—" if empty) |
| Completed | `invite.completed_at` (date, "—" if empty) |
| Respondent | `response.respondent_name` / email (from matched response, "—" if none) |
| Campaign | `invite.campaign_name` |
| NPS | `response.nps` |
| CSAT | `response.csat_avg` |
| Response | Eye button — disabled when no response; opens the existing `SurveyResponseView` dialog with the full form + answers (same `Dialog` as today) |

Behavior:
- Build rows by iterating `invites` and left-joining the latest `response` per `invite_id`.
- Sortable columns (submitted date replaced by Sent date default, desc).
- Keep the existing search box and CSV export; update export headers/columns to match the new table.
- Empty NPS/CSAT/Respondent render as `—` for pending invites.
- Status pill uses semantic colors already in the design system (green/amber/blue/red).

No changes needed to `useAnalyticsData` — `invites` already carries `sent_at`, `opened_at`, `completed_at`, `email_status`, `campaign_name`, `recipient_*`, and responses are keyed by `invite_id`.

## 2. Access: open Analytics to VSDs and BOPMs

Currently `/pulse-nps/analytics` is `adminOnly` in `src/App.tsx`. Broaden to anyone who can edit RGY (already scoped correctly for our need):

- `src/App.tsx`: remove `adminOnly` from the `/pulse-nps/analytics` route. Keep `routeKey="rgy-health"` gate and `ProtectedRoute`.
- `src/pages/PulseNPSAnalytics.tsx`: gate is already `useCanEditRgy()`, which returns true for `admin`, `member` (VSD), `capability_lead`, and any staffing person whose title contains `bopm`/`vsd`. No further change required.
- Data scoping is already enforced server-side: `survey_invites` / `survey_responses` are filtered by `visible_deal_ids_for_user(auth.uid())`, so VSDs and BOPMs will only see invites/responses for deals they are tagged in. No RLS changes.
- Keep the top page's `/pulse-nps` (send surveys) as admin-only — no changes there.

## Technical notes

- File edits: `src/components/pulse/AnalyticsResponsesTable.tsx` (rewrite rows/columns/CSV), `src/App.tsx` (drop `adminOnly` on the analytics route only).
- No DB migrations, no edge-function changes.
- The existing `SurveyResponseView` component already renders the entire form + answers — reuse as-is for the "Response" drill-in.

```text
Responses view (new)
┌──────────────────────────────────────────────────────────────────────────────┐
│ Deal | Recipient | Status | Sent | Opened | Completed | Respondent | ...    │
│ Acme │ Jane D.   │ ✅ Done │ 10/1 │ 10/2   │ 10/3      │ Jane D.    │ ...   │
│ Beta │ John S.   │ 🟡 Open │ 10/1 │ 10/2   │ —         │ —          │ ...   │
│ Gamma│ Sara P.   │ 🔵 Sent │ 10/1 │ —      │ —         │ —          │ ...   │
└──────────────────────────────────────────────────────────────────────────────┘
```
