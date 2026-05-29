-- Drop duplicate staffing rows that would collide after canonicalising role keys.
-- Keep the row with the highest allocation_pct (ties → most recently updated).
WITH ranked AS (
  SELECT id,
         deal_id,
         person_id,
         public.normalize_staffing_role_key(role_key) AS norm_role_key,
         ROW_NUMBER() OVER (
           PARTITION BY deal_id, person_id, public.normalize_staffing_role_key(role_key)
           ORDER BY allocation_pct DESC NULLS LAST, updated_at DESC NULLS LAST, id
         ) AS rn
    FROM public.staffing_assignments
)
DELETE FROM public.staffing_assignments sa
 USING ranked r
 WHERE sa.id = r.id
   AND r.rn > 1;

-- Now canonicalise the remaining rows.
UPDATE public.staffing_assignments
   SET role_key = public.normalize_staffing_role_key(role_key)
 WHERE role_key IS DISTINCT FROM public.normalize_staffing_role_key(role_key);

-- Recompute deal-level leadership columns from current assignments.
DO $$
DECLARE
  d record;
  r text;
BEGIN
  FOR d IN SELECT id FROM public.staffing_deals LOOP
    FOREACH r IN ARRAY ARRAY['vsd','principal_bopm','senior_bopm','bopm'] LOOP
      PERFORM public._recompute_deal_bopm_field(d.id, r);
    END LOOP;
  END LOOP;
END $$;