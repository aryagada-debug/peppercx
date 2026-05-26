
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
  IF v_role_key NOT IN (
    'principal_bopm','senior_bopm','bopm','vsd',
    'rt_vsd','rt_group_bopm','rt_senior_bopm','rt_bopm'
  ) THEN
    RETURN;
  END IF;

  SELECT COALESCE(string_agg(DISTINCT sp.name, ', ' ORDER BY sp.name), '')
    INTO v_names
    FROM public.staffing_assignments sa
    JOIN public.staffing_people sp ON sp.id = sa.person_id
   WHERE sa.deal_id = _deal_id
     AND public.normalize_staffing_role_key(sa.role_key) = v_role_key;

  IF v_role_key IN ('vsd','rt_vsd') THEN
    UPDATE public.staffing_deals SET vsd = v_names, updated_at = now() WHERE id = _deal_id;
  ELSIF v_role_key IN ('principal_bopm','rt_group_bopm') THEN
    UPDATE public.staffing_deals SET principal_bopm = v_names, updated_at = now() WHERE id = _deal_id;
  ELSIF v_role_key IN ('senior_bopm','rt_senior_bopm') THEN
    UPDATE public.staffing_deals SET senior_bopm = v_names, updated_at = now() WHERE id = _deal_id;
  ELSIF v_role_key IN ('bopm','rt_bopm') THEN
    UPDATE public.staffing_deals SET bopm = v_names, updated_at = now() WHERE id = _deal_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_bopm_fields_from_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new_role text;
  v_old_role text;
  v_bopm_keys text[] := ARRAY['principal_bopm','senior_bopm','bopm','vsd','rt_vsd','rt_group_bopm','rt_senior_bopm','rt_bopm'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old_role := public.normalize_staffing_role_key(OLD.role_key);
    IF v_old_role = ANY(v_bopm_keys) THEN
      PERFORM public._recompute_deal_bopm_field(OLD.deal_id, v_old_role);
    END IF;
    RETURN OLD;
  END IF;

  v_new_role := public.normalize_staffing_role_key(NEW.role_key);
  NEW.role_key := v_new_role;

  IF v_new_role = ANY(v_bopm_keys) THEN
    PERFORM public._recompute_deal_bopm_field(NEW.deal_id, v_new_role);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old_role := public.normalize_staffing_role_key(OLD.role_key);
    IF (OLD.deal_id IS DISTINCT FROM NEW.deal_id OR v_old_role IS DISTINCT FROM v_new_role)
       AND v_old_role = ANY(v_bopm_keys) THEN
      PERFORM public._recompute_deal_bopm_field(OLD.deal_id, v_old_role);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
