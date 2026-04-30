-- Unified deals view: joins staffing_deals + clients + staffing aggregates + latest financials.
-- Read-only; underlying tables are still the writeable source of truth.
CREATE OR REPLACE VIEW public.deals_unified
WITH (security_invoker = on) AS
SELECT
  d.id,
  d.deal_id,
  d.pc_code,
  d.deal_name,
  d.account,
  d.business_unit,
  d.capability_line,
  d.deal_type,
  d.deal_status,
  d.staffing_status,
  d.validation,
  d.deal_status_cx,
  d.vsd,
  d.principal_bopm,
  d.senior_bopm,
  d.bopm,
  d.customer_status,
  d.customer_type,
  d.service_line_tagging,
  d.seo_staffing,
  d.creative_staffing,
  d.mrr,
  d.duration,
  d.retainer_deal_value,
  d.non_retainer_deal_value,
  d.total_deal_value,
  d.deal_value_lost,
  d.net_deal_value,
  d.rag,
  d.pod,
  d.start_date,
  d.end_date,
  d.payment_terms,
  d.pepper_business_unit,
  d.pepper_bu_l2,
  d.projected_outcomes,
  d.success_metrics,
  d.baseline_metrics,
  d.client_id,
  d.slack_channel_id,
  d.new_deal_id_formulated,
  d.new_deal_id_temp,
  d.validation_central_cx,
  d.month_closed_won,
  d.deal_target_status,
  d.total_mis_recognition,
  d.total_pending_recognition,
  d.consumption_value,
  d.mis_vs_consumption,
  d.invoiced_deal_value,
  d.undelivered_funnel,
  d.tcv_usd,
  d.strategy_bandwidth_required,
  d.created_at,
  d.updated_at,

  -- Client fields (nullable when client_id is null)
  c.name           AS client_name,
  c.industry       AS client_industry,
  c.geography      AS client_geography,
  c.sales_poc      AS client_sales_poc,
  c.account_status AS client_account_status,
  c.signing_entity AS client_signing_entity,
  c.website        AS client_website,
  c.pc_code        AS client_pc_code,

  -- Staffing aggregates
  COALESCE(sa.assigned_headcount, 0) AS assigned_headcount,
  COALESCE(sa.total_allocation_pct, 0) AS total_allocation_pct,

  -- Latest financials snapshot
  fin.consumption     AS latest_consumption,
  fin.invoiced        AS latest_invoiced,
  fin.received        AS latest_received,
  fin.outstanding     AS latest_outstanding,
  fin.month           AS latest_financial_month
FROM public.staffing_deals d
LEFT JOIN public.clients c
  ON c.id = d.client_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT person_id) AS assigned_headcount,
    SUM(allocation_pct)       AS total_allocation_pct
  FROM public.staffing_assignments
  WHERE deal_id = d.id
) sa ON TRUE
LEFT JOIN LATERAL (
  SELECT consumption, invoiced, received, outstanding, month
  FROM public.deal_financials
  WHERE deal_id = d.id
  ORDER BY month DESC NULLS LAST
  LIMIT 1
) fin ON TRUE;

-- Allow authenticated users to read the unified view.
GRANT SELECT ON public.deals_unified TO authenticated, anon;

COMMENT ON VIEW public.deals_unified IS
  'Single source of truth for deal+client+staffing+latest-financials reads. Edits go to underlying tables; the view auto-reflects them.';