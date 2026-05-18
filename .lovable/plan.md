## Assign Capability Lead + Admin roles

### Capability Leads (role `capability_lead` + `is_lead=true` on existing membership)

Editorial:

- Gaurab Chatterjee (P028)
- Pratima K (P111)

SEO:

- Mayur Varade (P484)
- Vedanga Bandyopadhyay (P542)

Creative (Copy):

- Stefan Amanna (P568)

Creative (Design):

- Viraj Ghodgaonkar (P512) — has two profile rows, both will be granted
- Nikhil Somani (P394)
- Divya Ganapathy (P533)

All eight are already members of their respective `capability_groups`, so flipping `is_lead = true` plus inserting the `capability_lead` role is enough. The `useCapability` hook will then surface the Cap Lead view, and every other person in the same capability (Editorial 19, SEO 35, Creative 27) automatically becomes a Cap IC (capability_member) — no per-person inserts needed for that view.

### Admins (role `admin`)

- Priyanka Sharma (user f54…ea47)
- Sudhanshu Sikhwal (user bef3…5099)

### Technical steps

1. `INSERT … ON CONFLICT DO NOTHING` into `user_roles` for the 9 user_ids above with the right role (`capability_lead` / `admin`).
2. `UPDATE capability_memberships SET is_lead = true` for the 8 (person_id, capability_id) pairs.
3. No schema changes, no code changes.

### Confirm before I run

- "Gaurabh" → mapped to **Gaurab Chatterjee** (only match). OK? Yes
- "Divya Ganpati" → **Divya Ganapathy** (Creative). There is also a Divya Ranganathan — confirming we mean Ganapathy. Yes
- The four names listed before "copy - stefan" (Gaurabh, Pratima, Mayur, Vedang) are split across **Editorial** (Gaurab, Pratima) and **SEO** (Mayur, Vedanga) based on their existing capability memberships — confirming that mapping is what you want. Yes