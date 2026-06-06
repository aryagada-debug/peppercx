## Contacts (admin-only)

New page that aggregates every person from Org Mapping across all deals into one searchable, filterable, exportable table.

### Access
- Sidebar item **Contacts** (icon: Contact/Users) under "Core", visible only when `isAdmin` (from `useUserRole`).
- Route `/contacts` wrapped in `ProtectedRoute` with an in-page admin gate that redirects non-admins to `/home`.

### Data
Source: `deal_stakeholders` joined with `staffing_deals` on `deal_id`, joined with `clients` for region fallback.

Columns shown in table (and exported to Excel):
1. Name of Person (`name`)
2. LinkedIn Link (`linkedin_url`) — clickable
3. Email (`email`)
4. Phone Number (`phone`)
5. Designation (`role`)
6. Team Name (`function`) — the new SEO/Content/etc. taxonomy
7. Level of Influence (`decision_power`, 1–5)
8. Deal (`staffing_deals.client_name` + deal id) — clickable to `/deals/:id`
9. VSD (`staffing_deals.vsd`)
10. BOPM (`principal_bopm` / `senior_bopm` / `bopm` combined, comma-separated, non-empty only)
11. Region (`staffing_deals.geo` ?? `clients.geography`)

### UI
- Header: "Contacts" + subtitle "All people mapped across deals · admin only".
- Toolbar:
  - Search (name, email, role, deal, client)
  - Filters: Team Name, Region, VSD, Influence level
  - **Export to Excel** button (uses `xlsx` / `SheetJS`) → file `contacts-YYYY-MM-DD.xlsx`, single sheet with the columns above, auto-width.
- Table: dense, sortable headers, sticky header, follows existing design system (flat, purple primary, thin borders).
- Empty state when no rows.
- Counts pill: "X contacts across Y deals".

### Files
- `src/pages/Contacts.tsx` — new page (query + table + export).
- `src/components/layout/AppSidebar.tsx` — add Contacts nav item, admin-gated.
- `src/App.tsx` — register `/contacts` route (lazy).
- `package.json` — add `xlsx` dependency if not present.

### Notes / out of scope
- Read-only view; editing still happens inside each Deal → Org Map tab.
- No new DB tables or migrations; uses existing `deal_stakeholders`, `staffing_deals`, `clients`.
- No de-duplication across deals — same person on 2 deals shows as 2 rows (matches the "deal level" export requirement).
