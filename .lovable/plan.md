## 1. Slack Review — Retainer / Non‑Retainer filter fix

The DB stores `deal_type` as `Retainer` / `Non-Retainer`, so the values line up with `DealTypeFilter` — but `SlackReviewTab` currently reads `deal_type` off the merged row where `slack_channel_health.*` is spread first and it turns out at least one health-view field is masking the deal metadata (rows land with an empty `deal_type` on connected channels). Fix:

- In `useSlackHealth()`, invert the merge order so deal-meta fields (`account`, `deal_name`, `vsd`, `senior_bopm`, `principal_bopm`, `bopm`, `mrr`, `deal_type`) always overwrite anything from `h`, and drop the duplicated `principalBopm` / `seniorBopm` alias fields (they were only added to make the BOPM filter work — the fix below makes that unnecessary).
- Guard the filter with a normalised compare (`(r.deal_type || "").trim() === value`) inside `dealMatchesType` usage, so stray casing/whitespace from the sheet import doesn't slip through.
- Verify in the browser after the change that switching Retainer / Non‑Retainer changes the "N of M" count and the rendered rows.

## 2. Slack Review — sortable columns

Reuse the same lightweight sort pattern that Clients & Deals uses (click header toggles asc → desc → none; single active sort key).

- Add local state `{ sortKey, sortDir }` in `SlackReviewTab`.
- Wrap `<ConnectionTable>` headers in buttons that call a `toggleSort(key)` and render an arrow when active.
- Sortable keys: `account`, `deal_name`, `vsd`, `senior_bopm`, `is_connected` (Slack column), `channel_name`, `last_msg_at` (date), `msg_count_90d`, `rgy` (R → Y → G order).
- Apply the sort to `filtered` before passing into `ConnectionTable` (memoized).
- Keep the existing default order (no sort) when `sortKey` is null.

## 3. Staffing & Capacity — "Staffing not locked" filter

`DealStaffingCard` already exposes lock state via `deal.staffingLockedAt`. Add a filter to `StaffingDealsList` mirroring the existing `activeOnly` checkbox:

- New pill in the filter bar: "All / Locked / Not locked" (default All).
- Extend the `filtered` memo: when "Not locked" → `!d.staffingLockedAt`; when "Locked" → `!!d.staffingLockedAt`.
- Reset `page` to 1 on change.
- Placement: right after the deal-type pill group, so it reads left-to-right with the existing toggles.

## 4. Restrict inline client-name edit from BOPMs

Clients & Deals currently allows every viewer to edit the client name inline. Tighten it to match the existing `isBopmViewOnly` gate that already guards Status / MRR / Total Revenue:

- In `src/pages/Clients.tsx`, change the `account` cell so that when `isBopmViewOnly` is true it renders the plain truncated name (same look as today, minus the pencil affordance), and only mounts `<InlineEditCell>` for non‑BOPM viewers.
- No change to Cap Leads / VSDs / Admins — they keep unlimited inline edits and the cascade into `staffing_deals.account`.
- No change to `useClients.updateClient` cascade logic.

## Technical notes

- `deal_type` filter root cause is that the `slack_channel_health` view row is spread *before* deal meta in the merge; even if today only alias fields collide, the order is fragile. Making deal meta authoritative is the durable fix.
- Sortable headers stay inside `ConnectionTable`; the sort state lives one level up so filter/sort re-runs share the same memo dependency chain.
- The "Not locked" filter is purely presentational — no changes to lock mutations or DB.
- BOPM gating reuses the existing `isBopmViewOnly` flag; no new role plumbing.

Files touched:
- `src/components/rgy/SlackReviewTab.tsx` (merge order + sort + filter compare)
- `src/components/staffing/StaffingDealsList.tsx` (lock filter)
- `src/pages/Clients.tsx` (BOPM inline-edit gate on client name)
