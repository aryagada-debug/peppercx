
-- 1. Create clients table
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  website text NOT NULL DEFAULT '',
  sales_poc text NOT NULL DEFAULT '',
  industry text NOT NULL DEFAULT '',
  pc_code text NOT NULL DEFAULT '',
  account_status text NOT NULL DEFAULT 'Active',
  signing_entity text NOT NULL DEFAULT '',
  geography text NOT NULL DEFAULT '',
  daily_poc_name text NOT NULL DEFAULT '',
  daily_poc_phone text NOT NULL DEFAULT '',
  daily_poc_linkedin text NOT NULL DEFAULT '',
  hom_poc_name text NOT NULL DEFAULT '',
  hom_poc_phone text NOT NULL DEFAULT '',
  hom_poc_linkedin text NOT NULL DEFAULT '',
  lead_source text NOT NULL DEFAULT '',
  competitor_involved text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  billing_address text NOT NULL DEFAULT '',
  gst_number text NOT NULL DEFAULT '',
  contract_signed_date date,
  nda_signed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Anyone can insert clients" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update clients" ON public.clients FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete clients" ON public.clients FOR DELETE USING (true);

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Create deal_tasks table
CREATE TABLE public.deal_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  stage text NOT NULL DEFAULT 'To Do',
  assignee text NOT NULL DEFAULT '',
  start_date date,
  end_date date,
  urgency text NOT NULL DEFAULT 'Medium',
  logged_hours numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read deal_tasks" ON public.deal_tasks FOR SELECT USING (true);
CREATE POLICY "Anyone can insert deal_tasks" ON public.deal_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update deal_tasks" ON public.deal_tasks FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete deal_tasks" ON public.deal_tasks FOR DELETE USING (true);

CREATE TRIGGER update_deal_tasks_updated_at BEFORE UPDATE ON public.deal_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create deal_financials table
CREATE TABLE public.deal_financials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id text NOT NULL,
  month date NOT NULL,
  contracted numeric NOT NULL DEFAULT 0,
  consumption numeric NOT NULL DEFAULT 0,
  planned_gm_pct numeric NOT NULL DEFAULT 0,
  actual_gm_pct numeric NOT NULL DEFAULT 0,
  invoiced numeric NOT NULL DEFAULT 0,
  received numeric NOT NULL DEFAULT 0,
  outstanding numeric NOT NULL DEFAULT 0,
  invoice_date date,
  received_date date,
  outstanding_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_financials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read deal_financials" ON public.deal_financials FOR SELECT USING (true);
CREATE POLICY "Anyone can insert deal_financials" ON public.deal_financials FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update deal_financials" ON public.deal_financials FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete deal_financials" ON public.deal_financials FOR DELETE USING (true);

CREATE TRIGGER update_deal_financials_updated_at BEFORE UPDATE ON public.deal_financials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Alter staffing_deals — add new columns
ALTER TABLE public.staffing_deals
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS payment_terms text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pepper_business_unit text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS projected_outcomes jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS success_metrics jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS baseline_metrics text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);

-- 5. Alter deal_rgy_weekly — add health dimensions
ALTER TABLE public.deal_rgy_weekly
  ADD COLUMN IF NOT EXISTS account_health text NOT NULL DEFAULT 'G',
  ADD COLUMN IF NOT EXISTS finance_billing text NOT NULL DEFAULT 'G',
  ADD COLUMN IF NOT EXISTS capability_seo text NOT NULL DEFAULT 'G',
  ADD COLUMN IF NOT EXISTS capability_creative text NOT NULL DEFAULT 'G',
  ADD COLUMN IF NOT EXISTS plan_of_action text NOT NULL DEFAULT '';

-- 6. Alter staffing_people — add hourly_rate
ALTER TABLE public.staffing_people
  ADD COLUMN IF NOT EXISTS hourly_rate numeric NOT NULL DEFAULT 0;
