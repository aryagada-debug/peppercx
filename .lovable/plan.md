## Cleanup duplicate demo users

Ten `+demo@peppercontent.io` accounts share `staffing_person_id` with real employee accounts, causing each person to appear twice in Usage/Users. These were created by the admin "Provision demo logins" action.

### Accounts to delete
Aamir Khan, Aditya Shaw, Mayur Varade, Neema Jayadas, Ritu Shinde, Shreshtha Pathak, Sneha Iyer, Sumit Shekhawat, Tiffany Fernandes, Vedanga Bandyopadhyay — all the `*+demo@peppercontent.io` variants.

### Steps

1. **Delete the auth users** — call the existing `admin-user-mgmt` edge function (or `auth.admin.deleteUser`) for each of the 10 user IDs. This cascades to `profiles`, `user_roles`, `user_sessions`, and other `user_id`-keyed rows via FK/RLS cleanup. Run as a one-shot SQL via the data tool:
   - `DELETE FROM auth.users WHERE email LIKE '%+demo@peppercontent.io'` (cascades through linked public tables that reference `user_id`).
   - Any leftover `public.profiles` / `public.user_roles` rows without an FK cascade get cleaned in the same migration.

2. **Remove the provisioning UI** so the duplicates can't be re-created:
   - Delete `src/components/admin/DemoLoginsCard.tsx`.
   - Remove its import + render from the admin Settings page (search for `DemoLoginsCard`).
   - Delete the `provision_demo_logins` branch from `supabase/functions/admin-user-mgmt/index.ts` (and the function file if that was its only action).

3. **Verify** — re-query `auth.users` / `profiles` to confirm no `+demo` emails remain and the Usage tab no longer shows duplicate rows.

### Technical notes
- Deletion happens via the data-change tool (cascades) rather than a schema migration.
- No schema change is required; no other code paths reference the `+demo` accounts beyond `DemoLoginsCard`.
