
CREATE TABLE public.pulse_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pulse_campaigns TO authenticated;
GRANT ALL ON public.pulse_campaigns TO service_role;
ALTER TABLE public.pulse_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read campaigns" ON public.pulse_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create campaigns" ON public.pulse_campaigns FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Creators and admins can update campaigns" ON public.pulse_campaigns FOR UPDATE TO authenticated USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete campaigns" ON public.pulse_campaigns FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_pulse_campaigns_updated_at BEFORE UPDATE ON public.pulse_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.survey_invites ADD COLUMN campaign_id uuid REFERENCES public.pulse_campaigns(id) ON DELETE SET NULL;
CREATE INDEX idx_survey_invites_campaign ON public.survey_invites(campaign_id);
