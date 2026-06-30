# Deal Handover — "Open in Staffing" + suggested staffing

When a handover row reaches `Created`, expose a one-click path to that deal's row on the Staffing & Capacity page and surface a "Suggested staffing" panel built from comparable deals.

## 1. "Open in Staffing" link

In `src/pages/DealHandover.tsx`, in the drawer's green "Deal created" banner, add a second button next to **Open deal**:

- Label: **Open in Staffing**
- Route: `/staffing?tab=deal&deal=<created_deal_id>`
- The Staffing page already reads `?tab` and `?deal` (see `Staffing.tsx` lines 41–43), so no Staffing-side changes are needed beyond confirming it auto-scrolls/expands the matching deal row. If it doesn't already, add a small `useEffect` that scrolls the matching row into view.

## 2. Suggested staffing panel (in the drawer)

Add a new `Card` titled **Suggested staffing (based on similar deals)** that appears when the handover row's deal type / BU / capability are present (works even before the deal is `Created`, using the handover form's own fields).

### Matching logic

1. Fetch up to ~20 `staffing_deals` that match the handover row, scored by:
   - Same `capability_line` (+3)
   - Same `business_unit` (+2)
   - Same `vsd` name (+2)
   - Same `deal_type` (+1)
   - MRR within ±30% (+1)
2. Drop the handover's own `created_deal_id` from results.
3. Take the top 5 highest-scored matches.

### Aggregation

For those top deals, pull their `staffing_assignments` (role_key, person_id, allocation_pct). Group by `role_key` and compute:

- Frequency (how many of the comparable deals had this role)
- Median allocation %
- Top 2 most-frequently-staffed people for that role (names from `staffing_people`)

Render as a compact table:

```text
Role              Typical %   Frequency   Common people
Senior BOPM       40%         4 / 5       Sneha I., Aamir K.
Content Lead      60%         3 / 5       Riya P.
SEO Manager       50%         3 / 5       Karan S.
```

Each row gets a small **Use** button that, when the deal is already `Created`, deep-links to `/staffing?tab=deal&deal=<id>&prefill_role=<role_key>` so the staffing grid can preselect that role. (Staffing.tsx already consumes `deal` — add a no-op read for `prefill_role` later if/when we wire that side.)

If the deal isn't created yet, the suggestions are read-only; the panel shows a hint: *"Create the deal to apply these into Staffing."*

### Empty state

If fewer than 2 comparable deals are found, show: *"Not enough similar deals to suggest staffing yet."*

## Files touched

- `src/pages/DealHandover.tsx` — add **Open in Staffing** button; render the new `<SuggestedStaffingCard />`.
- `src/components/handover/SuggestedStaffingCard.tsx` (new) — fetch + score + aggregate + render.

No DB migrations, no edge functions.

## Technical notes

- Reuse `supabase` client; the queries are read-only against `staffing_deals`, `staffing_assignments`, `staffing_people`.
- Use `useQuery` keyed by `(vsd, bu, capability, deal_type, mrr)` so suggestions are cached per handover row.
- Role labels: pass `role_key` through `normalize_staffing_role_key` mapping that the app already uses, then humanize (e.g. `senior_bopm` → "Senior BOPM").
