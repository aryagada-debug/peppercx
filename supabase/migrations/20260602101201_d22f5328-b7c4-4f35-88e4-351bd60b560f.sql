
DROP VIEW IF EXISTS public.deals_unified;

ALTER TABLE public.staffing_deals DROP COLUMN IF EXISTS deal_id;

ALTER TABLE public.staffing_assignments RENAME COLUMN deal_id TO staffing_deal_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'staffing_assignments_staffing_deal_id_fkey'
  ) THEN
    ALTER TABLE public.staffing_assignments
      ADD CONSTRAINT staffing_assignments_staffing_deal_id_fkey
      FOREIGN KEY (staffing_deal_id)
      REFERENCES public.staffing_deals(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.deals_unified AS
SELECT d.id,
    d.pc_code,
    d.deal_name,
    d.account,
    d.business_unit,
    d.capability_line,
    d.deal_type,
    d.deal_status,
    d.staffing_status,
    d.validation,
    d.deal_status_cx,
    d.vsd,
    d.principal_bopm,
    d.senior_bopm,
    d.bopm,
    d.customer_status,
    d.customer_type,
    d.service_line_tagging,
    d.seo_staffing,
    d.creative_staffing,
    d.mrr,
    d.duration,
    d.retainer_deal_value,
    d.non_retainer_deal_value,
    d.total_deal_value,
    d.deal_value_lost,
    d.net_deal_value,
    d.rag,
    d.pod,
    d.start_date,
    d.end_date,
    d.payment_terms,
    d.pepper_business_unit,
    d.pepper_bu_l2,
    d.projected_outcomes,
    d.success_metrics,
    d.baseline_metrics,
    d.client_id,
    d.slack_channel_id,
    d.new_deal_id_formulated,
    d.new_deal_id_temp,
    d.validation_central_cx,
    d.month_closed_won,
    d.deal_target_status,
    d.total_mis_recognition,
    d.total_pending_recognition,
    d.consumption_value,
    d.mis_vs_consumption,
    d.invoiced_deal_value,
    d.undelivered_funnel,
    d.tcv_usd,
    d.strategy_bandwidth_required,
    d.created_at,
    d.updated_at,
    c.name AS client_name,
    c.industry AS client_industry,
    c.geography AS client_geography,
    c.sales_poc AS client_sales_poc,
    c.account_status AS client_account_status,
    c.signing_entity AS client_signing_entity,
    c.website AS client_website,
    c.pc_code AS client_pc_code,
    COALESCE(sa.assigned_headcount, 0::bigint) AS assigned_headcount,
    COALESCE(sa.total_allocation_pct, 0::numeric) AS total_allocation_pct,
    fin.consumption AS latest_consumption,
    fin.invoiced AS latest_invoiced,
    fin.received AS latest_received,
    fin.outstanding AS latest_outstanding,
    fin.month AS latest_financial_month
   FROM public.staffing_deals d
     LEFT JOIN public.clients c ON c.id = d.client_id
     LEFT JOIN LATERAL ( SELECT count(DISTINCT sa1.person_id) AS assigned_headcount,
            sum(sa1.allocation_pct) AS total_allocation_pct
           FROM public.staffing_assignments sa1
          WHERE sa1.staffing_deal_id = d.id) sa ON true
     LEFT JOIN LATERAL ( SELECT df.consumption,
            df.invoiced,
            df.received,
            df.outstanding,
            df.month
           FROM public.deal_financials df
          WHERE df.deal_id = d.id
          ORDER BY df.month DESC NULLS LAST
         LIMIT 1) fin ON true;

GRANT SELECT ON public.deals_unified TO authenticated;
GRANT ALL ON public.deals_unified TO service_role;

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
      PERFORM public._recompute_deal_bopm_field(OLD.staffing_deal_id, v_old_role);
    END IF;
    RETURN OLD;
  END IF;

  v_new_role := public.normalize_staffing_role_key(NEW.role_key);

  IF v_new_role = ANY(v_bopm_keys) THEN
    PERFORM public._recompute_deal_bopm_field(NEW.staffing_deal_id, v_new_role);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old_role := public.normalize_staffing_role_key(OLD.role_key);
    IF (OLD.staffing_deal_id IS DISTINCT FROM NEW.staffing_deal_id OR v_old_role IS DISTINCT FROM v_new_role)
       AND v_old_role = ANY(v_bopm_keys) THEN
      PERFORM public._recompute_deal_bopm_field(OLD.staffing_deal_id, v_old_role);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_staffing_on_inactive_deal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new_status text := trim(coalesce(NEW.deal_status, ''));
  v_old_status text := trim(coalesce(OLD.deal_status, ''));
BEGIN
  IF v_new_status = '' THEN
    RETURN NEW;
  END IF;
  IF v_new_status = v_old_status THEN
    RETURN NEW;
  END IF;
  IF public._is_active_staffing_status(v_new_status) THEN
    RETURN NEW;
  END IF;

  DELETE FROM public.staffing_assignments
   WHERE staffing_deal_id = NEW.id;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.visible_deal_ids_for_user(_user_id uuid)
 RETURNS TABLE(deal_id text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        WHERE sa.staffing_deal_id = d.id
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

  RETURN QUERY
    SELECT DISTINCT d.id FROM public.staffing_deals d
    WHERE EXISTS (
      SELECT 1 FROM public.staffing_assignments sa
      WHERE sa.staffing_deal_id = d.id AND sa.person_id = v_person_id
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
$function$;
