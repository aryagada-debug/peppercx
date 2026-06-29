-- Ensure handover-created deals land in an Active status so they appear in Clients & Deals and Staffing.
CREATE OR REPLACE FUNCTION public.handover_autocreate_deal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id uuid;
  v_stage text;
  v_existing text;
  v_active_set text[] := ARRAY['Active Deal','New Deal in SLA/PO','Deal Disputed','Deal in Renewal Process'];
BEGIN
  IF NEW.status = 'created' THEN RETURN NEW; END IF;
  IF NEW.deal_id IS NULL OR length(trim(NEW.deal_id)) = 0 THEN RETURN NEW; END IF;
  IF NEW.deal_name IS NULL OR length(trim(NEW.deal_name)) = 0 THEN RETURN NEW; END IF;
  IF NEW.vsd_confirmed IS NULL OR length(trim(NEW.vsd_confirmed)) = 0 THEN RETURN NEW; END IF;

  SELECT id INTO v_existing FROM public.staffing_deals WHERE id = NEW.deal_id;
  IF v_existing IS NOT NULL THEN
    NEW.status := 'created';
    NEW.created_deal_id := v_existing;
    RETURN NEW;
  END IF;

  SELECT id INTO v_client_id FROM public.clients WHERE lower(trim(name)) = lower(trim(NEW.company_name)) LIMIT 1;
  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (name, website, industry)
    VALUES (NEW.company_name, coalesce(NEW.website,''), coalesce(NEW.industry,''))
    RETURNING id INTO v_client_id;
  END IF;

  -- Snap any non-active or blank stage to 'New Deal in SLA/PO' so the deal is visible everywhere.
  IF NEW.stage IS NULL OR length(trim(NEW.stage)) = 0 OR NOT (NEW.stage = ANY(v_active_set)) THEN
    v_stage := 'New Deal in SLA/PO';
  ELSE
    v_stage := NEW.stage;
  END IF;

  INSERT INTO public.staffing_deals (
    id, account, deal_name, vsd, client_id,
    deal_status, deal_status_cx, business_unit, capability_line, deal_type,
    mrr, total_deal_value, start_date, new_deal_id_formulated
  ) VALUES (
    NEW.deal_id,
    coalesce(NEW.company_name,''),
    NEW.deal_name,
    coalesce(NEW.vsd_confirmed,''),
    v_client_id,
    v_stage, v_stage,
    coalesce(NEW.bu,''),
    coalesce(NEW.capability,''),
    coalesce(NULLIF(NEW.deal_type,''), 'Retainer'),
    NEW.mrr, NEW.total_amount, NEW.start_date, NEW.deal_id
  );

  NEW.status := 'created';
  NEW.created_deal_id := NEW.deal_id;
  RETURN NEW;
END;
$function$;

-- Fix the already-created handover deal so it shows up.
UPDATE public.staffing_deals
   SET deal_status = 'New Deal in SLA/PO',
       deal_status_cx = 'New Deal in SLA/PO',
       updated_at = now()
 WHERE id IN (SELECT created_deal_id FROM public.deal_handovers WHERE created_deal_id IS NOT NULL)
   AND deal_status NOT IN ('Active Deal','New Deal in SLA/PO','Deal Disputed','Deal in Renewal Process');