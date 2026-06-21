-- 1) Central Gmail sender flag on the existing gmail_connections table.
ALTER TABLE public.gmail_connections
  ADD COLUMN IF NOT EXISTS is_central boolean NOT NULL DEFAULT false;

-- Enforce a single central sender at any time.
CREATE UNIQUE INDEX IF NOT EXISTS gmail_connections_one_central
  ON public.gmail_connections ((is_central))
  WHERE is_central = true;

-- 2) email_send_log: lightweight audit log of app-driven emails.
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  deal_id text,
  recipient_email text NOT NULL,
  subject text,
  status text NOT NULL DEFAULT 'queued',
  gmail_message_id text,
  error text,
  triggered_by uuid,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_send_log TO authenticated;
GRANT ALL ON public.email_send_log TO service_role;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read email log"
  ON public.email_send_log
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages email log"
  ON public.email_send_log
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS email_send_log_deal_idx
  ON public.email_send_log (deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS email_send_log_event_idx
  ON public.email_send_log (event, created_at DESC);