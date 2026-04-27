# Restrict Visibility — Rates, Clients & Deals

## 1. Hide Rate/Hr & Cost/Week from non-admins

In **Deal Detail → Staffing tab**, the team table currently shows `Rate/Hr`, `Cost/Week`, and a `Cost/Week` KPI tile. Make these visible only when the user is an **Admin** (everyone else — including Principal/Senior BOPMs — won't see the columns or the tile).

- Use `useUserRole().isAdmin` to gate:
  - The `Rate/Hr` and `Cost/Week` `<th>` + `<td>` cells in the per-team table.
  - The `Cost/Week` KPI card in the summary grid (collapse the grid from 4 to 3 columns when hidden).
- "Revenue Managed", "Hrs/Week", and "Team Size" remain visible to everyone.
- The view-as-role toggle already lets admins preview the BOPM experience.

## 2. Clients & Deals visibility + edit access by role

Define visibility based on the logged-in user's `profiles.staffing_person_id` (already linked to `staffing_people.id`) and their role:

| Role | Sees | Can edit |
|---|---|---|
| **Admin** | All clients & deals | All |
| **Principal BOPM / Senior BOPM** (their staffing person is set as `principal_bopm`, `senior_bopm`, or `bopm` on a deal, OR is in `staffing_assignments` for it) | Their own deals + every deal sharing the same `vsd` as any of their own deals | Own deals only (where they're listed on the deal or assigned). Same-VSD peer deals are read-only |
| **Other members** (anyone added via `staffing_assignments` or listed on a deal) | Only the deals they're added to | Only those deals |
| **No deals** | Empty list | Nothing |

A "client" is visible if at least one of its deals is visible. Editing client fields requires edit access on at least one of its deals.

### Where this is enforced

- **`src/pages/Clients.tsx`** — filter `deals` to the visible set before computing `tableRows`, KPIs, VSD chips, and grouping by client. Pass an `isDealEditable(dealId)` predicate to disable inline edits, the status dropdown, the deal-row delete button, and the client delete button when no deals under that client are editable.
- **`src/pages/DealDetail.tsx`** — on load, if the deal isn't in the visible set, redirect back to `/clients` with a toast. If visible-but-not-editable, render in read-only mode (reuse the existing `isReadOnly` patterns: disable `EditableCell`, hide save/delete buttons, hide "Add Member", task editing, RGY editing, MBR input, etc.).
- **`src/pages/Deals.tsx`** — apply the same filter for any deal lists.

### New shared hook: `src/hooks/useDealAccess.ts`

Centralises the logic so every page/component uses one source of truth.

```ts
// Returns:
//   loading
//   visibleDealIds: Set<string>
//   editableDealIds: Set<string>
//   canViewDeal(id)
//   canEditDeal(id)
//   canViewClient(clientId)
//   canEditClient(clientId)
```

Steps inside the hook:
1. Read current user's `profiles.staffing_person_id` (already populated by `admin-user-mgmt`).
2. Look up their `staffing_people` row → `name`, `roleCategory`, `roleTitle`.
3. Determine if the person is a "BOPM-tier" user (role title contains "BOPM" / "Principal" / "Senior" — used to enable the same-VSD peer view).
4. Build `ownDealIds` = deals where the user appears in `principal_bopm` / `senior_bopm` / `bopm` (matched by name) OR in `staffing_assignments.person_id`.
5. Build `peerDealIds` (BOPMs only) = all deals whose `vsd` matches the `vsd` of any deal in `ownDealIds`.
6. `visibleDealIds = ownDealIds ∪ peerDealIds` (admin → all).
7. `editableDealIds = ownDealIds` (admin → all).
8. Map deal → client_id for the client-level helpers.

The hook listens for staffing data so it stays consistent with `useStaffingData` (re-uses the same client by passing in deals/assignments, or fetches its own minimal slice).

### UI affordances for read-only peer deals

- A small "View only — peer deal" badge next to the deal name in the detail page header.
- All inputs disabled, action buttons (`Add Member`, `Save`, `Delete`, RGY editor, MBR input, task creation) hidden.
- Existing `useUserRole().isReadOnly` styling pattern reused.

## 3. Database / RLS

Current RLS on `clients`, `staffing_deals`, `deal_*`, `mbr_entries`, etc. is `USING (true)` for all roles, so the filtering above happens entirely client-side for now. **No migration is required for this task** — the request is "show / give edit access only to…", which is a UI-level access model.

If you also want server-side enforcement later (recommended for hardened security), that's a separate larger task: add policies that join via `profiles.staffing_person_id` → `staffing_assignments` / `staffing_deals.{principal_bopm,senior_bopm,bopm}` and a same-VSD helper function. Flag this as a follow-up; not part of this change unless you confirm.

## Files changed

- `src/hooks/useDealAccess.ts` (new)
- `src/pages/Clients.tsx` (filter list, gate edits/deletes)
- `src/pages/DealDetail.tsx` (redirect on no-view, read-only mode on no-edit, hide Rate/Cost columns + KPI tile for non-admins)
- `src/pages/Deals.tsx` (apply filter)

## Open question

Should the same-VSD peer visibility apply to **all** members in that VSD's pod, or only to BOPM-tier users? The plan above limits it to BOPMs (matches your wording). Reply if you want it broader.
