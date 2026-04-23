
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.mbr_reminder_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mbr_entry_id uuid NOT NULL,
  reminder_type text NOT NULL,
  sent_date date NOT NULL,
  channel_id text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (mbr_entry_id, reminder_type, sent_date)
);

ALTER TABLE public.mbr_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read mbr_reminder_log"
  ON public.mbr_reminder_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone authenticated can insert mbr_reminder_log"
  ON public.mbr_reminder_log FOR INSERT TO authenticated WITH CHECK (true);
