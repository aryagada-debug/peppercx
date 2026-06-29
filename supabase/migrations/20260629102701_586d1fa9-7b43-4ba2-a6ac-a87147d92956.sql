
-- 1) Table
CREATE TABLE public.deal_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Submitter / salesperson
  submitter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sp_name text NOT NULL DEFAULT '',
  sp_email text NOT NULL DEFAULT '',
  sp_team text NOT NULL DEFAULT '',
  handover_date date,
  -- Client block
  company_name text NOT NULL,
  industry text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  -- Documents
  sow_url text NOT NULL DEFAULT '',
  strategy_deck_url text NOT NULL DEFAULT '',
  keywords_url text NOT NULL DEFAULT '',
  geo_audit_url text NOT NULL DEFAULT '',
  fireflies_url text NOT NULL DEFAULT '',
  docs_notes text NOT NULL DEFAULT '',
  -- Deal block
  stage text NOT NULL DEFAULT '',
  bu text NOT NULL DEFAULT '',
  capability text NOT NULL DEFAULT '',
  deal_type text NOT NULL DEFAULT '',
  mrr numeric,
  total_amount numeric,
  duration_months integer,
  start_date date,
  vsd_suggested text NOT NULL DEFAULT '',
  deal_notes text NOT NULL DEFAULT '',
  -- Contacts (jsonb array of {name, role, email, phone})
  contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Completion (filled later)
  deal_id text,
  deal_name text,
  deal_id_filled_at timestamptz,
  deal_id_filled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  vsd_confirmed text,
  vsd_filled_at timestamptz,
  vsd_filled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'submitted',
  created_deal_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deal_handovers_status ON public.deal_handovers(status);
CREATE INDEX idx_deal_handovers_submitter ON public.deal_handovers(submitter_user_id);

-- 2) GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_handovers TO authenticated;
GRANT ALL ON public.deal_handovers TO service_role;

-- 3) RLS
ALTER TABLE public.deal_handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can read handovers"
  ON public.deal_handovers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Auth can insert handovers"
  ON public.deal_handovers FOR INSERT TO authenticated
  WITH CHECK (submitter_user_id = auth.uid() OR submitter_user_id IS NULL);

CREATE POLICY "Admin or leads can update handovers"
  ON public.deal_handovers FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR lower(coalesce(auth.jwt() ->> 'email','')) IN (
      'arya.gada@peppercontent.io',
      'anirudh@peppercontent.io',
      'priyanka.sharma@peppercontent.io'
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR lower(coalesce(auth.jwt() ->> 'email','')) IN (
      'arya.gada@peppercontent.io',
      'anirudh@peppercontent.io',
      'priyanka.sharma@peppercontent.io'
    )
  );

CREATE POLICY "Admin can delete handovers"
  ON public.deal_handovers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) updated_at trigger
CREATE TRIGGER update_deal_handovers_updated_at
  BEFORE UPDATE ON public.deal_handovers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Auto-create staffing_deals row when both steps complete
CREATE OR REPLACE FUNCTION public.handover_autocreate_deal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_stage text;
  v_existing text;
BEGIN
  -- Only act when both leads have filled their parts and status is not yet 'created'
  IF NEW.status = 'created' THEN
    RETURN NEW;
  END IF;
  IF NEW.deal_id IS NULL OR length(trim(NEW.deal_id)) = 0 THEN RETURN NEW; END IF;
  IF NEW.deal_name IS NULL OR length(trim(NEW.deal_name)) = 0 THEN RETURN NEW; END IF;
  IF NEW.vsd_confirmed IS NULL OR length(trim(NEW.vsd_confirmed)) = 0 THEN RETURN NEW; END IF;

  -- If a deal with this id already exists, just mark as created and exit.
  SELECT id INTO v_existing FROM public.staffing_deals WHERE id = NEW.deal_id;
  IF v_existing IS NOT NULL THEN
    NEW.status := 'created';
    NEW.created_deal_id := v_existing;
    RETURN NEW;
  END IF;

  -- Find or create the client
  SELECT id INTO v_client_id
    FROM public.clients
   WHERE lower(trim(name)) = lower(trim(NEW.company_name))
   LIMIT 1;
  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (name, website, industry)
    VALUES (NEW.company_name, coalesce(NEW.website,''), coalesce(NEW.industry,''))
    RETURNING id INTO v_client_id;
  END IF;

  v_stage := CASE
    WHEN length(trim(coalesce(NEW.stage,''))) = 0 THEN 'New Deal in SLA/PO'
    ELSE NEW.stage
  END;

  INSERT INTO public.staffing_deals (
    id, account, deal_name, vsd, client_id,
    deal_status, business_unit, capability_line, deal_type,
    mrr, total_deal_value, start_date, new_deal_id_formulated
  ) VALUES (
    NEW.deal_id,
    coalesce(NEW.company_name,''),
    NEW.deal_name,
    coalesce(NEW.vsd_confirmed,''),
    v_client_id,
    v_stage,
    coalesce(NEW.bu,''),
    coalesce(NEW.capability,''),
    coalesce(NULLIF(NEW.deal_type,''), 'Retainer'),
    NEW.mrr,
    NEW.total_amount,
    NEW.start_date,
    NEW.deal_id
  );

  NEW.status := 'created';
  NEW.created_deal_id := NEW.deal_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_handover_autocreate_deal
  BEFORE UPDATE ON public.deal_handovers
  FOR EACH ROW EXECUTE FUNCTION public.handover_autocreate_deal();
