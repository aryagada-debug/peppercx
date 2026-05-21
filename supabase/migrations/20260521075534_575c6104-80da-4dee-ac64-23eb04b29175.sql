
ALTER TABLE public.staffing_deals
  ADD COLUMN IF NOT EXISTS sales_leader text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sales_rep text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS geo text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS revenue_type text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'deal_master_csv',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  deals_upserted integer NOT NULL DEFAULT 0,
  financials_upserted integer NOT NULL DEFAULT 0,
  clients_created integer NOT NULL DEFAULT 0,
  rows_skipped integer NOT NULL DEFAULT 0,
  error_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  triggered_by text NOT NULL DEFAULT 'cron',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at ON public.sync_runs (started_at DESC);

ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read sync_runs" ON public.sync_runs;
CREATE POLICY "Auth read sync_runs" ON public.sync_runs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage sync_runs" ON public.sync_runs;
CREATE POLICY "Admins manage sync_runs" ON public.sync_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
