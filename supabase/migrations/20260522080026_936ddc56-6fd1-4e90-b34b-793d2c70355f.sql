DROP TRIGGER IF EXISTS trg_sync_bopm_fields_from_assignment ON public.staffing_assignments;
DROP TRIGGER IF EXISTS trg_sync_bopm_fields ON public.staffing_assignments;

CREATE TRIGGER trg_sync_bopm_fields_from_assignment
AFTER INSERT OR UPDATE OR DELETE ON public.staffing_assignments
FOR EACH ROW EXECUTE FUNCTION public.sync_bopm_fields_from_assignment();

WITH role_names AS (
  SELECT
    sa.deal_id,
    public.normalize_staffing_role_key(sa.role_key) AS role_key,
    string_agg(DISTINCT sp.name, ', ' ORDER BY sp.name) AS names
  FROM public.staffing_assignments sa
  JOIN public.staffing_people sp ON sp.id = sa.person_id
  WHERE public.normalize_staffing_role_key(sa.role_key) IN ('vsd','principal_bopm','senior_bopm','bopm')
    AND (sa.end_date IS NULL OR sa.end_date >= CURRENT_DATE)
  GROUP BY sa.deal_id, public.normalize_staffing_role_key(sa.role_key)
), pivoted AS (
  SELECT
    deal_id,
    COALESCE(MAX(names) FILTER (WHERE role_key = 'vsd'), '') AS vsd,
    COALESCE(MAX(names) FILTER (WHERE role_key = 'principal_bopm'), '') AS principal_bopm,
    COALESCE(MAX(names) FILTER (WHERE role_key = 'senior_bopm'), '') AS senior_bopm,
    COALESCE(MAX(names) FILTER (WHERE role_key = 'bopm'), '') AS bopm
  FROM role_names
  GROUP BY deal_id
)
UPDATE public.staffing_deals d
SET
  vsd = p.vsd,
  principal_bopm = p.principal_bopm,
  senior_bopm = p.senior_bopm,
  bopm = p.bopm,
  updated_at = now()
FROM pivoted p
WHERE d.id = p.deal_id;

ALTER TABLE public.staffing_deals REPLICA IDENTITY FULL;
ALTER TABLE public.staffing_assignments REPLICA IDENTITY FULL;