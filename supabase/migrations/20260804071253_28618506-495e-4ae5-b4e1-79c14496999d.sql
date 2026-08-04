CREATE TABLE public.sync_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target text NOT NULL DEFAULT 'creator_compass',
  entity text NOT NULL,
  entity_id text NOT NULL,
  op text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_outbox_pending ON public.sync_outbox (status, created_at) WHERE status IN ('pending','failed');
CREATE INDEX idx_sync_outbox_entity ON public.sync_outbox (entity, entity_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_outbox TO authenticated;
GRANT ALL ON public.sync_outbox TO service_role;

ALTER TABLE public.sync_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync outbox" ON public.sync_outbox
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update sync outbox" ON public.sync_outbox
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert sync outbox" ON public.sync_outbox
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete sync outbox" ON public.sync_outbox
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_sync_outbox_updated_at
  BEFORE UPDATE ON public.sync_outbox
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Deal snapshot used for the outgoing payload
CREATE OR REPLACE FUNCTION public._sync_deal_payload(_d public.staffing_deals)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', _d.id,
    'account', _d.account,
    'deal_name', _d.deal_name,
    'deal_type', _d.deal_type,
    'deal_status', _d.deal_status,
    'business_unit', _d.business_unit,
    'capability_line', _d.capability_line,
    'pod', _d.pod,
    'geo', _d.geo,
    'vsd', _d.vsd,
    'principal_bopm', _d.principal_bopm,
    'senior_bopm', _d.senior_bopm,
    'bopm', _d.bopm,
    'mrr', _d.mrr,
    'duration', _d.duration,
    'total_deal_value', _d.total_deal_value,
    'input_currency', _d.input_currency,
    'start_date', _d.start_date,
    'end_date', _d.end_date,
    'client_id', _d.client_id
  )
$$;

CREATE OR REPLACE FUNCTION public.enqueue_deal_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.sync_outbox (entity, entity_id, op, payload)
    VALUES ('deal', OLD.id, 'delete', jsonb_build_object('id', OLD.id));
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
     AND public._sync_deal_payload(OLD) IS NOT DISTINCT FROM public._sync_deal_payload(NEW) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.sync_outbox (entity, entity_id, op, payload)
  VALUES ('deal', NEW.id, lower(TG_OP), public._sync_deal_payload(NEW));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_outbox_deals
  AFTER INSERT OR UPDATE OR DELETE ON public.staffing_deals
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_deal_sync();

CREATE OR REPLACE FUNCTION public.enqueue_assignment_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb;
  v_person_name text := '';
  v_person_email text := '';
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.sync_outbox (entity, entity_id, op, payload)
    VALUES ('assignment', OLD.id, 'delete', jsonb_build_object(
      'id', OLD.id,
      'deal_id', OLD.staffing_deal_id,
      'person_id', OLD.person_id,
      'role_key', public.normalize_staffing_role_key(OLD.role_key)
    ));
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.staffing_deal_id IS NOT DISTINCT FROM NEW.staffing_deal_id
     AND OLD.person_id IS NOT DISTINCT FROM NEW.person_id
     AND OLD.role_key IS NOT DISTINCT FROM NEW.role_key
     AND OLD.allocation_pct IS NOT DISTINCT FROM NEW.allocation_pct
     AND OLD.start_date IS NOT DISTINCT FROM NEW.start_date
     AND OLD.end_date IS NOT DISTINCT FROM NEW.end_date THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(sp.name,''), COALESCE(sp.email,'')
    INTO v_person_name, v_person_email
    FROM public.staffing_people sp WHERE sp.id = NEW.person_id;

  v_payload := jsonb_build_object(
    'id', NEW.id,
    'deal_id', NEW.staffing_deal_id,
    'person_id', NEW.person_id,
    'person_name', COALESCE(v_person_name,''),
    'person_email', COALESCE(v_person_email,''),
    'role_key', public.normalize_staffing_role_key(NEW.role_key),
    'allocation_pct', NEW.allocation_pct,
    'start_date', NEW.start_date,
    'end_date', NEW.end_date
  );

  INSERT INTO public.sync_outbox (entity, entity_id, op, payload)
  VALUES ('assignment', NEW.id, lower(TG_OP), v_payload);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_outbox_assignments
  AFTER INSERT OR UPDATE OR DELETE ON public.staffing_assignments
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_assignment_sync();