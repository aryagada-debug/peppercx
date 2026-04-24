ALTER TABLE public.staffing_people
  ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS slack_user_id text NOT NULL DEFAULT '';