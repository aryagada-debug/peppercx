CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  user_id uuid PRIMARY KEY,
  google_email text,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  scopes text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_google_calendar_connections_expires_at
  ON public.google_calendar_connections (expires_at);

DROP TRIGGER IF EXISTS update_google_calendar_connections_updated_at ON public.google_calendar_connections;
CREATE TRIGGER update_google_calendar_connections_updated_at
BEFORE UPDATE ON public.google_calendar_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();