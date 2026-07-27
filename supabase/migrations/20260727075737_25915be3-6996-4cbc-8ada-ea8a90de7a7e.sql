CREATE TABLE public.portfolio_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL,
  tab text NOT NULL CHECK (tab IN ('vsd','us_bopm','seo','creative')),
  deal_id text NOT NULL REFERENCES public.staffing_deals(id) ON DELETE CASCADE,
  submitted_by text NOT NULL DEFAULT '',
  rgy_status text NOT NULL DEFAULT '',
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  narrative jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month, tab, deal_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_updates TO authenticated;
GRANT ALL ON public.portfolio_updates TO service_role;

ALTER TABLE public.portfolio_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portfolio_updates_admin_all" ON public.portfolio_updates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "portfolio_updates_visible_select" ON public.portfolio_updates
  FOR SELECT TO authenticated
  USING (deal_id IN (SELECT deal_id FROM public.visible_deal_ids_for_user(auth.uid())));

CREATE POLICY "portfolio_updates_visible_insert" ON public.portfolio_updates
  FOR INSERT TO authenticated
  WITH CHECK (deal_id IN (SELECT deal_id FROM public.visible_deal_ids_for_user(auth.uid())));

CREATE POLICY "portfolio_updates_visible_update" ON public.portfolio_updates
  FOR UPDATE TO authenticated
  USING (deal_id IN (SELECT deal_id FROM public.visible_deal_ids_for_user(auth.uid())))
  WITH CHECK (deal_id IN (SELECT deal_id FROM public.visible_deal_ids_for_user(auth.uid())));

CREATE TRIGGER trg_portfolio_updates_updated_at
  BEFORE UPDATE ON public.portfolio_updates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_portfolio_updates_month_tab ON public.portfolio_updates (month, tab);
CREATE INDEX idx_portfolio_updates_deal ON public.portfolio_updates (deal_id);