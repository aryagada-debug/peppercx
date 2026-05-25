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

  -- Note: we intentionally do NOT filter by end_date. Staffing assignments
  -- persist on a deal until explicitly removed in the app, even after the
  -- end_date passes. This prevents deals from appearing unassigned.
  SELECT COALESCE(string_agg(DISTINCT sp.name, ', ' ORDER BY sp.name), '')
    INTO v_names
    FROM public.staffing_assignments sa
    JOIN public.staffing_people sp ON sp.id = sa.person_id
   WHERE sa.deal_id = _deal_id
     AND public.normalize_staffing_role_key(sa.role_key) = v_role_key;

  IF v_role_key = 'principal_bopm' THEN
    UPDATE public.staffing_deals SET principal_bopm = v_names, updated_at = now() WHERE id = _deal_id;
  ELSIF v_role_key = 'senior_bopm' THEN
    UPDATE public.staffing_deals SET senior_bopm = v_names, updated_at = now() WHERE id = _deal_id;
  ELSIF v_role_key = 'bopm' THEN
    UPDATE public.staffing_deals SET bopm = v_names, updated_at = now() WHERE id = _deal_id;
  ELSIF v_role_key = 'vsd' THEN
    UPDATE public.staffing_deals SET vsd = v_names, updated_at = now() WHERE id = _deal_id;
  END IF;
END;
$function$;

-- Backfill: recompute all four role fields for every deal so any previously
-- stripped names come back immediately.
DO $$
DECLARE
  r record;
  role text;
BEGIN
  FOR r IN SELECT id FROM public.staffing_deals LOOP
    FOREACH role IN ARRAY ARRAY['principal_bopm','senior_bopm','bopm','vsd'] LOOP
      PERFORM public._recompute_deal_bopm_field(r.id, role);
    END LOOP;
  END LOOP;
END $$;