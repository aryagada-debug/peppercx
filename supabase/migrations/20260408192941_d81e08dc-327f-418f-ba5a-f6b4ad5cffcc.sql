
-- Add pod column to staffing_deals
ALTER TABLE public.staffing_deals ADD COLUMN IF NOT EXISTS pod text NOT NULL DEFAULT '';

-- Deal SoW Items
CREATE TABLE public.deal_sow_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text NOT NULL,
  scope text NOT NULL DEFAULT '',
  revenue_share numeric NOT NULL DEFAULT 0,
  team_capability text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deal_sow_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read deal_sow_items" ON public.deal_sow_items FOR SELECT USING (true);
CREATE POLICY "Anyone can insert deal_sow_items" ON public.deal_sow_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update deal_sow_items" ON public.deal_sow_items FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete deal_sow_items" ON public.deal_sow_items FOR DELETE USING (true);

-- Deal Revenue Monthly
CREATE TABLE public.deal_revenue_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text NOT NULL,
  month date NOT NULL,
  mrr numeric NOT NULL DEFAULT 0,
  contraction numeric NOT NULL DEFAULT 0,
  delivered numeric NOT NULL DEFAULT 0,
  invoiced numeric NOT NULL DEFAULT 0,
  actuals numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deal_revenue_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read deal_revenue_monthly" ON public.deal_revenue_monthly FOR SELECT USING (true);
CREATE POLICY "Anyone can insert deal_revenue_monthly" ON public.deal_revenue_monthly FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update deal_revenue_monthly" ON public.deal_revenue_monthly FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete deal_revenue_monthly" ON public.deal_revenue_monthly FOR DELETE USING (true);

-- Deal Targets Monthly
CREATE TABLE public.deal_targets_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text NOT NULL,
  month date NOT NULL,
  contraction_target numeric NOT NULL DEFAULT 0,
  delivery_target numeric NOT NULL DEFAULT 0,
  invoicing_target numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deal_targets_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read deal_targets_monthly" ON public.deal_targets_monthly FOR SELECT USING (true);
CREATE POLICY "Anyone can insert deal_targets_monthly" ON public.deal_targets_monthly FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update deal_targets_monthly" ON public.deal_targets_monthly FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete deal_targets_monthly" ON public.deal_targets_monthly FOR DELETE USING (true);

-- Deal RGY Weekly
CREATE TABLE public.deal_rgy_weekly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text NOT NULL,
  week_start date NOT NULL,
  internal text NOT NULL DEFAULT 'G',
  customer text NOT NULL DEFAULT 'G',
  delivery text NOT NULL DEFAULT 'G',
  consumption text NOT NULL DEFAULT 'G',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deal_rgy_weekly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read deal_rgy_weekly" ON public.deal_rgy_weekly FOR SELECT USING (true);
CREATE POLICY "Anyone can insert deal_rgy_weekly" ON public.deal_rgy_weekly FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update deal_rgy_weekly" ON public.deal_rgy_weekly FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete deal_rgy_weekly" ON public.deal_rgy_weekly FOR DELETE USING (true);

-- Deal Onboarding Steps
CREATE TABLE public.deal_onboarding_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text NOT NULL,
  step_name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  owner text NOT NULL DEFAULT '',
  due_date date,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deal_onboarding_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read deal_onboarding_steps" ON public.deal_onboarding_steps FOR SELECT USING (true);
CREATE POLICY "Anyone can insert deal_onboarding_steps" ON public.deal_onboarding_steps FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update deal_onboarding_steps" ON public.deal_onboarding_steps FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete deal_onboarding_steps" ON public.deal_onboarding_steps FOR DELETE USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_deal_sow_items_updated_at BEFORE UPDATE ON public.deal_sow_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deal_revenue_monthly_updated_at BEFORE UPDATE ON public.deal_revenue_monthly FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deal_targets_monthly_updated_at BEFORE UPDATE ON public.deal_targets_monthly FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deal_onboarding_steps_updated_at BEFORE UPDATE ON public.deal_onboarding_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_deal_sow_items_deal ON public.deal_sow_items(deal_id);
CREATE INDEX idx_deal_revenue_monthly_deal ON public.deal_revenue_monthly(deal_id);
CREATE INDEX idx_deal_targets_monthly_deal ON public.deal_targets_monthly(deal_id);
CREATE INDEX idx_deal_rgy_weekly_deal ON public.deal_rgy_weekly(deal_id);
CREATE INDEX idx_deal_onboarding_steps_deal ON public.deal_onboarding_steps(deal_id);
