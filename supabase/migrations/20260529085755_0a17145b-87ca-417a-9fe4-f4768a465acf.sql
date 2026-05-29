DROP FUNCTION IF EXISTS public.normalize_staffing_role_key(text) CASCADE;

CREATE OR REPLACE FUNCTION public.normalize_staffing_role_key(_role_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE lower(trim(coalesce(_role_key, '')))
    WHEN 'vsd' THEN 'vsd'
    WHEN 'rt_vsd' THEN 'vsd'
    WHEN 'principal bopm' THEN 'principal_bopm'
    WHEN 'principal_bopm' THEN 'principal_bopm'
    WHEN 'rt_group_bopm' THEN 'principal_bopm'
    WHEN 'group bopm' THEN 'principal_bopm'
    WHEN 'senior bopm' THEN 'senior_bopm'
    WHEN 'sr bopm' THEN 'senior_bopm'
    WHEN 'senior_bopm' THEN 'senior_bopm'
    WHEN 'rt_senior_bopm' THEN 'senior_bopm'
    WHEN 'bopm' THEN 'bopm'
    WHEN 'rt_bopm' THEN 'bopm'
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
$function$;

-- Re-create the recompute function (was dropped by CASCADE).
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
   WHERE sa.deal_id = _deal_id
     AND public.normalize_staffing_role_key(sa.role_key) = v_role_key;

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

-- Re-create the trigger function (was dropped by CASCADE).
CREATE OR REPLACE FUNCTION public.sync_bopm_fields_from_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_role text;
  v_old_role text;
  v_bopm_keys text[] := ARRAY['principal_bopm','senior_bopm','bopm','vsd'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old_role := public.normalize_staffing_role_key(OLD.role_key);
    IF v_old_role = ANY(v_bopm_keys) THEN
      PERFORM public._recompute_deal_bopm_field(OLD.deal_id, v_old_role);
    END IF;
    RETURN OLD;
  END IF;

  v_new_role := public.normalize_staffing_role_key(NEW.role_key);

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

-- Re-attach trigger if dropped.
DROP TRIGGER IF EXISTS trg_sync_bopm_fields_from_assignment ON public.staffing_assignments;
CREATE TRIGGER trg_sync_bopm_fields_from_assignment
  AFTER INSERT OR UPDATE OR DELETE ON public.staffing_assignments
  FOR EACH ROW EXECUTE FUNCTION public.sync_bopm_fields_from_assignment();

-- Dedupe rows that would collide after canonicalisation.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY deal_id, person_id, public.normalize_staffing_role_key(role_key)
           ORDER BY allocation_pct DESC NULLS LAST, updated_at DESC NULLS LAST, id
         ) AS rn
    FROM public.staffing_assignments
)
DELETE FROM public.staffing_assignments sa
 USING ranked r
 WHERE sa.id = r.id AND r.rn > 1;

-- Canonicalise remaining rows.
UPDATE public.staffing_assignments
   SET role_key = public.normalize_staffing_role_key(role_key)
 WHERE role_key IS DISTINCT FROM public.normalize_staffing_role_key(role_key);

-- Recompute deal-level leadership columns.
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