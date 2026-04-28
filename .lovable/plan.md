## What's broken

Ritu Shinde logged in as a BOPM and saw nothing on Clients, Staffing, MBR, RGY, etc. — even though she's tagged as **Principal BOPM on ~25+ deals** (Tata AIG, Axis Bank, IIFL, Bajaj Allianz, ICICI, HSBC, Edelweiss, Aditya Birla, Reliance, etc., all under VSD Aditya Shaw).

### Root cause

Every BOPM-scoped page goes through `useDealAccess`. That hook only resolves "her deals" if her **`profiles.staffing_person_id`** is set — it then looks up her name in `staffing_people` and matches it against `principal_bopm / senior_bopm / bopm` columns on deals.

Database state today:

| User | `profiles.staffing_person_id` | `staffing_people` record | Deals tagged | Result |
|---|---|---|---|---|
| Ritu Priya | `P579` ✅ | `P579` Ritu Priya, Senior BOPM | ~12 (Neema's pod) | Working |
| **Ritu Shinde** | **`NULL` ❌** | `P518` Ritu Shinde, Group BOPM exists | **~25+ (Aditya's pod)** | **Empty everywhere** |

So Shinde's profile has no link to a staffing person → `useDealAccess` returns an empty `visibleDealIds` set → every BOPM-scoped page renders blank.

There is no application bug here — it's a missing data link. The fix is one row update.

## Fix

**1. Map Ritu Shinde's profile to staffing person `P518`**

```sql
UPDATE profiles
SET staffing_person_id = 'P518'
WHERE user_id = '3570ca23-63bc-4602-b8d3-777f9c45ea00';
```

After this she'll immediately see ~25 deals (all the ones where `principal_bopm = 'Ritu Shinde'`) across Clients, Staffing (People view + Matrix), MBR Tracker, and RGY Health.

**2. Surface this kind of mis-mapping in the admin Users tab**

Right now there's nothing in the UI that flags "this user is a BOPM but isn't mapped to a staffing person, so they'll see nothing." Add a small inline warning badge in `src/pages/admin/UsersTab.tsx` next to any non-admin user whose `staffing_person_id` is null:

> ⚠ Not mapped to a staffing person — this user will see no deals.

…with a quick-link to set the mapping. This prevents the same support cycle the next time a new BOPM is onboarded.

**3. Better empty state on BOPM-scoped pages**

Today when `visibleDealIds.size === 0` the pages just render an empty table, which looks like the app is broken. On Clients / Staffing / MBR / RGY, when the effective role is `user` and the visible-deals set is empty after `useDealAccess` finishes loading, render a single friendly card:

> No deals are tagged to you yet. If you expect to see deals here, ask an admin to map your profile in **Settings → Users & Roles**.

So future un-mapped BOPMs immediately know what to do instead of staring at a blank screen.

## Files touched

- DB: one `UPDATE` on `profiles` (via the insert tool — data change, no schema migration).
- `src/pages/admin/UsersTab.tsx` — unmapped-BOPM warning badge.
- `src/pages/Clients.tsx`, `src/pages/Staffing.tsx`, `src/pages/MBRTracker.tsx`, `src/pages/RGYHealth.tsx` — friendly empty state when the BOPM has zero visible deals.

No schema migrations and no changes to `useDealAccess` itself — the hook is working as designed; the data was just incomplete.

## What Ritu will see after the fix

- **Clients & Deals**: her ~25 deals (Tata AIG, Axis Bank, IIFL, Bajaj, ICICI, HSBC, Edelweiss, Aditya Birla, Reliance, etc.) — editable.
- **Staffing → People view + Matrix**: only people/allocations on those deals (Deal-view tab stays hidden for BOPM persona).
- **MBR Tracker**: table view of MBRs for those deals only.
- **RGY Health**: table view of RGY for those deals only.
- **Home / Dashboard**: still hidden for BOPM by default per existing route_visibility rules — no change.