
-- Dedupe first: keep most recently updated row per (deal_id, month)
DELETE FROM public.deal_financials d
USING public.deal_financials e
WHERE d.deal_id = e.deal_id
  AND d.month = e.month
  AND (
    d.updated_at < e.updated_at
    OR (d.updated_at = e.updated_at AND d.id < e.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_deal_financials_deal_month
  ON public.deal_financials (deal_id, month);
