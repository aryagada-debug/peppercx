CREATE TABLE public.user_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  user_agent text NOT NULL DEFAULT ''
);

CREATE INDEX idx_user_sessions_user_started ON public.user_sessions (user_id, started_at DESC);
CREATE INDEX idx_user_sessions_last_seen ON public.user_sessions (last_seen_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own sessions"
  ON public.user_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own sessions"
  ON public.user_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users read own sessions"
  ON public.user_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all sessions"
  ON public.user_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));