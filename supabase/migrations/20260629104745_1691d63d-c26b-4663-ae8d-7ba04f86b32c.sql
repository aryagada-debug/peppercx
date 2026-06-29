
CREATE TABLE public.pulse_email_templates (
  id text PRIMARY KEY,
  subject text NOT NULL DEFAULT '',
  greeting text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  cta_label text NOT NULL DEFAULT 'Share your feedback →',
  footer_note text NOT NULL DEFAULT '',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pulse_email_templates TO authenticated;
GRANT ALL ON public.pulse_email_templates TO service_role;

ALTER TABLE public.pulse_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read pulse email template"
  ON public.pulse_email_templates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Leadership can insert pulse email template"
  ON public.pulse_email_templates FOR INSERT
  TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_leadership_viewer(auth.uid())
  );

CREATE POLICY "Leadership can update pulse email template"
  ON public.pulse_email_templates FOR UPDATE
  TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_leadership_viewer(auth.uid())
  ) WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_leadership_viewer(auth.uid())
  );

CREATE TRIGGER update_pulse_email_templates_updated_at
  BEFORE UPDATE ON public.pulse_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pulse_email_templates (id, subject, greeting, body, cta_label, footer_note)
VALUES (
  'default',
  'How are we doing on {{account}} — {{deal_name}}?',
  'Hi {{first_name}},',
  E'Your honest feedback shapes what we fix, build, and prioritise next on this engagement.\n\nIt takes about 4 minutes — and the whole team reads every response.',
  'Share your feedback →',
  'Sent by the Pepper Customer Success team. Reply to this email to reach us directly.'
)
ON CONFLICT (id) DO NOTHING;
