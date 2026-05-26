ALTER TABLE public.staffing_people
  ADD COLUMN IF NOT EXISTS revenue_target_per_person numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_target_currency text NOT NULL DEFAULT 'INR';