# Why nothing shows on Clients/Deals

For every deal the DB stores up to 3 sibling rows in `staffing_deals` keyed by the same numeric ID:

```
_100853         (legacy stub, blank)
d_100853        (status: "New Deal")        ← all 634 imported assignments live here
PC3889_100853   (status: "Active Deal", has client_id)   ← what Clients/Deals UI renders
```

Verified on deal 100853: `d_100853` now has `vsd=Aamir Khan, principal_bopm=Tushar Walia, senior_bopm=Ayushi Das`, but `PC3889_100853` (the one the app reads) has all BOPM/VSD columns blank. The `sync_bopm_fields_from_assignment` trigger only recomputes the row whose `id` matches `staffing_assignments.deal_id`, so the cache on the PC row never updates.

Scope: 634 assignments on 210 distinct numeric IDs; 129 of those have a matching `PC%_` sibling that's invisible in the UI today.

# Fix

Mirror each `d_{num}` assignment onto its `PC{code}_{num}` sibling (when one exists). The existing trigger then recomputes `vsd / principal_bopm / senior_bopm / bopm` on the PC row, and Clients/Deals/Staffing all start showing the right names with no code changes.

## Steps

1. **Audit query** — list every `(d_id, pc_id)` pair that shares a numeric suffix; report counts and any orphans (d_ with no PC sibling — those stay as-is since UI doesn't show them anyway).
2. **Insert mirrored rows** via one migration:
   ```sql
   INSERT INTO public.staffing_assignments
     (id, deal_id, person_id, role_key, allocation_pct, ...)
   SELECT
     'mirror_' || sa.id,
     pc.id,
     sa.person_id, sa.role_key, sa.allocation_pct, ...
   FROM public.staffing_assignments sa
   JOIN public.staffing_deals d   ON d.id  = sa.deal_id  AND d.id LIKE 'd\_%' ESCAPE '\'
   JOIN public.staffing_deals pc  ON pc.id LIKE 'PC%\_' || substring(sa.deal_id from 3) ESCAPE '\'
   ON CONFLICT (deal_id, person_id, role_key) DO NOTHING;
   ```
   (Exact ON CONFLICT target adjusted to whatever unique constraint exists; otherwise pre-filter with NOT EXISTS.)
3. **Trigger recompute** — the `AFTER INSERT` trigger fires per row and populates the PC deal's cached BOPM/VSD columns automatically. No app-side change required.
4. **Verify** on a sample (100853, plus 3–5 other PC deals) that `vsd / principal_bopm / senior_bopm / bopm` now match the sheet, and reload the Clients/Deals pages.

## Why not just point the import at PC_ rows and re-run?

Same outcome, but `d_` rows are also referenced elsewhere (Staffing module, BOPM filters that the previous fix added). Mirroring keeps both sibling rows consistent so every module — Clients, Deals, Staffing, dashboards — sees the same staffing without depending on which deal-ID variant a given query happens to hit.

## Non-goals

- No schema changes.
- No edits to import script or UI hooks.
- Orphan `d_` deals (no PC sibling) are left alone — they're not visible in Clients/Deals today, and changing that is a separate question.
