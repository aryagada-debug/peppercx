
-- Create timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- PEOPLE
CREATE TABLE public.staffing_people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role_category TEXT NOT NULL,
  role_title TEXT NOT NULL DEFAULT '',
  pod TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT 'India',
  leaving BOOLEAN NOT NULL DEFAULT false,
  tbh BOOLEAN NOT NULL DEFAULT false,
  department TEXT DEFAULT '',
  designation TEXT DEFAULT '',
  reporting_manager TEXT DEFAULT '',
  band TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.staffing_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read staffing_people" ON public.staffing_people FOR SELECT USING (true);
CREATE POLICY "Anyone can insert staffing_people" ON public.staffing_people FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update staffing_people" ON public.staffing_people FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete staffing_people" ON public.staffing_people FOR DELETE USING (true);
CREATE TRIGGER update_staffing_people_updated_at BEFORE UPDATE ON public.staffing_people FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- DEALS
CREATE TABLE public.staffing_deals (
  id TEXT PRIMARY KEY,
  pc_code TEXT NOT NULL DEFAULT '',
  deal_id TEXT NOT NULL DEFAULT '',
  business_unit TEXT NOT NULL DEFAULT '',
  capability_line TEXT NOT NULL DEFAULT '',
  account TEXT NOT NULL DEFAULT '',
  deal_name TEXT NOT NULL DEFAULT '',
  deal_type TEXT NOT NULL DEFAULT 'Retainer',
  deal_status TEXT NOT NULL DEFAULT '',
  staffing_status TEXT NOT NULL DEFAULT '',
  validation TEXT NOT NULL DEFAULT '',
  deal_status_cx TEXT NOT NULL DEFAULT '',
  vsd TEXT NOT NULL DEFAULT '',
  seo_staffing BOOLEAN NOT NULL DEFAULT false,
  creative_staffing BOOLEAN NOT NULL DEFAULT false,
  mrr NUMERIC,
  duration TEXT,
  retainer_deal_value NUMERIC,
  non_retainer_deal_value NUMERIC,
  total_deal_value NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.staffing_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read staffing_deals" ON public.staffing_deals FOR SELECT USING (true);
CREATE POLICY "Anyone can insert staffing_deals" ON public.staffing_deals FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update staffing_deals" ON public.staffing_deals FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete staffing_deals" ON public.staffing_deals FOR DELETE USING (true);
CREATE TRIGGER update_staffing_deals_updated_at BEFORE UPDATE ON public.staffing_deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ASSIGNMENTS
CREATE TABLE public.staffing_assignments (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES public.staffing_deals(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL,
  person_id TEXT NOT NULL REFERENCES public.staffing_people(id) ON DELETE CASCADE,
  allocation_pct NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.staffing_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read staffing_assignments" ON public.staffing_assignments FOR SELECT USING (true);
CREATE POLICY "Anyone can insert staffing_assignments" ON public.staffing_assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update staffing_assignments" ON public.staffing_assignments FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete staffing_assignments" ON public.staffing_assignments FOR DELETE USING (true);
CREATE TRIGGER update_staffing_assignments_updated_at BEFORE UPDATE ON public.staffing_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- HIRING NEEDS
CREATE TABLE public.staffing_hiring_needs (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  role_category TEXT NOT NULL,
  pod TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'Medium',
  target_date TEXT NOT NULL DEFAULT '',
  rationale TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.staffing_hiring_needs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read staffing_hiring_needs" ON public.staffing_hiring_needs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert staffing_hiring_needs" ON public.staffing_hiring_needs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update staffing_hiring_needs" ON public.staffing_hiring_needs FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete staffing_hiring_needs" ON public.staffing_hiring_needs FOR DELETE USING (true);
CREATE TRIGGER update_staffing_hiring_needs_updated_at BEFORE UPDATE ON public.staffing_hiring_needs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- REVENUE TARGETS
CREATE TABLE public.staffing_revenue_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department TEXT NOT NULL,
  designation TEXT NOT NULL,
  target_deal_value_per_person NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(department, designation)
);
ALTER TABLE public.staffing_revenue_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read staffing_revenue_targets" ON public.staffing_revenue_targets FOR SELECT USING (true);
CREATE POLICY "Anyone can insert staffing_revenue_targets" ON public.staffing_revenue_targets FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update staffing_revenue_targets" ON public.staffing_revenue_targets FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete staffing_revenue_targets" ON public.staffing_revenue_targets FOR DELETE USING (true);
CREATE TRIGGER update_staffing_revenue_targets_updated_at BEFORE UPDATE ON public.staffing_revenue_targets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_staffing_assignments_deal ON public.staffing_assignments(deal_id);
CREATE INDEX idx_staffing_assignments_person ON public.staffing_assignments(person_id);
CREATE INDEX idx_staffing_people_category ON public.staffing_people(role_category);
CREATE INDEX idx_staffing_deals_vsd ON public.staffing_deals(vsd);
