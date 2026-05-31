## Goal
Trim the Users & Roles list to only the people who should actually be in the platform, and assign each a role that matches their function.

## Final user set

Keep exactly these auth users:

1. Every active member of People Ops (`staffing_people` where `leaving = false` and `tbh = false`) — provision an auth account for anyone who doesn't already have one (existing "Provision from People" flow logic, requires every kept person to have an email).
2. The named overrides below, regardless of role mapping.

Delete every other auth user (including duplicates and unmapped accounts).

## Role mapping (applied after the cleanup)

| Person / Group | Role |
|---|---|
| Anirudh Singla, Shashwat Sood, Arya Gada | Admin |
| Priyanka Sharma, Apurva Dalmia, Dhruv Kotak, Rashi Musadi | View Only |
| `role_title = 'VSD'` | VSD (`member`) |
| `role_title IN ('BOPM','Senior BOPM','Group BOPM')` | BOPM (`user`) |
| `role_title LIKE '%Capability Leader%'` | Capability Leader (`capability_lead`) |
| All other active People Ops members | Capability Member (`capability_member`) |

Each user gets exactly one role (existing rows wiped, new role inserted).

## Execution steps

1. **Audit (read-only)** — list all current auth users and flag which fall in: (a) keep-by-People-Ops, (b) keep-by-name-override, (c) delete. Report counts back before destructive action.
2. **Resolve missing emails** — for any active People Ops person without an email, surface them in the existing "missing email" panel; ask the user to fill before provisioning. (No silent guessing.)
3. **Provision missing** — run `admin-user-mgmt` `bulk_provision` so every active People Ops person has an auth account.
4. **Delete excess users** — call `admin-user-mgmt` `action: "delete"` for every user_id not in the keep set. This also cleans duplicate accounts for the same person (keep the one linked to the canonical `staffing_people.id`, delete the others).
5. **Reassign roles** — for each kept user, wipe `user_roles` rows and insert the single role derived from the mapping above. Named overrides take precedence over the role_title mapping.
6. **Verify** — re-query: confirm auth user count = active People Ops count + any extra named overrides not in People Ops, and that role distribution matches expectations.

## Technical notes

- All deletions go through the `admin-user-mgmt` edge function (service-role) so cascades on `profiles`, `user_roles`, `user_route_overrides`, `personal_todos`, etc. happen cleanly.
- Duplicate handling: when one staffing person has multiple `profiles` rows, keep the user whose `profiles.staffing_person_id` matches the canonical People Ops `id`; delete the rest.
- This is a one-shot data operation — no UI changes to `UsersTab.tsx` are needed.
- Self-protection: the current admin user must remain (Anirudh / Arya / Shashwat are all admins, so safe).

## Out of scope

- Changing how new signups get a role (handled by existing `handle_new_user` trigger; future signups will still default to `user`).
- Editing People Ops directory itself.
- Re-enabling deleted users later — they can re-sign up via the existing signup flow.

## Confirmation needed before I run destructive steps

I'll first post the audit (counts + the exact delete list) in chat. You confirm, then I execute the deletes + role reassignment.
