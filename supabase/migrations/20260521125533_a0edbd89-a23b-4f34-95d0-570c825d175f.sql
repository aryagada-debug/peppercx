-- Extend assignment->deal sync to include VSD role in addition to BOPM roles
CREATE OR REPLACE FUNCTION public._recompute_deal_bopm_field(_deal_id text, _role_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_names text;
BEGIN
  IF _role_key NOT IN ('principal_bopm','senior_bopm','bopm','vsd') THEN
    RETURN;
  END IF;
  SELECT COALESCE(string_agg(sp.name, ', ' ORDER BY sp.name), '')
    INTO v_names
    FROM public.staffing_assignments sa
    JOIN public.staffing_people sp ON sp.id = sa.person_id
   WHERE sa.deal_id = _deal_id
     AND sa.role_key = _role_key
     AND (sa.end_date IS NULL OR sa.end_date >= CURRENT_DATE);
  IF _role_key = 'principal_bopm' THEN
    UPDATE public.staffing_deals SET principal_bopm = v_names, updated_at = now() WHERE id = _deal_id;
  ELSIF _role_key = 'senior_bopm' THEN
    UPDATE public.staffing_deals SET senior_bopm = v_names, updated_at = now() WHERE id = _deal_id;
  ELSIF _role_key = 'bopm' THEN
    UPDATE public.staffing_deals SET bopm = v_names, updated_at = now() WHERE id = _deal_id;
  ELSIF _role_key = 'vsd' THEN
    UPDATE public.staffing_deals SET vsd = v_names, updated_at = now() WHERE id = _deal_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_bopm_fields_from_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role_key IN ('principal_bopm','senior_bopm','bopm','vsd') THEN
      PERFORM public._recompute_deal_bopm_field(OLD.deal_id, OLD.role_key);
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.role_key IN ('principal_bopm','senior_bopm','bopm','vsd') THEN
    PERFORM public._recompute_deal_bopm_field(NEW.deal_id, NEW.role_key);
  END IF;

  IF TG_OP = 'UPDATE'
     AND (OLD.deal_id <> NEW.deal_id OR OLD.role_key <> NEW.role_key)
     AND OLD.role_key IN ('principal_bopm','senior_bopm','bopm','vsd') THEN
    PERFORM public._recompute_deal_bopm_field(OLD.deal_id, OLD.role_key);
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists (idempotent)
DROP TRIGGER IF EXISTS trg_sync_bopm_fields_from_assignment ON public.staffing_assignments;
CREATE TRIGGER trg_sync_bopm_fields_from_assignment
AFTER INSERT OR UPDATE OR DELETE ON public.staffing_assignments
FOR EACH ROW EXECUTE FUNCTION public.sync_bopm_fields_from_assignment();

-- One-time backfill for VSD: only overwrite deals that have at least one active VSD assignment
WITH agg AS (
  SELECT sa.deal_id,
         string_agg(sp.name, ', ' ORDER BY sp.name) AS names
    FROM public.staffing_assignments sa
    JOIN public.staffing_people sp ON sp.id = sa.person_id
   WHERE sa.role_key = 'vsd'
     AND (sa.end_date IS NULL OR sa.end_date >= CURRENT_DATE)
   GROUP BY sa.deal_id
)
UPDATE public.staffing_deals d
   SET vsd = agg.names,
       updated_at = now()
  FROM agg
 WHERE d.id = agg.deal_id
   AND COALESCE(d.vsd, '') IS DISTINCT FROM agg.names;