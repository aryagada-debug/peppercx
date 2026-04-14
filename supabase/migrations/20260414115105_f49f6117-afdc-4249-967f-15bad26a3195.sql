
-- Phase 1A: Sync deal_status_cx from deal_status
UPDATE public.staffing_deals
SET deal_status_cx = deal_status
WHERE deal_status_cx != deal_status OR deal_status_cx = '';

-- Phase 1C: Fix empty pod assignments based on VSD patterns
UPDATE public.staffing_deals SET pod = 'FMCG' WHERE (pod IS NULL OR pod = '') AND vsd ILIKE '%Sneha%';
UPDATE public.staffing_deals SET pod = 'Integrated' WHERE (pod IS NULL OR pod = '') AND vsd ILIKE '%Aamir%';
UPDATE public.staffing_deals SET pod = 'US B2B' WHERE (pod IS NULL OR pod = '') AND vsd ILIKE '%Neema%';
UPDATE public.staffing_deals SET pod = 'India B2B' WHERE (pod IS NULL OR pod = '') AND vsd ILIKE '%Sumit%';
UPDATE public.staffing_deals SET pod = 'BFSI' WHERE (pod IS NULL OR pod = '') AND (vsd ILIKE '%Aditya Shaw%' OR vsd ILIKE '%Aditya%');

-- Phase 3A: Add team and line_item_value columns to deal_sow_items
ALTER TABLE public.deal_sow_items ADD COLUMN IF NOT EXISTS teams jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.deal_sow_items ADD COLUMN IF NOT EXISTS line_item_value numeric DEFAULT 0;
