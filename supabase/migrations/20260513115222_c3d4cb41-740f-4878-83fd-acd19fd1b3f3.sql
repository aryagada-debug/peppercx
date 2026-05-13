-- Per-user default display currency
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_currency text NOT NULL DEFAULT 'INR'
  CHECK (default_currency IN ('INR','USD'));

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_deal_financials_deal_month
  ON public.deal_financials (deal_id, month);

CREATE INDEX IF NOT EXISTS idx_deal_tasks_deal
  ON public.deal_tasks (deal_id);

CREATE INDEX IF NOT EXISTS idx_mbr_entries_deal
  ON public.mbr_entries (deal_id);

CREATE INDEX IF NOT EXISTS idx_staffing_people_email_lower
  ON public.staffing_people (lower(email));

CREATE INDEX IF NOT EXISTS idx_profiles_staffing_person
  ON public.profiles (staffing_person_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user
  ON public.user_roles (user_id);

CREATE INDEX IF NOT EXISTS idx_personal_todos_user
  ON public.personal_todos (user_id);

CREATE INDEX IF NOT EXISTS idx_personal_todos_assignee_person
  ON public.personal_todos (assignee_staffing_person_id);
