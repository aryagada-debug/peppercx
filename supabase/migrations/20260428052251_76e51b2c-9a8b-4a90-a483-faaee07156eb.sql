
ALTER TABLE public.staffing_assignments
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date;

CREATE TABLE IF NOT EXISTS public.staffing_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id text NOT NULL,
  deal_id text NOT NULL DEFAULT '',
  assignment_id text NOT NULL DEFAULT '',
  reminder_type text NOT NULL,
  sent_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staffing_reminder_log_dedupe
  ON public.staffing_reminder_log (person_id, deal_id, reminder_type, sent_date);

ALTER TABLE public.staffing_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read staffing reminder log"
  ON public.staffing_reminder_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth insert staffing reminder log"
  ON public.staffing_reminder_log
  FOR INSERT TO authenticated WITH CHECK (true);
