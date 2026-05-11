## Plan

1. **Fix assignee identity resolution**
   - Update Home’s internal task assignment logic so it can resolve a selected teammate through the app user directory, not only through `profiles.staffing_person_id`.
   - This covers admins or other signed-in users who may not be linked to a staffing person record.

2. **Pass the real user identity into internal assignment**
   - Extend the internal assignee options used by the Home “Add Task → Internal” dialog to include the linked auth user ID when available.
   - When assigning to an admin account, save `personal_todos.user_id` as that admin’s user ID so it appears in their Home and Personal to-do immediately.

3. **Keep pending staffing assignments working**
   - If the selected person has no linked login yet, keep the current pending behavior using `assignee_staffing_person_id` so it appears once their profile links.

4. **Add a safe backend helper if RLS blocks profile lookup**
   - Because `profiles` is currently only readable by the logged-in user, add a small security-definer database function that returns only the minimal assignee mapping needed for task assignment: user ID, display name, and staffing person ID.
   - Update the frontend to use this helper for assignment resolution.

5. **Validate the fix**
   - Confirm internal tasks assigned from one account to another are inserted with the recipient’s `user_id` when the recipient has signed in.
   - Confirm the assigner still sees “to …” and the assignee sees “from …”.

## Technical notes

- Main file: `src/pages/Home.tsx`.
- Database change: add a read-only helper function for assignee lookup; no new table is needed.
- Existing `personal_todos` policies can stay mostly intact because tasks assigned to signed-in users already become visible via `user_id = auth.uid()`.