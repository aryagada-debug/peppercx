-- Weekly editable staffing allocations
CREATE TABLE public.staffing_weekly_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id text NOT NULL,
  person_id text NOT NULL,
  week_start date NOT NULL,
  allocation_pct numeric NOT NULL DEFAULT 0,
  actual_hours numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (deal_id, person_id, week_start)
);

CREATE INDEX idx_swa_deal ON public.staffing_weekly_allocations(deal_id);
CREATE INDEX idx_swa_person ON public.staffing_weekly_allocations(person_id);
CREATE INDEX idx_swa_week ON public.staffing_weekly_allocations(week_start);

ALTER TABLE public.staffing_weekly_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read staffing_weekly_allocations"
  ON public.staffing_weekly_allocations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert staffing_weekly_allocations"
  ON public.staffing_weekly_allocations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update staffing_weekly_allocations"
  ON public.staffing_weekly_allocations FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete staffing_weekly_allocations"
  ON public.staffing_weekly_allocations FOR DELETE USING (true);

CREATE TRIGGER update_swa_updated_at
  BEFORE UPDATE ON public.staffing_weekly_allocations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
