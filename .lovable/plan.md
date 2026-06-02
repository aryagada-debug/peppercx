## Plan

### Part 1 — "Create user" dialog (replaces invite-link flow for select admins)

**Who can use it:** Only these 3 admin emails see the "Create user" button on the Users tab. Everyone else continues to see the existing "Invite via signup link":

- the current logged-in user (you)
- [shashwat@peppercontent.io](mailto:shashwat@peppercontent.io)
- [anirudh@peppercontent.io](mailto:anirudh@peppercontent.io)

(Final emails to be confirmed — see Open Questions.)

**UI** — `src/pages/admin/UsersTab.tsx`

- New **"Create user"** button (replaces "Invite via signup link" for the 3 admins).
- Opens a `Dialog` with fields:
  - Full name (required)
  - Email (required, validated)
  - Role (select: User / Member / Admin — defaults to User)
  - Staffing person (searchable select from `staffing_people`, optional but recommended — links them so they see their deals)
  - Temporary password (auto-generated, shown after creation with copy button; user can change on first login)
- On submit → calls edge function `admin-user-mgmt` with new action `create_user`.
- On success → shows the temp password in a confirmation panel ("Share this with the user, they can reset it after sign-in"), reloads the user list.

**Edge function** — `supabase/functions/admin-user-mgmt/index.ts`

- New action `create_user` accepting `{ email, name, role, staffing_person_id?, password? }`.
- Uses `adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata })`.
- Upserts `profiles` (display_name, staffing_person_id) and inserts requested role into `user_roles`.
- Returns the generated/used password so the UI can display it.

No database changes needed.

---

### Part 2 — Usage tab: per-page activity + horizontal bar chart by role

**Goal:** Show which pages of the app are being used, and which roles use them most. Rendered as a horizontal bar chart (Recharts) above the existing users table.

**Tracking layer (new):**

- New table `public.user_page_views`:
  - `id uuid pk`
  - `user_id uuid` (auth.users)
  - `route_key text` (e.g. `dashboard`, `clients`, `staffing`, `deal-detail`, `rgy-health`, `mbr-tracker`, `targets`, `settings`, `onboarding`, `home`)
  - `path text` (full path, for debugging)
  - `visited_at timestamptz default now()`
- RLS: insert allowed for any authenticated user (own row only); select allowed for admins.
- GRANTs per project conventions.
- Index on `(visited_at desc)` and `(user_id, visited_at desc)`.

**Client tracking:**

- New tiny hook `useRouteTracking` mounted once in `AppLayout` (or `App.tsx`). On every `location.pathname` change, derive `route_key` from the path and insert a row. Debounced so rapid nav doesn't spam.

**UsageTab chart (`src/pages/admin/UsageTab.tsx`):**

- Aggregate `user_page_views` for the selected range (reuses existing 7/30/90 toggle).
- Join with `user_roles` to get role per user.
- Render a Recharts `BarChart` with `layout="vertical"`:
  - Y-axis: page name (route label)
  - X-axis: number of visits
  - Stacked by role (Admin / Member / User) using design-system semantic colors
  - Tooltip shows breakdown by role
- Placed in a new "Page activity by role" card directly under the KPI strip.

### Technical Notes

- Route-key derivation lives in `src/lib/routeKey.ts` (reuses the same keys already in `ROUTE_LABELS` in `UsersTab.tsx`).
- Recharts is already used in the project (e.g. dashboard).
- No changes to existing session heartbeat or session-time logic.
- The 3-admin allowlist for "Create user" is hardcoded by email in the frontend; the edge function still enforces admin-role check, so security is unchanged.

### Open questions

1. Are these the correct emails for the 3 admins who get "Create user"?
  - Your account email (please confirm) arya.gada@peppercontent.io
  - [shashwat@peppercontent.io](mailto:shashwat@peppercontent.io)
  - [anirudh@peppercontent.io](mailto:anirudh@peppercontent.io)
2. Should the "Invite via signup link" option be **hidden entirely** for these 3 admins, or should both options coexist (Create user + Invite link)? delete it entirely
3. For the bar chart — track **all routes** (incl. nested like `/deals/:id`) collapsed to `deal-detail`, or only the top-level pages from the sidebar? nested