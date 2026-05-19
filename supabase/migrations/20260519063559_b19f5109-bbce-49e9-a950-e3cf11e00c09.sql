CREATE INDEX IF NOT EXISTS idx_staffing_deals_status ON public.staffing_deals(deal_status);
CREATE INDEX IF NOT EXISTS idx_cx_tasks_space_status ON public.cx_tasks(space_id, status);
CREATE INDEX IF NOT EXISTS idx_deal_rgy_weekly_issue_open ON public.deal_rgy_weekly(issue_status) WHERE issue_status = 'Open';
CREATE INDEX IF NOT EXISTS idx_deal_tasks_deal_sort ON public.deal_tasks(deal_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_staffing_people_active ON public.staffing_people(leaving, tbh) WHERE leaving = false AND tbh = false;