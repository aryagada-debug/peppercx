
ALTER TABLE public.staffing_deals
  ADD COLUMN IF NOT EXISTS new_deal_id_formulated text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS new_deal_id_temp text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS validation_central_cx text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS month_closed_won text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS deal_target_status text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS total_mis_recognition numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_pending_recognition numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consumption_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mis_vs_consumption numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoiced_deal_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS undelivered_funnel numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tcv_usd numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS strategy_bandwidth_required text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pepper_bu_l2 text NOT NULL DEFAULT '';
