-- Roll up April 2026 deal-level targets into VSD-level summary
DELETE FROM public.vsd_financial_targets WHERE month = '2026-04-01';

INSERT INTO public.vsd_financial_targets (
  month, vsd,
  contraction_target, contraction_actual,
  delivery_target, delivery_actual,
  invoicing_target, invoicing_actual,
  receivables_target, receivables_actual
)
SELECT
  '2026-04-01'::date,
  COALESCE(NULLIF(TRIM(sd.vsd), ''), 'Unassigned') AS vsd,
  COALESCE(SUM(t.contraction_target), 0),
  COALESCE(SUM(t.contraction_actual), 0),
  COALESCE(SUM(t.delivery_target), 0),
  COALESCE(SUM(t.delivery_actual), 0),
  COALESCE(SUM(t.invoicing_target), 0),
  COALESCE(SUM(t.invoicing_actual), 0),
  COALESCE(SUM(t.receivables_target), 0),
  COALESCE(SUM(t.receivables_actual), 0)
FROM public.deal_financial_targets t
JOIN public.staffing_deals sd
  ON LOWER(TRIM(sd.deal_id)) = LOWER(TRIM(t.deal_id))
WHERE t.month = '2026-04-01'
GROUP BY COALESCE(NULLIF(TRIM(sd.vsd), ''), 'Unassigned');

-- Add a unique constraint so future upserts work cleanly (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vsd_financial_targets_month_vsd_key'
  ) THEN
    ALTER TABLE public.vsd_financial_targets
      ADD CONSTRAINT vsd_financial_targets_month_vsd_key UNIQUE (month, vsd);
  END IF;
END $$;