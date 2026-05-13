## Goal
When an admin adds a person in Settings → People (or the user already exists in `staffing_people` with an email), automatically create a login account with the email and shared password `Pepper@2026`, and harden the flow against common breakage.

## Changes

### 1. Edge function: new single-user provisioning action
File: `supabase/functions/admin-user-mgmt/index.ts`

- Add action `provision_person` (admin-only, same JWT/role gate as today):
  - Input: `{ person_id: string, email?: string, name?: string }`.
  - Loads `staffing_people` by id; resolves email + name from the row if not passed.
  - Trims + lower-cases email; rejects with 400 if missing/invalid.
  - Lists auth users; if email already exists → skip create, reset password to `Pepper@2026`, set `email_confirm: true`. Otherwise `auth.admin.createUser({ email, password: "Pepper@2026", email_confirm: true, user_metadata: { full_name } })`.
  - Upserts `profiles` with `{ user_id, display_name, staffing_person_id }` on conflict `user_id` (so the link is explicit and overrides the email-only auto-link from `handle_new_user`).
  - Inserts default `'user'` role into `user_roles` (ignore conflict).
  - Returns `{ status: "created" | "linked" | "reset", user_id, email, password: "Pepper@2026" }`.
- Constant `DEFAULT_PASSWORD = "Pepper@2026"` reused by `bulk_provision` so the “Provision from People” button no longer generates throwaway random passwords (consistent admin promise).

### 2. Frontend: trigger provisioning when a person is added
Files: `src/hooks/useStaffingData.ts`, `src/components/settings/AddPersonDialog.tsx`

- In `addPerson`, after the `staffing_people` insert succeeds:
  - If `person.email` is non-empty, `await supabase.functions.invoke("admin-user-mgmt", { body: { action: "provision_person", person_id, email, name } })`.
  - On success toast: `"<name> added · login: <email> / Pepper@2026"`.
  - On non-admin caller (403) or other error, surface a soft toast “Person added; login account not created (admin only).” — don’t roll back the row.
- In `AddPersonDialog`:
  - Promote Email to required when the admin wants login access; show inline helper text: “A login will be created with password **Pepper@2026** if an email is provided.”
  - Block submit if email looks invalid (already partly there).

### 3. Backfill for Simran and any other person already added without an auth account
- Call the new `provision_person` action for `Simran.pohani@peppercontent.io` (resolve her `person_id` from `staffing_people` first). Done via the deployed edge function once the migration above ships — handled automatically the first time admin opens Users tab if we wire a one-time backfill, OR done explicitly via the existing **Provision from People** button (which already iterates everyone and now uses `Pepper@2026`).

### 4. Hardening / issues fixed along the way
- **Profile not linked to person**: today `handle_new_user` only links by email if the staffing row exists with `leaving=false` and `tbh=false`. The new action upserts the link explicitly with the known `person_id`, so case-mismatched or freshly-added rows still link.
- **Duplicate auth user crash**: handled by detecting existing email and resetting password instead of failing.
- **Person added with no email**: surfaced as a warning chip in Users tab’s “missing emails” list (already exists) — `addPerson` no-ops the auth call so no spurious error.
- **Non-admin tries to add a person**: edge function returns 403; UI now degrades gracefully instead of throwing.
- **Race with `handle_new_user` trigger**: explicit `profiles` upsert with `staffing_person_id` overrides any email-only link the trigger created.

## Files touched
- `supabase/functions/admin-user-mgmt/index.ts` (add `provision_person`, share `Pepper@2026` constant)
- `src/hooks/useStaffingData.ts` (`addPerson` invokes provisioning)
- `src/components/settings/AddPersonDialog.tsx` (helper text + email validation copy)

No DB migrations required.