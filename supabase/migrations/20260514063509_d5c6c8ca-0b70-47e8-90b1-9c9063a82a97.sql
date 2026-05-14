CREATE TABLE public.deal_stakeholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text NOT NULL,
  name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT '',
  function text NOT NULL DEFAULT '',
  seniority text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  linkedin_url text NOT NULL DEFAULT '',
  decision_power int NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deal_stakeholders_deal_id ON public.deal_stakeholders(deal_id);

ALTER TABLE public.deal_stakeholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read deal_stakeholders" ON public.deal_stakeholders FOR SELECT USING (true);
CREATE POLICY "Anyone can insert deal_stakeholders" ON public.deal_stakeholders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update deal_stakeholders" ON public.deal_stakeholders FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete deal_stakeholders" ON public.deal_stakeholders FOR DELETE USING (true);

CREATE TRIGGER trg_deal_stakeholders_updated_at
BEFORE UPDATE ON public.deal_stakeholders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();