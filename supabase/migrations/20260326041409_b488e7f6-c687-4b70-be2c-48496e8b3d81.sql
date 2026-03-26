
-- Add missing columns to staffing_deals
ALTER TABLE public.staffing_deals ADD COLUMN IF NOT EXISTS principal_bopm text NOT NULL DEFAULT '';
ALTER TABLE public.staffing_deals ADD COLUMN IF NOT EXISTS senior_bopm text NOT NULL DEFAULT '';
ALTER TABLE public.staffing_deals ADD COLUMN IF NOT EXISTS bopm text NOT NULL DEFAULT '';
ALTER TABLE public.staffing_deals ADD COLUMN IF NOT EXISTS customer_status text NOT NULL DEFAULT '';
ALTER TABLE public.staffing_deals ADD COLUMN IF NOT EXISTS customer_type text NOT NULL DEFAULT '';
ALTER TABLE public.staffing_deals ADD COLUMN IF NOT EXISTS service_line_tagging text NOT NULL DEFAULT '';
ALTER TABLE public.staffing_deals ADD COLUMN IF NOT EXISTS deal_value_lost numeric;
ALTER TABLE public.staffing_deals ADD COLUMN IF NOT EXISTS net_deal_value numeric;

-- Create mbr_entries table
CREATE TABLE public.mbr_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text NOT NULL,
  week_start date NOT NULL,
  status text NOT NULL DEFAULT 'Pending',
  mode text,
  notes text,
  updated_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(deal_id, week_start)
);

-- Enable RLS
ALTER TABLE public.mbr_entries ENABLE ROW LEVEL SECURITY;

-- Public RLS policies
CREATE POLICY "Anyone can read mbr_entries" ON public.mbr_entries FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert mbr_entries" ON public.mbr_entries FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update mbr_entries" ON public.mbr_entries FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete mbr_entries" ON public.mbr_entries FOR DELETE TO public USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_mbr_entries_updated_at
  BEFORE UPDATE ON public.mbr_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.mbr_entries;
