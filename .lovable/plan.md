# Demo logins for VSDs and BOPMs

Provision dedicated demo login accounts for each VSD and a few BOPMs so you can sign in as any of them and see exactly what the app looks like under their access scope (Clients & Deals, Staffing, RGY, MBR, Dashboard).

## Accounts to create

All accounts use the same easy password: **`Demo@1234`** (you can rotate later from Settings → Users).

### VSD accounts (role = `user`, linked to their staffing person)
| Login email | Person | Sees |
|---|---|---|
| `aditya.shaw+demo@peppercontent.io` | Aditya Shaw (P437) | Deals where he is VSD / his BOPMs |
| `neema.jayadas+demo@peppercontent.io` | Neema Jayadas (P378) | Her VSD pod |
| `aamir.khan+demo@peppercontent.io` | Aamir Khan (P112) | Integrated pod |
| `sumit.shekhawat+demo@peppercontent.io` | Sumit Shekhawat (P308) | India B2B pod |
| `sneha.iyer+demo@peppercontent.io` | Sneha Iyer (P064) | FMCG pod |

### BOPM accounts (role = `user`, linked to their staffing person)
| Login email | Person | Sees |
|---|---|---|
| `ritu.priya+demo@peppercontent.io` | Ritu Priya (P579, Sr BOPM under Aditya Shaw) | Only deals where she is staffed |
| `tiffany.fernandes+demo@peppercontent.io` | Tiffany Fernandes (P148, Sr BOPM) | Only her staffed deals |
| `shreshtha.pathak+demo@peppercontent.io` | Shreshtha Pathak (P543, Principal BOPM) | Only her staffed deals |

> Note: today `useDealAccess` gives the same "BOPM-style" scoping (own staffed deals only) regardless of whether the person is a VSD or BOPM. To make VSD logins actually behave like a VSD (i.e. see **all deals tagged to their VSD pod**, not just deals where they are personally listed as BOPM), we need a small access rule update — see "VSD scoping fix" below.

## Where you'll find them

A new **"Demo logins"** card on `Settings → Users` listing all 8 accounts with email, person, role, and a copy-to-clipboard button for the password. Click any row → instantly opens a new tab with the email pre-filled on the login page.

## Technical changes

1. **Edge function** — extend `supabase/functions/admin-user-mgmt/index.ts` with a new `action: "provision_demo_logins"` that:
   - Takes a hard-coded list of `{ personId, email }` pairs (the 8 above).
   - For each: creates the auth user with password `Demo@1234` and `email_confirm: true`, upserts `profiles` with `staffing_person_id = personId` and `display_name = person.name`, and ensures a `user_roles` row with role `user`.
   - Idempotent — if the email already exists, just re-link the profile/role.

2. **VSD scoping fix** — update `src/hooks/useDealAccess.ts` so that when the logged-in person's `role_title` matches `/VSD/i`, `ownDealIds` also includes every deal whose `vsd` field canonicalises to that person's name (using the same `matchesVsd` helper used elsewhere). BOPM behaviour is unchanged.

3. **Settings UI** — add a `DemoLoginsCard` to `src/pages/admin/UsersTab.tsx` that:
   - Shows the 8 accounts in a small table (Person, Role, Email, Password = `Demo@1234`, Copy buttons, "Open login" link).
   - Has a single "Provision / repair demo logins" button that calls the new edge action and toasts the result.

4. **No DB schema migration** required — `profiles`, `user_roles`, `staffing_people` already support everything needed.

## Files to edit / create

- Edit `supabase/functions/admin-user-mgmt/index.ts` — add `provision_demo_logins` action.
- Edit `src/hooks/useDealAccess.ts` — VSD-pod expansion when `role_title` is VSD.
- Edit `src/pages/admin/UsersTab.tsx` — render the new card.
- Create `src/components/admin/DemoLoginsCard.tsx` — the card + table + provision button.

After approval I will run the provision action once so you can immediately log in with any of the 8 emails using `Demo@1234`.
