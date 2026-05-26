## Goal
Add the 115 people from the pasted list to `staffing_people`, then create matching app users — without overwriting any record that already exists.

## Step 1 — Upsert into `staffing_people` (insert-only)

Build one `INSERT … ON CONFLICT (id) DO NOTHING` for all 115 rows. For each row we set:

| Column | Source |
|---|---|
| `id` | P-code (e.g. `P001`) |
| `name` | Full name |
| `email` | Email |
| `department` | Department string as provided (`Leadership`, `Delivery Ops and CS`, `Capability - Quality Team`, `Capability - SEO Team`, `Capability - Digital Strategy`, `Capability - Creative Team`, `Capability - Video Production Team`, `Central COE & Planning`, `SEO Capability`) |
| `reporting_manager` | Name string as provided (blank/`-` → `''`) |
| `designation` | Role text as provided (blank when empty) |
| `role_category` | Derived from department: `SEO` for SEO teams, `Creative` for Creative/Video, `Quality` for Quality, `Strategy` for Digital Strategy, `BOPM` for Delivery Ops and CS, `Leadership` for Leadership, `Central` for Central COE |
| `role_title` | Same as `designation` (kept consistent with how existing rows are populated) |
| `leaving` | `false` |
| `tbh` | `false` |
| `region` | `'India'` (default — matches existing rows) |

`ON CONFLICT (id) DO NOTHING` means every P-code already in the table (≈half the list, per my spot-check) is left completely untouched — no department, manager, or email is overwritten.

## Step 2 — Provision auth users

Call the existing `admin-user-mgmt` edge function with `{ action: "bulk_provision", send_invite: true }` (the same call the Users tab makes from the "Provision missing users" button). It will:

- Walk `staffing_people` and create an `auth.users` row for every email that doesn't already exist.
- Fire `handle_new_user`, which links the new auth user to its staffing record, creates a `profiles` row, and inserts a default `user` entry in `user_roles`.
- Skip people whose email already maps to an auth user (no duplicate accounts).

I'll invoke this from a one-off script using the service-role key so it runs unattended.

## Step 3 — Verify

- `SELECT COUNT(*) FROM staffing_people WHERE id = ANY(<list of 115 ids>)` — should be 115.
- Spot-check 3 newly inserted rows to confirm department / reporting_manager / designation are set.
- Spot-check that an auth user now exists for one new email (e.g. `rishabh@peppercontent.io`).

## Notes / non-goals

- I will not modify any pre-existing `staffing_people` row, even if the pasted data differs (e.g. P028 already has designation "Managing Editor" while the paste leaves it blank — existing row wins, per your instruction).
- No edits to roles in `user_roles` beyond what `handle_new_user` assigns (default `user`). Promoting anyone to admin/member stays a manual action in the Users tab.
- I will not touch the route_visibility / overrides tables.
