
-- 1. Add normalized manager link
ALTER TABLE public.staffing_people 
  ADD COLUMN IF NOT EXISTS manager_person_id text REFERENCES public.staffing_people(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_staffing_people_manager_person_id ON public.staffing_people(manager_person_id);
CREATE INDEX IF NOT EXISTS idx_staffing_people_email_lower ON public.staffing_people(lower(email));
CREATE INDEX IF NOT EXISTS idx_staffing_assignments_person_id ON public.staffing_assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_staffing_assignments_deal_id ON public.staffing_assignments(deal_id);

-- 2. Backfill manager_person_id from reporting_manager text (best-effort by normalized name)
WITH name_map AS (
  SELECT id, lower(regexp_replace(trim(coalesce(name,'')), '\s+', ' ', 'g')) AS norm_name
  FROM public.staffing_people
  WHERE name IS NOT NULL AND trim(name) <> ''
)
UPDATE public.staffing_people sp
   SET manager_person_id = nm.id
  FROM name_map nm
 WHERE nm.norm_name = lower(regexp_replace(trim(coalesce(sp.reporting_manager,'')), '\s+', ' ', 'g'))
   AND sp.reporting_manager IS NOT NULL
   AND trim(sp.reporting_manager) <> ''
   AND (sp.manager_person_id IS NULL OR sp.manager_person_id <> nm.id);

-- 3. Helper: normalize a name (lower, trim, collapse spaces)
CREATE OR REPLACE FUNCTION public._norm_name(_n text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT lower(regexp_replace(trim(coalesce(_n,'')), '\s+', ' ', 'g'))
$$;

-- 4. Resolve current user → staffing person, with email/display_name fallback
CREATE OR REPLACE FUNCTION public.resolve_current_person(_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH p AS (SELECT staffing_person_id, display_name FROM public.profiles WHERE user_id = _user_id LIMIT 1),
       u AS (SELECT email FROM auth.users WHERE id = _user_id LIMIT 1)
  SELECT id FROM (
    SELECT sp.id, 1 AS pri FROM public.staffing_people sp
      JOIN p ON p.staffing_person_id = sp.id
      WHERE COALESCE(sp.leaving,false)=false AND COALESCE(sp.tbh,false)=false
    UNION ALL
    SELECT sp.id, 2 FROM public.staffing_people sp, u
      WHERE lower(sp.email) = lower(u.email)
        AND u.email IS NOT NULL AND u.email <> ''
        AND COALESCE(sp.leaving,false)=false AND COALESCE(sp.tbh,false)=false
    UNION ALL
    SELECT sp.id, 3 FROM public.staffing_people sp, p
      WHERE public._norm_name(sp.name) = public._norm_name(p.display_name)
        AND p.display_name IS NOT NULL AND trim(p.display_name) <> ''
        AND COALESCE(sp.leaving,false)=false AND COALESCE(sp.tbh,false)=false
  ) candidates
  ORDER BY pri LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.resolve_current_person(uuid) TO authenticated;

-- 5. Subtree of a person via manager_person_id
CREATE OR REPLACE FUNCTION public.person_subtree(_root_id text)
RETURNS TABLE(person_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH RECURSIVE tree AS (
    SELECT id FROM public.staffing_people WHERE id = _root_id
    UNION
    SELECT sp.id
      FROM public.staffing_people sp
      JOIN tree t ON sp.manager_person_id = t.id
  )
  SELECT id FROM tree
$$;

GRANT EXECUTE ON FUNCTION public.person_subtree(text) TO authenticated;

-- 6. Main visibility function
CREATE OR REPLACE FUNCTION public.visible_deal_ids_for_user(_user_id uuid)
RETURNS TABLE(deal_id text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_person_id text;
  v_role_title text := '';
  v_role_category text := '';
  v_designation text := '';
  v_person_name text := '';
  v_is_admin boolean;
  v_is_vsd boolean := false;
  v_is_cap_lead boolean := false;
  v_role_text text;
BEGIN
  v_is_admin := public.has_role(_user_id, 'admin'::app_role);
  IF v_is_admin THEN
    RETURN QUERY SELECT id FROM public.staffing_deals;
    RETURN;
  END IF;

  v_person_id := public.resolve_current_person(_user_id);
  IF v_person_id IS NULL THEN
    RETURN;
  END IF;

  SELECT name, COALESCE(role_title,''), COALESCE(role_category,''), COALESCE(designation,'')
    INTO v_person_name, v_role_title, v_role_category, v_designation
    FROM public.staffing_people WHERE id = v_person_id;

  v_role_text := lower(concat_ws(' ', v_role_title, v_role_category, v_designation));
  v_is_vsd := v_role_text ~ '\yvsd\y' OR v_role_text ~ 'vertical service delivery' OR v_role_text ~ 'service delivery (leader|director)';
  v_is_cap_lead := v_role_text ~ 'capability lead' OR v_role_text ~ 'capability leader' OR v_role_text ~ 'group head' OR v_role_text ~ 'managing editor' OR v_role_text ~ 'seo leader';

  -- Also treat as VSD if anyone reports to them whose role looks like P/Sr BOPM
  IF NOT v_is_vsd THEN
    IF EXISTS (
      SELECT 1 FROM public.person_subtree(v_person_id) ps
      JOIN public.staffing_people sp ON sp.id = ps.person_id
      WHERE sp.id <> v_person_id
        AND lower(concat_ws(' ', sp.role_title, sp.designation)) ~ '(principal|senior|sr\.?)\s+bopm'
    ) THEN
      v_is_vsd := true;
    END IF;
  END IF;

  IF v_is_vsd OR v_is_cap_lead THEN
    -- Own + subtree assignment deals + deals whose text cells reference any subtree member's name
    RETURN QUERY
      WITH sub AS (SELECT person_id FROM public.person_subtree(v_person_id)),
           names AS (
             SELECT public._norm_name(sp.name) AS n
             FROM public.staffing_people sp JOIN sub s ON s.person_id = sp.id
             WHERE sp.name IS NOT NULL AND trim(sp.name) <> ''
           )
      SELECT DISTINCT d.id FROM public.staffing_deals d
      WHERE EXISTS (
        SELECT 1 FROM public.staffing_assignments sa JOIN sub s ON s.person_id = sa.person_id
        WHERE sa.deal_id = d.id
      )
      OR EXISTS (
        SELECT 1 FROM names n
        WHERE position(n.n IN public._norm_name(d.vsd)) > 0
           OR position(n.n IN public._norm_name(d.principal_bopm)) > 0
           OR position(n.n IN public._norm_name(d.senior_bopm)) > 0
           OR position(n.n IN public._norm_name(d.bopm)) > 0
      );
    RETURN;
  END IF;

  -- Default: only deals where this person is assigned, or named in a BOPM/VSD text cell
  RETURN QUERY
    SELECT DISTINCT d.id FROM public.staffing_deals d
    WHERE EXISTS (
      SELECT 1 FROM public.staffing_assignments sa
      WHERE sa.deal_id = d.id AND sa.person_id = v_person_id
    )
    OR (
      v_person_name IS NOT NULL AND v_person_name <> ''
      AND (
        position(public._norm_name(v_person_name) IN public._norm_name(d.vsd)) > 0
        OR position(public._norm_name(v_person_name) IN public._norm_name(d.principal_bopm)) > 0
        OR position(public._norm_name(v_person_name) IN public._norm_name(d.senior_bopm)) > 0
        OR position(public._norm_name(v_person_name) IN public._norm_name(d.bopm)) > 0
      )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.visible_deal_ids_for_user(uuid) TO authenticated;
