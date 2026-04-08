
-- Create staffing_bw_rules table
CREATE TABLE public.staffing_bw_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT 'India',
  mrr_tier_label text NOT NULL DEFAULT '',
  mrr_min numeric NOT NULL DEFAULT 0,
  mrr_max numeric NOT NULL DEFAULT 0,
  role_key text NOT NULL DEFAULT '',
  recommended_pct numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staffing_bw_rules ENABLE ROW LEVEL SECURITY;

-- Public access policies
CREATE POLICY "Anyone can read staffing_bw_rules" ON public.staffing_bw_rules FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert staffing_bw_rules" ON public.staffing_bw_rules FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update staffing_bw_rules" ON public.staffing_bw_rules FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete staffing_bw_rules" ON public.staffing_bw_rules FOR DELETE TO public USING (true);

-- Add rag column to staffing_deals
ALTER TABLE public.staffing_deals ADD COLUMN rag text NOT NULL DEFAULT 'green';
