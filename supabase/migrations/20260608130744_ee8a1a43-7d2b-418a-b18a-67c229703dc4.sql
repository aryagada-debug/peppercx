-- Remove the destructive trigger that recomputes deal.vsd / principal_bopm /
-- senior_bopm / bopm from staffing_assignments. These four fields are managed
-- as free-text columns on staffing_deals (set via the deal form). Because no
-- rows are ever inserted into staffing_assignments with role_key in
-- ('vsd','principal_bopm','senior_bopm','bopm'), every assignment change was
-- recomputing those columns to an empty string, silently wiping user data.

DROP TRIGGER IF EXISTS sync_bopm_fields_from_assignment ON public.staffing_assignments;

-- Keep the helper function around in case we want to re-enable a safer
-- version later, but mark it so it never wipes a non-empty value.
CREATE OR REPLACE FUNCTION public._recompute_deal_bopm_field(_deal_id text, _role_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role_key text := public.normalize_staffing_role_key(_role_key);
  v_names text;
BEGIN
  IF v_role_key NOT IN ('principal_bopm','senior_bopm','bopm','vsd') THEN
    RETURN;
  END IF;

  SELECT COALESCE(string_agg(DISTINCT sp.name, ', ' ORDER BY sp.name), '')
    INTO v_names
    FROM public.staffing_assignments sa
    JOIN public.staffing_people sp ON sp.id = sa.person_id
   WHERE sa.staffing_deal_id = _deal_id
     AND public.normalize_staffing_role_key(sa.role_key) = v_role_key;

  -- SAFETY: never overwrite an existing value with an empty string.
  IF v_names IS NULL OR v_names = '' THEN
    RETURN;
  END IF;

  IF v_role_key = 'vsd' THEN
    UPDATE public.staffing_deals SET vsd = v_names, updated_at = now() WHERE id = _deal_id;
  ELSIF v_role_key = 'principal_bopm' THEN
    UPDATE public.staffing_deals SET principal_bopm = v_names, updated_at = now() WHERE id = _deal_id;
  ELSIF v_role_key = 'senior_bopm' THEN
    UPDATE public.staffing_deals SET senior_bopm = v_names, updated_at = now() WHERE id = _deal_id;
  ELSIF v_role_key = 'bopm' THEN
    UPDATE public.staffing_deals SET bopm = v_names, updated_at = now() WHERE id = _deal_id;
  END IF;
END;
$function$;