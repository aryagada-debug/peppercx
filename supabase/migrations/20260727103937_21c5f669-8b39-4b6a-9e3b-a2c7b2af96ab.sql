
ALTER TABLE public.survey_invites
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'in_app';
ALTER TABLE public.survey_responses
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'in_app';

CREATE TABLE IF NOT EXISTS public.pulse_google_form_config (
  id text PRIMARY KEY DEFAULT 'default',
  form_url text NOT NULL DEFAULT '',
  form_id text NOT NULL DEFAULT '',
  tracking_entry_id text NOT NULL DEFAULT '',
  field_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  webhook_secret text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT pulse_google_form_config_single CHECK (id = 'default')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pulse_google_form_config TO authenticated;
GRANT ALL ON public.pulse_google_form_config TO service_role;

ALTER TABLE public.pulse_google_form_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage pulse_google_form_config"
  ON public.pulse_google_form_config
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_pulse_google_form_config_updated
  BEFORE UPDATE ON public.pulse_google_form_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pulse_google_form_config (id) VALUES ('default')
  ON CONFLICT (id) DO NOTHING;
