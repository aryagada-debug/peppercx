-- Normalize legacy staffing role names so all views use one role vocabulary.
CREATE OR REPLACE FUNCTION public.normalize_staffing_role_key(_role_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(trim(coalesce(_role_key, '')))
    WHEN 'vsd' THEN 'vsd'
    WHEN 'principal bopm' THEN 'principal_bopm'
    WHEN 'principal_bopm' THEN 'principal_bopm'
    WHEN 'senior bopm' THEN 'senior_bopm'
    WHEN 'sr bopm' THEN 'senior_bopm'
    WHEN 'senior_bopm' THEN 'senior_bopm'
    WHEN 'bopm' THEN 'bopm'
    WHEN 'managing editor' THEN 'managing_editor'
    WHEN 'managing_editor' THEN 'managing_editor'
    WHEN 'content lead' THEN 'content_lead'
    WHEN 'content_lead' THEN 'content_lead'
    WHEN 'senior editor' THEN 'senior_editor'
    WHEN 'senior_editor' THEN 'senior_editor'
    WHEN 'seo leader' THEN 'seo_leader'
    WHEN 'seo_leader' THEN 'seo_leader'
    WHEN 'group head' THEN 'seo_group_head'
    WHEN 'seo group head' THEN 'seo_group_head'
    WHEN 'seo_group_head' THEN 'seo_group_head'
    WHEN 'sr. seo manager' THEN 'sr_seo_manager'
    WHEN 'senior seo manager' THEN 'sr_seo_manager'
    WHEN 'sr_seo_manager' THEN 'sr_seo_manager'
    WHEN 'seo manager' THEN 'seo_manager'
    WHEN 'seo_manager' THEN 'seo_manager'
    WHEN 'sr. seo analyst' THEN 'sr_seo_analyst'
    WHEN 'senior seo analyst' THEN 'sr_seo_analyst'
    WHEN 'sr_seo_analyst' THEN 'sr_seo_analyst'
    WHEN 'seo analyst' THEN 'seo_analyst'
    WHEN 'seo_analyst' THEN 'seo_analyst'
    ELSE lower(replace(trim(coalesce(_role_key, '')), ' ', '_'))
  END
$$;

UPDATE public.staffing_assignments
   SET role_key = public.normalize_staffing_role_key(role_key)
 WHERE role_key IS DISTINCT FROM public.normalize_staffing_role_key(role_key);

-- Recompute the overview team fields from active assignment rows.
CREATE OR REPLACE FUNCTION public._recompute_deal_bopm_field(_deal_id text, _role_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
   WHERE sa.deal_id = _deal_id
     AND public.normalize_staffing_role_key(sa.role_key) = v_role_key
     AND (sa.end_date IS NULL OR sa.end_date >= CURRENT_DATE);

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
$$;

CREATE OR REPLACE FUNCTION public.sync_bopm_fields_from_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_role text;
  v_old_role text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old_role := public.normalize_staffing_role_key(OLD.role_key);
    IF v_old_role IN ('principal_bopm','senior_bopm','bopm','vsd') THEN
      PERFORM public._recompute_deal_bopm_field(OLD.deal_id, v_old_role);
    END IF;
    RETURN OLD;
  END IF;

  v_new_role := public.normalize_staffing_role_key(NEW.role_key);
  NEW.role_key := v_new_role;

  IF v_new_role IN ('principal_bopm','senior_bopm','bopm','vsd') THEN
    PERFORM public._recompute_deal_bopm_field(NEW.deal_id, v_new_role);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old_role := public.normalize_staffing_role_key(OLD.role_key);
    IF (OLD.deal_id IS DISTINCT FROM NEW.deal_id OR v_old_role IS DISTINCT FROM v_new_role)
       AND v_old_role IN ('principal_bopm','senior_bopm','bopm','vsd') THEN
      PERFORM public._recompute_deal_bopm_field(OLD.deal_id, v_old_role);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_bopm_fields ON public.staffing_assignments;
DROP TRIGGER IF EXISTS trg_sync_bopm_fields_from_assignment ON public.staffing_assignments;
CREATE TRIGGER trg_sync_bopm_fields_from_assignment
AFTER INSERT OR UPDATE OR DELETE ON public.staffing_assignments
FOR EACH ROW EXECUTE FUNCTION public.sync_bopm_fields_from_assignment();

-- Backfill all affected overview fields from active assignments.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT deal_id, public.normalize_staffing_role_key(role_key) AS role_key
      FROM public.staffing_assignments
     WHERE public.normalize_staffing_role_key(role_key) IN ('principal_bopm','senior_bopm','bopm','vsd')
  LOOP
    PERFORM public._recompute_deal_bopm_field(r.deal_id, r.role_key);
  END LOOP;
END $$;

-- Make realtime delete payloads carry old row identifiers for reliable cache removal.
ALTER TABLE public.staffing_deals REPLICA IDENTITY FULL;
ALTER TABLE public.staffing_assignments REPLICA IDENTITY FULL;