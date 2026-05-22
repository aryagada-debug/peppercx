WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY deal_id, role_key, person_id
           ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.staffing_assignments
  WHERE deal_id IS NOT NULL AND role_key IS NOT NULL AND person_id IS NOT NULL
)
DELETE FROM public.staffing_assignments sa
USING ranked
WHERE sa.id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS staffing_assignments_unique_triplet
  ON public.staffing_assignments (deal_id, role_key, person_id)
  WHERE deal_id IS NOT NULL AND role_key IS NOT NULL AND person_id IS NOT NULL;